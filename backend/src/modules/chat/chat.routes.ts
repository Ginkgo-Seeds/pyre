import { FastifyInstance } from 'fastify'
import { supabase } from '../../services/supabase'
import { routeIntent } from '../../services/intentRouter'
import { textToSpeech } from '../../services/elevenLabs'
import { generateImage } from '../../services/nanoBanana'
import { debitCredits, CREDIT_COSTS } from '../../services/creditsService'

export default async function chatRoutes(app: FastifyInstance) {

  // POST /chat/message — Endpoint principal do agente Pierre
  app.post('/message', async (req, reply) => {
    const { user_id, message, audio_mode = false } = req.body as any

    if (!user_id || !message) {
      return reply.status(400).send({ error: 'user_id e message são obrigatórios' })
    }

    // 1. Buscar histórico recente de conversa
    const { data: history } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(10)

    const chatHistory = (history ?? []).reverse()

    // 2. Salvar mensagem do usuário no histórico
    await supabase.from('chat_history').insert({
      user_id,
      role: 'user',
      content: message
    })

    // 3. Rotear a intenção com Claude Opus (Pierre)
    let intent
    try {
      intent = await routeIntent(message, chatHistory)
    } catch (err: any) {
      return reply.status(500).send({ error: 'Falha no roteador de intenção', detail: err.message })
    }

    // 4. Salvar resposta do agente no histórico
    await supabase.from('chat_history').insert({
      user_id,
      role: 'assistant',
      content: intent.agent_reply
    })

    // 5. Se for criação de conteúdo, iniciar o processo
    let contentRecord = null

    if (['image', 'video', 'audio', 'avatar'].includes(intent.type)) {
      // Verificar e debitar créditos
      const creditKey = `${intent.type}_${intent.api}`
      const cost = CREDIT_COSTS[creditKey] ?? 10
      const debit = await debitCredits(user_id, creditKey, cost)

      if (!debit.success) {
        const lowBalanceReply = 'Monsieur, seus créditos estão insuficientes para esta operação. Que tal recarregar?'
        return reply.send({
          agent_reply: lowBalanceReply,
          audio_url: audio_mode ? await generateAudioUrl(lowBalanceReply) : null,
          intent: { type: 'error', reason: 'insufficient_credits' },
          balance: debit.balance
        })
      }

      // Criar registro de conteúdo no banco
      const { data: content } = await supabase
        .from('content')
        .insert({
          user_id,
          type: intent.type,
          user_prompt: message,
          agent_prompt: intent.api_prompt,
          api_used: intent.api,
          status: 'processing'
        })
        .select()
        .single()

      contentRecord = content

      // Disparar geração assíncrona (imagem por enquanto)
      if (intent.type === 'image' && intent.api === 'nanobanana') {
        generateImage(intent.api_prompt).then(async ({ taskId }) => {
          await supabase
            .from('content')
            .update({ status: 'pending', error_message: taskId }) // taskId temporariamente no campo error
            .eq('id', content.id)
        }).catch(async (err) => {
          await supabase
            .from('content')
            .update({ status: 'failed', error_message: err.message })
            .eq('id', content.id)
        })
      }
    }

    // 6. Se for automação, salvar a regra
    if (intent.type === 'automation' && intent.is_automation) {
      await supabase.from('automation_rules').insert({
        user_id,
        name: `Automação: ${message.slice(0, 50)}`,
        cron_expression: intent.cron_expression ?? '0 12 * * *',
        base_prompt: intent.api_prompt,
        networks: intent.networks,
        is_active: true
      })
    }

    // 7. Gerar áudio da resposta do Pierre (se audio_mode)
    let audioUrl = null
    if (audio_mode) {
      audioUrl = await generateAudioUrl(intent.agent_reply)
    }

    return reply.send({
      agent_reply: intent.agent_reply,
      audio_url: audioUrl,
      intent,
      content_id: contentRecord?.id ?? null
    })
  })

  // GET /chat/history/:user_id — Buscar histórico
  app.get('/history/:user_id', async (req, reply) => {
    const { user_id } = req.params as any
    const { data } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: true })
      .limit(50)

    return reply.send({ history: data ?? [] })
  })
}

// Helper: gera URL de áudio e salva no storage
async function generateAudioUrl(text: string): Promise<string | null> {
  try {
    const audioBuffer = await textToSpeech(text)
    const fileName = `pierre-${Date.now()}.mp3`
    const { data } = await supabase.storage
      .from('pyre-media')
      .upload(`audio/${fileName}`, audioBuffer, { contentType: 'audio/mpeg' })

    if (!data) return null
    const { data: urlData } = supabase.storage.from('pyre-media').getPublicUrl(`audio/${fileName}`)
    return urlData.publicUrl
  } catch {
    return null
  }
}
