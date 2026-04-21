import { FastifyInstance } from 'fastify'
import { supabase } from '../../services/supabase'

export default async function automationsRoutes(app: FastifyInstance) {

  // GET /automations/user/:user_id — Listar regras de automação
  app.get('/user/:user_id', async (req, reply) => {
    const { user_id } = req.params as any
    const { data } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })

    return reply.send({ automations: data ?? [] })
  })

  // PATCH /automations/:id/toggle — Ativar/desativar uma automação
  app.patch('/:id/toggle', async (req, reply) => {
    const { id } = req.params as any
    const { user_id } = req.body as any

    const { data: rule } = await supabase
      .from('automation_rules')
      .select('is_active')
      .eq('id', id)
      .eq('user_id', user_id)
      .single()

    if (!rule) return reply.status(404).send({ error: 'Automação não encontrada' })

    const { data: updated } = await supabase
      .from('automation_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', id)
      .select()
      .single()

    return reply.send({ automation: updated })
  })

  // DELETE /automations/:id — Deletar uma automação
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as any
    const { user_id } = req.body as any

    await supabase
      .from('automation_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', user_id)

    return reply.send({ success: true })
  })

  // GET /automations/pending — Endpoint para o n8n buscar automações que devem rodar agora
  // Este endpoint é chamado pelo Fluxo 1 do n8n (Motor de Recorrência)
  app.get('/pending', async (_req, reply) => {
    const now = new Date()
    const { data } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('is_active', true)
      .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`)

    return reply.send({ pending: data ?? [] })
  })

  // POST /automations/:id/mark-ran — n8n avisa que executou uma automação
  app.post('/:id/mark-ran', async (req, reply) => {
    const { id } = req.params as any
    const { next_run_at } = req.body as any

    await supabase
      .from('automation_rules')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: next_run_at ?? null
      })
      .eq('id', id)

    return reply.send({ success: true })
  })
}
