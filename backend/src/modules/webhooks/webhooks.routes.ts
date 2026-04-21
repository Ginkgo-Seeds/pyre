import { FastifyInstance } from 'fastify'
import { supabase } from '../../services/supabase'

export default async function webhooksRoutes(app: FastifyInstance) {

  // POST /webhooks/nanobanana — Callback assíncrono da NanoBanana quando imagem fica pronta
  app.post('/nanobanana', async (req, reply) => {
    const body = req.body as any
    const taskId = body.taskId ?? body.id
    const imageUrl = body.imageUrl ?? body.output?.[0]
    const status = body.status === 'SUCCESS' ? 'completed' : 'failed'

    if (!taskId) return reply.status(400).send({ error: 'taskId ausente' })

    // Encontrar o conteúdo pelo taskId (guardado em error_message temporariamente)
    const { data: content } = await supabase
      .from('content')
      .select('id')
      .eq('error_message', taskId)
      .single()

    if (content) {
      await supabase
        .from('content')
        .update({
          status,
          media_url: imageUrl ?? null,
          error_message: status === 'failed' ? 'Geração falhou na API' : null
        })
        .eq('id', content.id)
    }

    return reply.send({ received: true })
  })

  // POST /webhooks/seedance — Callback da Seedance quando vídeo fica pronto
  app.post('/seedance', async (req, reply) => {
    const body = req.body as any
    const taskId = body.task_id
    const videoUrl = body.video_url
    const status = body.status === 'completed' ? 'completed' : 'failed'

    if (!taskId) return reply.status(400).send({ error: 'task_id ausente' })

    const { data: content } = await supabase
      .from('content')
      .select('id')
      .eq('error_message', taskId)
      .single()

    if (content) {
      await supabase
        .from('content')
        .update({
          status,
          media_url: videoUrl ?? null,
          error_message: status === 'failed' ? 'Geração de vídeo falhou' : null
        })
        .eq('id', content.id)
    }

    return reply.send({ received: true })
  })

  // POST /webhooks/n8n/publish — n8n avisa que publicou com sucesso
  app.post('/n8n/publish', async (req, reply) => {
    const { publication_id, postiz_id, status, error } = req.body as any

    await supabase
      .from('publications')
      .update({
        status: status ?? 'published',
        postiz_id: postiz_id ?? null,
        error_message: error ?? null
      })
      .eq('id', publication_id)

    return reply.send({ received: true })
  })
}
