import Fastify from 'fastify'
import cors from '@fastify/cors'
import 'dotenv/config'

import chatRoutes from './modules/chat/chat.routes'
import contentRoutes from './modules/content/content.routes'
import publicationsRoutes from './modules/publications/publications.routes'
import automationsRoutes from './modules/automations/automations.routes'
import creditsRoutes from './modules/credits/credits.routes'
import webhooksRoutes from './modules/webhooks/webhooks.routes'
import creativeRoutes from './modules/creative/creative.routes'

const app = Fastify({ logger: true })

app.register(cors, { origin: true })

app.get('/health', async () => ({
  status: 'ok',
  service: 'pyre-backend',
  version: '2.0.0',
  timestamp: new Date().toISOString()
}))

app.register(chatRoutes, { prefix: '/chat' })
app.register(contentRoutes, { prefix: '/content' })
app.register(publicationsRoutes, { prefix: '/publications' })
app.register(automationsRoutes, { prefix: '/automations' })
app.register(creditsRoutes, { prefix: '/credits' })
app.register(webhooksRoutes, { prefix: '/webhooks' })
app.register(creativeRoutes, { prefix: '/v1/creative' })

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