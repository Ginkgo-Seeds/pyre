import { FastifyInstance } from 'fastify'
import { supabase } from '../../services/supabase'

export default async function automationsRoutes(app: FastifyInstance) {

  app.get('/:user_id', async (req, reply) => {
    const { user_id } = req.params as any
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send({ automations: data ?? [] })
  })

  app.patch('/:id/toggle', async (req, reply) => {
    const { id } = req.params as any
    const { active } = req.body as any
    const { data, error } = await supabase
      .from('automation_rules')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send({ automation: data })
  })

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as any
    await supabase.from('automation_rules').delete().eq('id', id)
    return reply.send({ success: true })
  })
}