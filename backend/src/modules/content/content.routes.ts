import { FastifyInstance } from 'fastify'
import { supabase } from '../../services/supabase'
import { getImageStatus } from '../../services/nanoBanana'

export default async function contentRoutes(app: FastifyInstance) {

  // GET /content/:id — Status de um conteúdo
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as any
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return reply.status(404).send({ error: 'Conteúdo não encontrado' })

    // Se estiver pendente e for imagem, verificar status na NanoBanana
    if (data.status === 'pending' && data.api_used === 'nanobanana' && data.error_message) {
      try {
        const taskId = data.error_message // taskId guardado temporariamente aqui
        const result = await getImageStatus(taskId)

        if (result.status === 'completed' && result.imageUrl) {
          await supabase
            .from('content')
            .update({ status: 'completed', media_url: result.imageUrl, error_message: null })
            .eq('id', id)

          return reply.send({ ...data, status: 'completed', media_url: result.imageUrl })
        }

        if (result.status === 'failed') {
          await supabase
            .from('content')
            .update({ status: 'failed', error_message: 'Geração falhou na API' })
            .eq('id', id)
        }
      } catch (_) { /* mantém status atual */ }
    }

    return reply.send(data)
  })

  // GET /content/user/:user_id — Listar conteúdos do usuário
  app.get('/user/:user_id', async (req, reply) => {
    const { user_id } = req.params as any
    const { data } = await supabase
      .from('content')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(20)

    return reply.send({ content: data ?? [] })
  })
}
