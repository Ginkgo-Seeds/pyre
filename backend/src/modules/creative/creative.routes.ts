// Rotas do Creative Router v2 (Wave 9) — prefixo /v1/creative em server.ts:
//   POST /jobs                — submete (idempotente por request_id)
//   GET  /jobs/:job_id        — resultado normalizado (persistido)
//   GET  /providers/health    — saúde real dos providers + estado do runtime
//
// Routes NÃO acessam banco diretamente — tudo via CreativeRouter/Repository.

import { FastifyInstance } from 'fastify'
import { CreativeErrorCode } from './creative.contracts'
import { CreativeRouter } from './creative.router'
import { buildRepository } from './creative.repository'
import { buildRuntimeManager } from './runtime/creative-runtime.manager'
import { ComfyUIProvider } from './providers/comfyui.provider'
import { GoogleImageProvider } from './providers/google-image.provider'

const HTTP_BY_CODE: Record<CreativeErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNSUPPORTED_CAPABILITY: 400,
  IDEMPOTENCY_CONFLICT: 409,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_UNHEALTHY: 503,
  GENERATION_FAILED: 502,
  TIMEOUT: 504,
  ASSET_NOT_FOUND: 404,
  PROVIDER_STATE_LOST: 500,
  NO_VALIDATED_PROVIDER: 503
}

export default async function creativeRoutes(app: FastifyInstance) {
  const repo = buildRepository()
  await repo.init()
  const runtime = buildRuntimeManager()
  const router = new CreativeRouter(repo, runtime)
  router.register(new ComfyUIProvider())
  router.register(new GoogleImageProvider())
  const reconciled = await router.reconcile()
  if (reconciled) app.log.info({ reconciled }, 'creative jobs reconciliados pós-restart')

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
        request_id: 'unknown', job_id, status: 'failed',
        error: { code: 'ASSET_NOT_FOUND', message: 'job desconhecido', retryable: false }
      })
    }
    if (result.status === 'failed' && result.error) {
      return reply.status(HTTP_BY_CODE[result.error.code] ?? 500).send(result)
    }
    return reply.send(result)
  })

  app.get('/providers/health', async () => ({
    runtime_state: runtime.getState(),
    providers: await router.providersHealth()
  }))
}
