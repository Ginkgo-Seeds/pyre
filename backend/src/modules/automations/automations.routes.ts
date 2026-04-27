import { FastifyInstance } from 'fastify'
import { supabase } from '../../services/supabase'

export default async function automationsRoutes(app: FastifyInstance) {

  app.get('/user/:user_id', async (req, reply) => {
    const { user_id } = req.params as any
    const result = await supabase
      .from('automation_rules')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
    if (result.error) return reply.status(500).send({ error: result.error.message })
    return reply.send({ automations: result.data ?? [] })
  })

  app.get('/:user_id', async (req, reply) => {
    const { user_id } = req.params as any
    const result = await supabase
      .from('automation_rules')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
    if (result.error) return reply.status(500).send({ error: result.error.message })
    return reply.send({ automations: result.data ?? [] })
  })

  app.patch('/:id/toggle', async (req, reply) => {
    const { id } = req.params as any
    const { active } = req.body as any
    const current = await supabase
      .from('automation_rules')
      .select('active')
      .eq('id', id)
      .single()
    const newActive = active !== undefined ? active : !current.data?.active
    const result = await supabase
      .from('automation_rules')
      .update({ active: newActive })
      .eq('id', id)
      .select()
      .single()
    if (result.error) return reply.status(500).send({ error: result.error.message })
    return reply.send({ automation: result.data })
  })

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as any
    const result = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', id)
    if (result.error) return reply.status(500).send({ error: result.error.message })
    return reply.send({ success: true })
  })
}