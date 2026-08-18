// Testes unitários do Creative Router v2 (Wave 9) — SEM GPU, SEM shell, SEM banco real.
// Runner: npm test (node --require ts-node/register --test)

process.env.CREATIVE_WATCH_INTERVAL_MS = '20'
process.env.CREATIVE_WATCH_TIMEOUT_MS = '2000'

import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  CAPABILITY_IMAGE_CLOUD, CAPABILITY_IMAGE_LOCAL,
  SKILL_IMAGE_GENERATE_CLOUD, SKILL_IMAGE_GENERATE_LOCAL,
  CreativeGenerationRequest, err, validateRequest
} from './creative.contracts'
import { InMemoryCreativeJobRepository } from './creative.repository'
import { CreativeRouter } from './creative.router'
import {
  CreativeProvider, ProviderCapability, ProviderHealth,
  ProviderJobUpdate, ProviderProvenance, ProviderSubmission
} from './providers/provider'
import { GoogleImageProvider } from './providers/google-image.provider'

function baseRequest(overrides: Partial<CreativeGenerationRequest> = {}): Partial<CreativeGenerationRequest> {
  return {
    request_id: 'req-' + Math.random().toString(36).slice(2),
    capability: CAPABILITY_IMAGE_LOCAL,
    skill: SKILL_IMAGE_GENERATE_LOCAL,
    kind: 'image',
    prompt: 'uma árvore ginkgo',
    preset: 'sdxl-local-standard',
    ...overrides
  }
}

class MockProvider implements CreativeProvider {
  submitted: CreativeGenerationRequest[] = []
  healthy = true
  failWith: any = null
  fetchResult: ProviderJobUpdate = {
    phase: 'completed',
    asset: { path: 'C:\\out\\x.png', mime_type: 'image/png', width: 768, height: 768, bytes: 1000 },
    seed: 1, billing_cost_usd: 0
  }
  constructor(private pid = 'local', private ptool = 'comfyui-local',
    private caps: ProviderCapability[] = [{ capability: CAPABILITY_IMAGE_LOCAL, skill: SKILL_IMAGE_GENERATE_LOCAL, kind: 'image' }],
    private localRuntime = false) {}
  id() { return this.pid }
  tool() { return this.ptool }
  requiresLocalRuntime() { return this.localRuntime }
  capabilities() { return this.caps }
  provenance(): ProviderProvenance { return { provider_version: 'mock-v1', model: 'mock-model', model_sha256: 'mock-sha' } }
  async health(): Promise<ProviderHealth> { return { healthy: this.healthy, detail: this.healthy ? 'ok' : 'down' } }
  async submit(request: CreativeGenerationRequest): Promise<ProviderSubmission> {
    if (this.failWith) throw this.failWith
    this.submitted.push(request)
    return { provider_job_id: 'prov-' + this.submitted.length }
  }
  async fetchStatus(): Promise<ProviderJobUpdate> { return this.fetchResult }
}

function makeRouter(providers: CreativeProvider[]) {
  const repo = new InMemoryCreativeJobRepository()
  const router = new CreativeRouter(repo, null)
  providers.forEach(p => router.register(p))
  return { repo, router }
}

async function waitFor(cond: () => Promise<boolean>, timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await cond()) return
    await new Promise(r => setTimeout(r, 25))
  }
  throw new Error('waitFor timeout')
}

// --- validação -------------------------------------------------------------

test('validação: prompt ausente → INVALID_REQUEST', () => {
  assert.strictEqual(validateRequest(baseRequest({ prompt: '' }))?.code, 'INVALID_REQUEST')
})

test('validação: kind video → INVALID_REQUEST', () => {
  assert.strictEqual(validateRequest(baseRequest({ kind: 'video' as any }))?.code, 'INVALID_REQUEST')
})

test('validação: capability desconhecida → UNSUPPORTED_CAPABILITY', () => {
  assert.strictEqual(validateRequest(baseRequest({ capability: 'creative.video.cloud' }))?.code, 'UNSUPPORTED_CAPABILITY')
})

test('validação: dimensões e seed válidos passam', () => {
  assert.strictEqual(validateRequest(baseRequest({ width: 768, height: 768, seed: 42 })), null)
})

// --- repository CRUD -------------------------------------------------------

test('repository (memory): create/get/attach/complete/fail/listInFlight', async () => {
  const repo = new InMemoryCreativeJobRepository()
  const req = baseRequest({ request_id: 'r-crud' }) as CreativeGenerationRequest
  await repo.create({ id: 'j1', request: req, prompt_hash: 'h', status: 'queued', routing_reason: 'test' })
  assert.strictEqual((await repo.getById('j1'))!.status, 'queued')
  assert.strictEqual((await repo.getByRequestId('r-crud'))!.id, 'j1')
  await repo.attachProviderJob('j1', 'local', 'p1')
  assert.strictEqual((await repo.getById('j1'))!.provider_job_id, 'p1')
  await repo.updateStatus('j1', 'running')
  assert.strictEqual((await repo.listInFlight()).length, 1)
  await repo.complete('j1', { asset_path: 'a.png', asset_mime: 'image/png', asset_bytes: 10, seed: 5, billing_cost_usd: 0, width: 768, height: 768 })
  const done = await repo.getById('j1')
  assert.strictEqual(done!.status, 'completed')
  assert.strictEqual(done!.asset_bytes, 10)
  assert.strictEqual((await repo.listInFlight()).length, 0)
  await repo.create({ id: 'j2', request: { ...req, request_id: 'r2' }, prompt_hash: 'h', status: 'queued', routing_reason: 'test' })
  await repo.fail('j2', 'GENERATION_FAILED', 'x', true)
  assert.strictEqual((await repo.getById('j2'))!.error_code, 'GENERATION_FAILED')
})

// --- seleção / política ----------------------------------------------------

test('seleção: capability local roteia para provider local (routing_reason registrado)', async () => {
  const local = new MockProvider()
  const { repo, router } = makeRouter([local])
  const res = await router.submit(baseRequest())
  assert.notStrictEqual(res.status, 'failed')
  await waitFor(async () => (await repo.getById(res.job_id))?.status === 'completed')
  const rec = await repo.getById(res.job_id)
  assert.strictEqual(rec!.routing_reason, 'capability_local_mandatory')
  assert.strictEqual(local.submitted.length, 1)
})

test('política: privacy local-only + capability cloud → INVALID_REQUEST', async () => {
  const { router } = makeRouter([new MockProvider()])
  const res = await router.submit(baseRequest({
    capability: CAPABILITY_IMAGE_CLOUD, skill: SKILL_IMAGE_GENERATE_CLOUD,
    constraints: { privacy: 'local-only' }
  }))
  assert.strictEqual(res.error?.code, 'INVALID_REQUEST')
})

test('sem fallback silencioso: cloud indisponível NÃO cai para local', async () => {
  const local = new MockProvider()
  const cloud = new MockProvider('cloud-google', 'gemini-image',
    [{ capability: CAPABILITY_IMAGE_CLOUD, skill: SKILL_IMAGE_GENERATE_CLOUD, kind: 'image' }])
  cloud.failWith = err('PROVIDER_UNAVAILABLE', 'credencial cloud não configurada', false)
  const { repo, router } = makeRouter([local, cloud])
  const res = await router.submit(baseRequest({ capability: CAPABILITY_IMAGE_CLOUD, skill: SKILL_IMAGE_GENERATE_CLOUD }))
  await waitFor(async () => (await repo.getById(res.job_id))?.status === 'failed')
  const rec = await repo.getById(res.job_id)
  assert.strictEqual(rec!.error_code, 'PROVIDER_UNAVAILABLE')
  assert.strictEqual(rec!.fallback_used, false)
  assert.strictEqual(local.submitted.length, 0)   // NUNCA tentou o local
})

// --- idempotência ----------------------------------------------------------

test('idempotência: mesmo request_id + payload equivalente → mesmo job, sem segunda geração', async () => {
  const local = new MockProvider()
  const { repo, router } = makeRouter([local])
  const req = baseRequest({ request_id: 'idem-1', seed: 7 })
  const a = await router.submit(req)
  await waitFor(async () => (await repo.getById(a.job_id))?.status === 'completed')
  const b = await router.submit({ ...req })
  assert.strictEqual(b.job_id, a.job_id)
  assert.strictEqual(local.submitted.length, 1)
})

test('idempotência: mesmo request_id + payload conflitante → IDEMPOTENCY_CONFLICT', async () => {
  const { repo, router } = makeRouter([new MockProvider()])
  const req = baseRequest({ request_id: 'idem-2', seed: 7 })
  const a = await router.submit(req)
  await waitFor(async () => (await repo.getById(a.job_id))?.status === 'completed')
  const b = await router.submit({ ...req, prompt: 'OUTRO prompt totalmente diferente' })
  assert.strictEqual(b.status, 'failed')
  assert.strictEqual(b.error?.code, 'IDEMPOTENCY_CONFLICT')
})

// --- erros normalizados ----------------------------------------------------

test('exceção crua do provider vira GENERATION_FAILED normalizado sem traceback', async () => {
  const local = new MockProvider()
  local.failWith = new Error('stacktrace interno detalhado')
  const { repo, router } = makeRouter([local])
  const res = await router.submit(baseRequest())
  await waitFor(async () => (await repo.getById(res.job_id))?.status === 'failed')
  const job = await router.getJob(res.job_id)
  assert.strictEqual(job!.error?.code, 'GENERATION_FAILED')
  assert.ok(!job!.error!.message.includes('stacktrace'))
})

// --- resultado normalizado -------------------------------------------------

test('resultado completed carrega o contrato normalizado completo', async () => {
  const { repo, router } = makeRouter([new MockProvider()])
  const res = await router.submit(baseRequest({ seed: 99 }))
  await waitFor(async () => (await repo.getById(res.job_id))?.status === 'completed')
  const job = await router.getJob(res.job_id)
  assert.strictEqual(job!.status, 'completed')
  assert.strictEqual(job!.provider?.tool, 'comfyui-local')
  assert.strictEqual(job!.asset?.mime_type, 'image/png')
  assert.strictEqual(job!.cost?.billing_cost_usd, 0)
  assert.strictEqual(job!.cost?.compute_cost_estimate, null)
  assert.ok(job!.generation?.prompt_hash)
  assert.strictEqual(job!.provenance?.model_sha256, 'mock-sha')
})

test('job desconhecido → null (rota 404 normalizada)', async () => {
  const { router } = makeRouter([new MockProvider()])
  assert.strictEqual(await router.getJob('nao-existe'), null)
})

// --- reconciliação pós-restart --------------------------------------------

test('reconciliação: in-flight com provider indisponível → PROVIDER_STATE_LOST retryable', async () => {
  const local = new MockProvider()
  local.healthy = false
  const { repo, router } = makeRouter([local])
  const req = baseRequest({ request_id: 'rec-1' }) as CreativeGenerationRequest
  await repo.create({ id: 'jr1', request: req, prompt_hash: 'h', status: 'running', routing_reason: 't' })
  await repo.attachProviderJob('jr1', 'local', 'lost-provider-id')
  await repo.updateStatus('jr1', 'running')
  await router.reconcile()
  const rec = await repo.getById('jr1')
  assert.strictEqual(rec!.status, 'failed')
  assert.strictEqual(rec!.error_code, 'PROVIDER_STATE_LOST')
  assert.strictEqual(rec!.retryable, true)
})

test('reconciliação: provider saudável com job completo → complete sem regenerar', async () => {
  const local = new MockProvider()
  const { repo, router } = makeRouter([local])
  const req = baseRequest({ request_id: 'rec-2' }) as CreativeGenerationRequest
  await repo.create({ id: 'jr2', request: req, prompt_hash: 'h', status: 'running', routing_reason: 't' })
  await repo.attachProviderJob('jr2', 'local', 'prov-x')
  await repo.updateStatus('jr2', 'running')
  await router.reconcile()
  const rec = await repo.getById('jr2')
  assert.strictEqual(rec!.status, 'completed')
  assert.strictEqual(local.submitted.length, 0)   // nada foi re-submetido
})

// --- health ----------------------------------------------------------------

test('providersHealth agrega estado real', async () => {
  const ok = new MockProvider()
  const down = new MockProvider('cloud-google', 'gemini-image',
    [{ capability: CAPABILITY_IMAGE_CLOUD, skill: SKILL_IMAGE_GENERATE_CLOUD, kind: 'image' }])
  down.healthy = false
  const { router } = makeRouter([ok, down])
  const report = await router.providersHealth()
  assert.strictEqual(report.length, 2)
  assert.strictEqual(report[0].healthy, true)
  assert.strictEqual(report[1].healthy, false)
})

// --- cloud cost gate --------------------------------------------------------

test('cloud cost gate: custo estimado acima do teto → recusa sem chamar API', async () => {
  process.env.GEMINI_API_KEY = 'dummy-for-gate-test'
  process.env.GOOGLE_IMAGE_COST_USD = '1.00'
  process.env.MAX_CLOUD_TEST_COST_USD = '0.25'
  const p = new GoogleImageProvider()
  await assert.rejects(
    () => p.submit(baseRequest({ capability: CAPABILITY_IMAGE_CLOUD, skill: SKILL_IMAGE_GENERATE_CLOUD }) as CreativeGenerationRequest, 'job-x'),
    (e: any) => e.code === 'INVALID_REQUEST' && /gate/.test(e.message)
  )
  delete process.env.GEMINI_API_KEY
  delete process.env.GOOGLE_IMAGE_COST_USD
  delete process.env.MAX_CLOUD_TEST_COST_USD
})

test('cloud sem credencial: submit → PROVIDER_UNAVAILABLE (sem cobrança)', async () => {
  delete process.env.GEMINI_API_KEY
  const p = new GoogleImageProvider()
  await assert.rejects(
    () => p.submit(baseRequest({ capability: CAPABILITY_IMAGE_CLOUD, skill: SKILL_IMAGE_GENERATE_CLOUD }) as CreativeGenerationRequest, 'job-y'),
    (e: any) => e.code === 'PROVIDER_UNAVAILABLE'
  )
})
