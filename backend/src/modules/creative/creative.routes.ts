// Rotas do Creative Router (registradas em server.ts com prefixo /v1/creative):
//   POST /v1/creative/jobs               — submete CreativeGenerationRequest
//   GET  /v1/creative/jobs/:job_id       — consulta resultado normalizado
//   GET  /v1/creative/providers/health   — saúde dos providers registrados
//
// O caller usa SOMENTE os contratos normalizados (creative.contracts.ts).

import { FastifyInstance } from 'fastify'
import { CreativeErrorCode } from './creative.contracts'
import { CreativeRouter } from './creative.router'
import { ComfyUIProvider } from './providers/comfyui.provider'

const HTTP_BY_CODE: Record<CreativeErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNSUPPORTED_CAPABILITY: 400,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_UNHEALTHY: 503,
  GENERATION_FAILED: 502,
  TIMEOUT: 504,
  ASSET_NOT_FOUND: 404
}

export function buildCreativeRouter(): CreativeRouter {
  const router = new CreativeRouter()
  router.register(new ComfyUIProvider())
  return router
}

export default async function creativeRoutes(app: FastifyInstance) {
  const router = buildCreativeRouter()

  app.post('/jobs', async (req, reply) => {
    const result = await router.submit((req.body as any) ?? {})
    if (result.status === 'failed' && result.error) {
      return reply.status(HTTP_BY_CODE[result.error.code] ?? 500).send(result)
    }
    return reply.status(202).send(result)
  })

  app.get('/jobs/:job_id', async (req, reply) => {
    const { job_id } = req.params as any
    const result = await router.getJob(job_id)
    if (!result) {
      return reply.status(404).send({
        request_id: 'unknown',
        job_id,
        status: 'failed',
        error: { code: 'ASSET_NOT_FOUND', message: 'job desconhecido', retryable: false }
      })
    }
    if (result.status === 'failed' && result.error) {
      return reply.status(HTTP_BY_CODE[result.error.code] ?? 500).send(result)
    }
    return reply.send(result)
  })

  app.get('/providers/health', async () => ({
    providers: await router.providersHealth()
  }))
}
