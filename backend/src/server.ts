import Fastify from 'fastify'
import cors from '@fastify/cors'
import 'dotenv/config'

const app = Fastify({ logger: true })

app.register(cors, { origin: true })

// Health check
app.get('/health', async () => ({
  status: 'ok',
  service: 'pyre-backend',
  version: '2.0.0',
  timestamp: new Date().toISOString()
}))

// Módulos
app.register(import('./modules/chat/chat.routes'), { prefix: '/chat' })
app.register(import('./modules/content/content.routes'), { prefix: '/content' })
app.register(import('./modules/publications/publications.routes'), { prefix: '/publications' })
app.register(import('./modules/automations/automations.routes'), { prefix: '/automations' })
app.register(import('./modules/credits/credits.routes'), { prefix: '/credits' })
app.register(import('./modules/webhooks/webhooks.routes'), { prefix: '/webhooks' })

const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' })
    console.log('🔥 Pyre Backend v2.0 rodando na porta', process.env.PORT || 3000)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
