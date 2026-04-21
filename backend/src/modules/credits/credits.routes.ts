import { FastifyInstance } from 'fastify'
import { supabase } from '../../services/supabase'
import { creditTokens } from '../../services/creditsService'

export default async function creditsRoutes(app: FastifyInstance) {

  // GET /credits/:user_id — Saldo atual
  app.get('/:user_id', async (req, reply) => {
    const { user_id } = req.params as any
    const { data } = await supabase
      .from('user_credits')
      .select('balance, plan, updated_at')
      .eq('user_id', user_id)
      .single()

    if (!data) return reply.status(404).send({ error: 'Usuário não encontrado' })
    return reply.send(data)
  })

  // POST /credits/topup — Adicionar créditos (chamado pelo webhook do Stripe via n8n)
  app.post('/topup', async (req, reply) => {
    const { user_id, amount, plan, webhook_secret } = req.body as any

    // Validação simples de segurança para o webhook do n8n
    if (webhook_secret !== process.env.WEBHOOK_SECRET) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    await creditTokens(user_id, amount)

    if (plan) {
      await supabase
        .from('user_credits')
        .update({ plan })
        .eq('user_id', user_id)
    }

    return reply.send({ success: true, message: `${amount} créditos adicionados` })
  })
}
