import { FastifyInstance } from 'fastify'
import { supabase } from '../../services/supabase'
import { publishContent, getIntegrations } from '../../services/publishService'
import { debitCredits, CREDIT_COSTS } from '../../services/creditsService'

export default async function publicationsRoutes(app: FastifyInstance) {

  // POST /publications/publish — Publicar conteúdo aprovado
  app.post('/publish', async (req, reply) => {
    const { user_id, content_id, networks, caption, scheduled_for } = req.body as any

    if (!user_id || !content_id || !networks?.length) {
      return reply.status(400).send({ error: 'user_id, content_id e networks são obrigatórios' })
    }

    // Buscar o conteúdo
    const { data: content } = await supabase
      .from('content')
      .select('*')
      .eq('id', content_id)
      .eq('user_id', user_id)
      .single()

    if (!content || content.status !== 'completed') {
      return reply.status(400).send({ error: 'Conteúdo não encontrado ou ainda não gerado' })
    }

    // Debitar créditos de publicação
    const cost = CREDIT_COSTS['publish_postiz'] * networks.length
    const debit = await debitCredits(user_id, 'publish_postiz', cost)
    if (!debit.success) {
      return reply.status(402).send({ error: 'Créditos insuficientes para publicação' })
    }

    // Buscar integrações do usuário no Postiz
    let integrationIds: Record<string, string> = {}
    try {
      const integrations = await getIntegrations()
      integrationIds = integrations.reduce((acc, i) => {
        acc[i.network] = i.id
        return acc
      }, {} as Record<string, string>)
    } catch (_) {
      // Se Postiz não estiver configurado, salvar como pendente para o n8n processar
    }

    // Criar registro de publicação
    const { data: pub } = await supabase
      .from('publications')
      .insert({
        content_id,
        user_id,
        networks,
        caption: caption ?? content.user_prompt,
        scheduled_for: scheduled_for ?? null,
        status: 'pending'
      })
      .select()
      .single()

    // Se tiver integrações configuradas, publicar direto
    if (Object.keys(integrationIds).length > 0 && content.media_url) {
      try {
        const result = await publishContent({
          mediaUrl: content.media_url,
          caption: caption ?? content.user_prompt,
          networks,
          scheduledFor: scheduled_for,
          integrationIds
        })

        await supabase
          .from('publications')
          .update({ status: scheduled_for ? 'scheduled' : 'published', postiz_id: result.postizId })
          .eq('id', pub!.id)

        return reply.send({ success: true, publication_id: pub!.id, postiz_id: result.postizId })
      } catch (err: any) {
        await supabase
          .from('publications')
          .update({ status: 'failed', error_message: err.message })
          .eq('id', pub!.id)
        return reply.status(500).send({ error: 'Falha na publicação', detail: err.message })
      }
    }

    // Sem integração: publicação ficará pendente para o n8n processar
    return reply.send({
      success: true,
      publication_id: pub!.id,
      message: 'Publicação enfileirada. O n8n irá processar em breve.'
    })
  })

  // GET /publications/user/:user_id — Listar publicações
  app.get('/user/:user_id', async (req, reply) => {
    const { user_id } = req.params as any
    const { data } = await supabase
      .from('publications')
      .select('*, content(*)')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(20)

    return reply.send({ publications: data ?? [] })
  })

  // GET /publications/integrations — Listar contas conectadas no Postiz
  app.get('/integrations', async (_req, reply) => {
    try {
      const integrations = await getIntegrations()
      return reply.send({ integrations })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })
}
