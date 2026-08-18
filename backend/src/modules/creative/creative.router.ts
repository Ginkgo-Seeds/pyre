// Creative Router v2 (Wave 9) — persistência, idempotência, lifecycle e política.
//
// ROUTING POLICY V1 (seção 17):
//   creative.image.local → provider local OBRIGATÓRIO (sem fallback para cloud)
//   creative.image.cloud → provider cloud OBRIGATÓRIO (sem fallback silencioso p/ local)
//   constraints.privacy = 'local-only' com capability cloud → rejeitado (intenção violada)
//   capability genérica futura → seleção por health/RAM/latency/custo (documentado, não implementado)
// FALLBACK: nesta wave, nunca silencioso; fallback_used sempre registrado (false).

import { createHash, randomUUID } from 'crypto'
import {
  CAPABILITY_IMAGE_LOCAL,
  CreativeError,
  CreativeGenerationRequest,
  CreativeGenerationResult,
  DEFAULT_PRESET,
  SKILL_IMAGE_GENERATE,
  err,
  privacyIsLocalOnly,
  validateRequest
} from './creative.contracts'
import { CreativeJobRecord, CreativeJobRepository } from './creative.repository'
import { CreativeRuntimeManager } from './runtime/creative-runtime.manager'
import { CreativeProvider } from './providers/provider'

export interface ProviderHealthReport {
  id: string
  tool: string
  healthy: boolean
  detail?: string
}

// Lidos por chamada para permitir override em testes (CREATIVE_WATCH_INTERVAL_MS etc.)
const watchIntervalMs = () => Number(process.env.CREATIVE_WATCH_INTERVAL_MS || 5000)
const watchTimeoutMs = () => Number(process.env.CREATIVE_WATCH_TIMEOUT_MS || 300000)

export class CreativeRouter {
  private providers: CreativeProvider[] = []

  constructor(
    private repo: CreativeJobRepository,
    private runtime: CreativeRuntimeManager | null
  ) {}

  register(provider: CreativeProvider): void {
    this.providers.push(provider)
  }

  providerById(id: string): CreativeProvider | undefined {
    return this.providers.find(p => p.id() === id)
  }

  /** Routing V3 (Wave 10): goal → skill → constraints → eligible providers → policy → provider.
   *  Somente providers VALIDATED são elegíveis em produção; EXPERIMENTAL exige modo eval
   *  explícito (CREATIVE_EVAL_MODE=true). Zero fallback silencioso. */
  select(request: CreativeGenerationRequest): { provider: CreativeProvider; routing_reason: string; resolvedCapability: string } | CreativeError {
    const evalMode = process.env.CREATIVE_EVAL_MODE === 'true'

    // ---- Skill genérica: media.image.generate --------------------------------
    if (request.skill === SKILL_IMAGE_GENERATE) {
      const c = request.constraints || {}
      const maxCost = c.max_cost_usd ?? c.max_cost
      const reasons: string[] = ['generic_policy=validated_only']
      const excluded: string[] = []
      let eligible = this.providers.filter(p => p.capabilities().some(cap => cap.kind === request.kind))
      eligible = eligible.filter(p => {
        const st = p.providerStatus()
        if (st === 'VALIDATED') return true
        if (st === 'EXPERIMENTAL' && evalMode) { reasons.push(`eval_mode_includes=${p.id()}`); return true }
        excluded.push(`${p.id()}:${st}`)
        return false
      })
      if (privacyIsLocalOnly(c)) { eligible = eligible.filter(p => p.requiresLocalRuntime()); reasons.push('privacy=local_only') }
      if (c.residency === 'local') { eligible = eligible.filter(p => p.requiresLocalRuntime()); reasons.push('residency=local') }
      if (maxCost !== undefined) {
        const before = eligible.length
        eligible = eligible.filter(p => p.estimatedCostUsd() <= maxCost)
        if (eligible.length < before) reasons.push(`max_cost_usd=${maxCost}_excluded_paid`)
      }
      if (excluded.length) reasons.push(`ineligible=[${excluded.join(',')}]`)
      if (eligible.length === 0) {
        return err('NO_VALIDATED_PROVIDER',
          `nenhum provider VALIDATED satisfaz as constraints do request (${reasons.join('; ')})`, false)
      }
      // Preferência determinística: local primeiro (custo zero + privacidade por padrão)
      const provider = eligible.find(p => p.requiresLocalRuntime()) ?? eligible[0]
      reasons.push(`selected=${provider.id()}:${provider.providerStatus()}`)
      const resolvedCapability = provider.capabilities().find(cap => cap.kind === request.kind)!.capability
      return { provider, routing_reason: reasons.join('; '), resolvedCapability }
    }

    // ---- Capabilities específicas (compat Waves 7–9) -------------------------
    if (privacyIsLocalOnly(request.constraints) && request.capability !== CAPABILITY_IMAGE_LOCAL) {
      return err('INVALID_REQUEST', "constraints.privacy=local_only exige capability creative.image.local", false)
    }
    const match = this.providers.find(p =>
      p.capabilities().some(c =>
        c.capability === request.capability && c.skill === request.skill && c.kind === request.kind))
    if (!match) {
      return err('UNSUPPORTED_CAPABILITY',
        `nenhum provider atende capability='${request.capability}' skill='${request.skill}' kind='${request.kind}'`)
    }
    if (match.providerStatus() !== 'VALIDATED' && !evalMode) {
      return err('NO_VALIDATED_PROVIDER',
        `provider '${match.id()}' está ${match.providerStatus()} — elegível somente em modo eval explícito`, false)
    }
    const reason = (request.capability === CAPABILITY_IMAGE_LOCAL
      ? 'capability_local_mandatory' : 'capability_cloud_mandatory')
      + `; selected=${match.id()}:${match.providerStatus()}` + (evalMode && match.providerStatus() !== 'VALIDATED' ? '; eval_mode' : '')
    return { provider: match, routing_reason: reason, resolvedCapability: request.capability }
  }

  private promptHash(request: CreativeGenerationRequest): string {
    return createHash('sha256').update(request.prompt, 'utf8').digest('hex')
  }

  /** request_id = idempotency key (seção 6). Compara os valores PEDIDOS (imutáveis,
   *  preservados em metadata._requested) — nunca os resolvidos pós-conclusão. */
  private semanticallyEqual(existing: CreativeJobRecord, req: CreativeGenerationRequest): boolean {
    const requested = (existing.metadata as any)?._requested
      ?? { seed: existing.seed ?? null, width: existing.width ?? null, height: existing.height ?? null }
    // Skill genérica: capability persistida é a RESOLVIDA pelo Router; replay compara pela skill.
    const capabilityMatches = req.skill === SKILL_IMAGE_GENERATE
      ? true : existing.capability === req.capability
    return existing.prompt_hash === this.promptHash(req)
      && capabilityMatches
      && existing.skill === req.skill
      && (existing.preset ?? DEFAULT_PRESET) === (req.preset ?? DEFAULT_PRESET)
      && (requested.seed ?? null) === (req.seed ?? null)
      && (requested.width ?? null) === (req.width ?? null)
      && (requested.height ?? null) === (req.height ?? null)
  }

  async submit(raw: Partial<CreativeGenerationRequest>): Promise<CreativeGenerationResult> {
    const invalid = validateRequest(raw)
    if (invalid) return this.failure(raw, invalid)
    const request = raw as CreativeGenerationRequest

    const existing = await this.repo.getByRequestId(request.request_id)
    if (existing) {
      if (this.semanticallyEqual(existing, request)) {
        this.slog('idempotent_replay', existing)
        return this.recordToResult(existing)
      }
      return this.failure(request, err('IDEMPOTENCY_CONFLICT',
        `request_id '${request.request_id}' já existe com payload diferente`, false))
    }

    const selected = this.select(request)
    if ('code' in selected) return this.failure(request, selected)
    const { provider, routing_reason, resolvedCapability } = selected

    const jobId = randomUUID()
    const persistedRequest: CreativeGenerationRequest = {
      ...request,
      capability: resolvedCapability,   // skill genérica: capability resolvida pelo Router
      metadata: {
        ...(request.metadata || {}),
        _requested: { seed: request.seed ?? null, width: request.width ?? null, height: request.height ?? null }
      } as any
    }
    const rec = await this.repo.create({
      id: jobId, request: persistedRequest, prompt_hash: this.promptHash(request),
      status: provider.requiresLocalRuntime() ? 'starting_runtime' : 'queued',
      routing_reason
    })
    this.slog('job_created', rec)

    // Pipeline assíncrono: POST retorna imediatamente; watchdog interno conclui o job
    // mesmo se o caller nunca fizer polling (necessário para o lifecycle/TTL).
    void this.pipeline(provider, request, jobId).catch(async (e: any) => {
      const ce: CreativeError = (e && typeof e.code === 'string') ? e : err('GENERATION_FAILED', 'falha interna no pipeline', true)
      await this.repo.fail(jobId, ce.code, ce.message, ce.retryable)
      this.slog('job_failed', await this.repo.getById(jobId))
      if (provider.requiresLocalRuntime()) this.runtime?.jobFinished()
    })

    return { request_id: request.request_id, job_id: jobId, status: rec.status }
  }

  private async pipeline(provider: CreativeProvider, request: CreativeGenerationRequest, jobId: string): Promise<void> {
    if (provider.requiresLocalRuntime() && this.runtime) {
      await this.runtime.ensureAvailable()
      this.runtime.jobStarted()
    }
    const sub = await provider.submit(request, jobId)
    await this.repo.attachProviderJob(jobId, provider.id(), sub.provider_job_id)
    await this.repo.updateStatus(jobId, 'running')

    const deadline = Date.now() + watchTimeoutMs()
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, watchIntervalMs()))
      const update = await provider.fetchStatus(sub.provider_job_id, { request, pyreJobId: jobId })
      if (update.phase === 'completed' && update.asset) {
        await this.repo.complete(jobId, {
          asset_path: update.asset.path, asset_mime: update.asset.mime_type,
          asset_bytes: update.asset.bytes, seed: update.seed ?? request.seed ?? 0,
          billing_cost_usd: update.billing_cost_usd ?? 0,
          width: update.asset.width, height: update.asset.height
        })
        this.slog('job_completed', await this.repo.getById(jobId))
        if (provider.requiresLocalRuntime()) this.runtime?.jobFinished()
        return
      }
      if (update.phase === 'failed') {
        const e = update.error ?? err('GENERATION_FAILED', 'falha reportada pelo provider', true)
        await this.repo.fail(jobId, e.code, e.message, e.retryable)
        this.slog('job_failed', await this.repo.getById(jobId))
        if (provider.requiresLocalRuntime()) this.runtime?.jobFinished()
        return
      }
    }
    await this.repo.fail(jobId, 'TIMEOUT', 'geração excedeu o watchdog interno (300s)', true)
    this.slog('job_timeout', await this.repo.getById(jobId))
    if (provider.requiresLocalRuntime()) this.runtime?.jobFinished()
  }

  async getJob(jobId: string): Promise<CreativeGenerationResult | null> {
    const rec = await this.repo.getById(jobId)
    if (!rec) return null
    return this.recordToResult(rec)
  }

  /** Reconciliação pós-restart (seção 5): sem re-execução automática. */
  async reconcile(): Promise<number> {
    const inflight = await this.repo.listInFlight()
    let reconciled = 0
    for (const job of inflight) {
      reconciled++
      const provider = job.provider_id ? this.providerById(job.provider_id) : undefined
      if (provider && job.provider_job_id) {
        const healthy = (await provider.health()).healthy
        if (healthy) {
          try {
            const update = await provider.fetchStatus(job.provider_job_id, {
              request: this.recordToRequest(job), pyreJobId: job.id
            })
            if (update.phase === 'completed' && update.asset) {
              await this.repo.complete(job.id, {
                asset_path: update.asset.path, asset_mime: update.asset.mime_type,
                asset_bytes: update.asset.bytes, seed: update.seed ?? job.seed ?? 0,
                billing_cost_usd: update.billing_cost_usd ?? 0,
                width: update.asset.width, height: update.asset.height
              })
              continue
            }
            if (update.phase === 'running') continue   // provider ainda processa; watchdog não é retomado — ficará para consulta manual
          } catch { /* cai no state-lost abaixo */ }
        }
      }
      await this.repo.fail(job.id, 'PROVIDER_STATE_LOST',
        'job estava em voo durante restart do Pyre; estado do provider indisponível', true)
    }
    if (reconciled) console.log(JSON.stringify({ component: 'creative-router', event: 'reconciled', jobs: reconciled }))
    return reconciled
  }

  async providersHealth(): Promise<ProviderHealthReport[]> {
    return Promise.all(this.providers.map(async p => {
      try {
        const h = await p.health()
        return { id: p.id(), tool: p.tool(), healthy: h.healthy, detail: h.detail }
      } catch {
        return { id: p.id(), tool: p.tool(), healthy: false, detail: 'health check falhou' }
      }
    }))
  }

  // -------------------------------------------------------------------------

  private recordToRequest(rec: CreativeJobRecord): CreativeGenerationRequest {
    return {
      request_id: rec.request_id, capability: rec.capability, skill: rec.skill,
      kind: rec.kind as 'image', prompt: rec.prompt,
      negative_prompt: rec.negative_prompt ?? undefined,
      width: rec.width ?? undefined, height: rec.height ?? undefined,
      seed: rec.seed ?? undefined, preset: rec.preset ?? undefined,
      metadata: (rec.metadata as any) ?? undefined
    }
  }

  recordToResult(rec: CreativeJobRecord): CreativeGenerationResult {
    const provider = rec.provider_id ? this.providerById(rec.provider_id) : undefined
    const result: CreativeGenerationResult = {
      request_id: rec.request_id,
      job_id: rec.id,
      status: rec.status
    }
    if (provider) {
      const p = provider.provenance()
      result.provider = { id: provider.id(), tool: provider.tool(), model: p.model }
      if (rec.status === 'completed') {
        result.provenance = { created_at: rec.completed_at ?? rec.updated_at, provider_version: p.provider_version, model_sha256: p.model_sha256 }
      }
    }
    if (rec.status === 'completed' && rec.asset_path) {
      result.asset = {
        id: rec.asset_path.split(/[\\/]/).pop() || rec.id,
        path: rec.asset_path, mime_type: rec.asset_mime || 'image/png',
        width: rec.width ?? 0, height: rec.height ?? 0, bytes: rec.asset_bytes ?? 0
      }
      result.generation = {
        seed: rec.seed ?? 0,
        duration_ms: (rec.completed_at && rec.created_at)
          ? Math.max(0, new Date(rec.completed_at).getTime() - new Date(rec.created_at).getTime()) : 0,
        workflow: rec.provider_id === 'local' ? 'sdxl-txt2img-v1' : 'cloud-txt2img-v1',
        prompt_hash: rec.prompt_hash
      }
      result.cost = { billing_cost_usd: rec.billing_cost_usd ?? 0, compute_cost_estimate: null }
    }
    if (rec.status === 'failed' && rec.error_code) {
      result.error = { code: rec.error_code as any, message: rec.error_message || 'falha', retryable: rec.retryable ?? false }
    }
    return result
  }

  private failure(raw: Partial<CreativeGenerationRequest>, error: CreativeError): CreativeGenerationResult {
    return { request_id: raw.request_id || 'unknown', job_id: '', status: 'failed', error }
  }

  private slog(event: string, rec: CreativeJobRecord | null): void {
    if (!rec) return
    console.log(JSON.stringify({
      component: 'creative-router', event,
      request_id: rec.request_id, job_id: rec.id,
      capability: rec.capability, skill: rec.skill,
      provider: rec.provider_id, routing_reason: rec.routing_reason,
      provider_status: rec.provider_id ? this.providerById(rec.provider_id)?.providerStatus() : undefined,
      status: rec.status, runtime_state: this.runtime?.getState() ?? 'n/a',
      duration_ms: (rec.completed_at && rec.created_at)
        ? new Date(rec.completed_at).getTime() - new Date(rec.created_at).getTime() : undefined,
      billing_cost: rec.billing_cost_usd ?? undefined,
      fallback_used: rec.fallback_used,
      shutdown_reason: this.runtime?.getLastShutdownReason() ?? undefined,
      error_code: rec.error_code ?? undefined
    }))
  }
}
