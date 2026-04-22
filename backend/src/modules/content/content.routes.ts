import { FastifyInstance } from 'fastify'
import { supabase } from '../../services/supabase'
import { getImageStatus } from '../../services/nanoBanana'

export default async function contentRoutes(app: FastifyInstance) {

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as any
    const { data, error } = await supabase
      .from('content').select('*').eq('id', id).single()

    if (error || !data) return reply.status(404).send({ error: 'Conteúdo não encontrado' })

    if (data.status === 'pending' && data.api_used === 'nanobanana' && data.error_message) {
      try {
        const result = await getImageStatus(data.error_message)
        if (result.status === 'completed' && result.imageUrl) {
          await supabase.from('content')
            .update({ status: 'completed', media_url: result.imageUrl, error_message: null })
            .eq('id', id)
          return reply.send({ ...data, status: 'completed', media_url: result.imageUrl })
        }
        if (result.status === 'failed') {
          await supabase.from('content')
            .update({ status: 'failed', error_message: 'Geração falhou na API' })
            .eq('id', id)
        }
      } catch (_) {}
    }

    return reply.send(data)
  })

  app.get('/user/:user_id', async (req, reply) => {
    const { user_id } = req.params as any
    const { data } = await supabase
      .from('content').select('*').eq('user_id', user_id)
      .order('created_at', { ascending: false }).limit(20)
    return reply.send({ content: data ?? [] })
  })

  app.get('/library/:user_id', async (req, reply) => {
    const { user_id } = req.params as any
    const { type, folder } = req.query as any
    let query = supabase
      .from('content').select('*').eq('user_id', user_id)
      .eq('status', 'completed').order('created_at', { ascending: false })
    if (type) query = query.eq('type', type)
    if (folder) query = query.eq('folder', folder)
    const { data, error } = await query.limit(50)
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send({ items: data ?? [], total: data?.length ?? 0 })
  })

}