import { FastifyInstance } from 'fastify'
import { supabase } from '../../supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function contentRoutes(app: FastifyInstance) {

  app.post('/generate', async (req, reply) => {
    const { prompt, user_id } = req.body as any

    // 1. Intent Router — Claude decide o que fazer
    const intent = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Analise esse pedido e responda APENAS um JSON:
        {"type": "image"|"video"|"audio", "api": "nanobanana"|"seedance"|"elevenlabs", "api_prompt": "prompt em inglês otimizado para a API"}
        
        Pedido: "${prompt}"`
      }]
    })

    const raw = (intent.content[0] as any).text
    const parsed = JSON.parse(raw.match(/\{.*\}/s)[0])

    // 2. Salvar no banco com status pending
    const { data: content } = await supabase
      .from('content')
      .insert({
        user_id,
        type: parsed.type,
        prompt,
        api_prompt: parsed.api_prompt,
        api_used: parsed.api,
        status: 'pending'
      })
      .select()
      .single()

    // 3. Retornar o job para o app fazer polling
    return reply.send({
      content_id: content.id,
      type: parsed.type,
      api_prompt: parsed.api_prompt,
      status: 'pending',
      message: 'Processando...'
    })
  })

  app.get('/status/:id', async (req, reply) => {
    const { id } = req.params as any
    const { data } = await supabase
      .from('content')
      .select('*')
      .eq('id', id)
      .single()
    return reply.send(data)
  })
}