// Testes unitários do Creative Router — SEM dependência de GPU/ComfyUI.
// Runner: node:test via `npm test` (node --require ts-node/register --test).

import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  CAPABILITY_IMAGE_LOCAL,
  SKILL_IMAGE_GENERATE_LOCAL,
  CreativeGenerationRequest,
  CreativeGenerationResult,
  err,
  validateRequest
} from './creative.contracts'
import { CreativeRouter } from './creative.router'
import { CreativeProvider, ProviderCapability, ProviderHealth } from './providers/provider'

function baseRequest(overrides: Partial<CreativeGenerationRequest> = {}): Partial<CreativeGenerationRequest> {
  return {
    request_id: 'req-1',
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

  id() { return 'local' }
  tool() { return 'comfyui-local' }
  capabilities(): ProviderCapability[] {
    return [{ capability: CAPABILITY_IMAGE_LOCAL, skill: SKILL_IMAGE_GENERATE_LOCAL, kind: 'image' }]
  }
  async health(): Promise<ProviderHealth> {
    return { healthy: this.healthy, detail: this.healthy ? 'ok' : 'down' }
  }
  async submit(request: CreativeGenerationRequest): Promise<string> {
    if (this.failWith) throw this.failWith
    this.submitted.push(request)
    return 'job-123'
  }
  async status(jobId: string): Promise<CreativeGenerationResult> {
    return {
      request_id: 'req-1',
      job_id: jobId,
      status: 'completed',
      provider: { id: this.id(), tool: this.tool(), model: 'sd_xl_base_1.0.safetensors' },
      asset: { id: 'x.png', path: 'C:\\out\\x.png', mime_type: 'image/png', width: 768, height: 768, bytes: 1000 },
      generation: { seed: 1, duration_ms: 100, workflow: 'sdxl-txt2img-v1', prompt_hash: 'abc' },
      cost: { billing_cost_usd: 0, compute_cost_estimate: null },
      provenance: { created_at: 'now', provider_version: 'v', model_sha256: 'sha' }
    }
  }
  async result(jobId: string) { return this.status(jobId) }
}

// --- validação -------------------------------------------------------------

test('validação: prompt ausente → INVALID_REQUEST', () => {
  const e = validateRequest(baseRequest({ prompt: '' }))
  assert.strictEqual(e?.code, 'INVALID_REQUEST')
})

test('validação: kind video não suportado nesta wave → INVALID_REQUEST', () => {
  const e = validateRequest(baseRequest({ kind: 'video' as any }))
  assert.strictEqual(e?.code, 'INVALID_REQUEST')
})

test('validação: dimensões fora do limite (>1024) → INVALID_REQUEST', () => {
  const e = validateRequest(baseRequest({ width: 2048 }))
  assert.strictEqual(e?.code, 'INVALID_REQUEST')
})

test('validação: dimensão não múltipla de 8 → INVALID_REQUEST', () => {
  const e = validateRequest(baseRequest({ height: 770 }))
  assert.strictEqual(e?.code, 'INVALID_REQUEST')
})

test('validação: request válido passa', () => {
  assert.strictEqual(validateRequest(baseRequest({ width: 768, height: 768, seed: 42 })), null)
})

// --- seleção de provider ---------------------------------------------------

test('capability desconhecida → UNSUPPORTED_CAPABILITY', async () => {
  const router = new CreativeRouter()
  router.register(new MockProvider())
  const res = await router.submit(baseRequest({ capability: 'creative.video.cloud', skill: 'media.video.generate' }))
  assert.strictEqual(res.status, 'failed')
  assert.strictEqual(res.error?.code, 'UNSUPPORTED_CAPABILITY')
})

test('seleção: capability+skill corretas roteiam para o provider e devolvem job queued', async () => {
  const router = new CreativeRouter()
  const mock = new MockProvider()
  router.register(mock)
  const res = await router.submit(baseRequest())
  assert.strictEqual(res.status, 'queued')
  assert.strictEqual(res.job_id, 'job-123')
  assert.strictEqual(mock.submitted.length, 1)
  assert.strictEqual(mock.submitted[0].prompt, 'uma árvore ginkgo')
})

// --- erros normalizados ----------------------------------------------------

test('erro normalizado do provider é repassado como contrato (PROVIDER_UNHEALTHY)', async () => {
  const router = new CreativeRouter()
  const mock = new MockProvider()
  mock.failWith = err('PROVIDER_UNHEALTHY', 'runtime local indisponível', true)
  router.register(mock)
  const res = await router.submit(baseRequest())
  assert.strictEqual(res.status, 'failed')
  assert.strictEqual(res.error?.code, 'PROVIDER_UNHEALTHY')
  assert.strictEqual(res.error?.retryable, true)
})

test('exceção crua do provider vira GENERATION_FAILED normalizado (sem traceback)', async () => {
  const router = new CreativeRouter()
  const mock = new MockProvider()
  mock.failWith = new Error('stacktrace interno detalhado')
  router.register(mock)
  const res = await router.submit(baseRequest())
  assert.strictEqual(res.status, 'failed')
  assert.strictEqual(res.error?.code, 'GENERATION_FAILED')
  assert.ok(!res.error?.message.includes('stacktrace'))
})

// --- resultado normalizado -------------------------------------------------

test('resultado completed carrega o contrato normalizado completo', async () => {
  const router = new CreativeRouter()
  const mock = new MockProvider()
  router.register(mock)
  const sub = await router.submit(baseRequest())
  const res = await router.getJob(sub.job_id)
  assert.ok(res)
  assert.strictEqual(res!.status, 'completed')
  assert.strictEqual(res!.provider?.tool, 'comfyui-local')
  assert.strictEqual(res!.asset?.mime_type, 'image/png')
  assert.strictEqual(res!.cost?.billing_cost_usd, 0)
  assert.strictEqual(res!.cost?.compute_cost_estimate, null)
  assert.ok(res!.generation?.prompt_hash)
})

test('job desconhecido → null (rota devolve 404 normalizado)', async () => {
  const router = new CreativeRouter()
  router.register(new MockProvider())
  assert.strictEqual(await router.getJob('nao-existe'), null)
})

// --- health routing ---------------------------------------------------------

test('providersHealth agrega estado real dos providers', async () => {
  const router = new CreativeRouter()
  const ok = new MockProvider()
  const down = new MockProvider()
  down.healthy = false
  router.register(ok)
  router.register(down)
  const report = await router.providersHealth()
  assert.strictEqual(report.length, 2)
  assert.strictEqual(report[0].healthy, true)
  assert.strictEqual(report[1].healthy, false)
  assert.strictEqual(report[0].tool, 'comfyui-local')
})
