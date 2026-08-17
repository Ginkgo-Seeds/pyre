// Creative Router v1 — seleção de provider por capability+skill.
// Sem heurística complexa nesta versão: match exato. A estrutura já comporta
// providers futuros (creative.image.cloud, creative.video.cloud) — basta
// registrar novos CreativeProvider; Router e callers não mudam.

import {
  CreativeError,
  CreativeGenerationRequest,
  CreativeGenerationResult,
  err,
  validateRequest
} from './creative.contracts'
import { CreativeProvider } from './providers/provider'

export interface ProviderHealthReport {
  id: string
  tool: string
  healthy: boolean
  detail?: string
}

export class CreativeRouter {
  private providers: CreativeProvider[] = []
  // job_id -> provider dono (o prompt_id interno do provider nunca aparece aqui)
  private jobOwners = new Map<string, CreativeProvider>()

  register(provider: CreativeProvider): void {
    this.providers.push(provider)
  }

  /** Seleciona provider por match exato de capability+skill+kind. */
  select(request: CreativeGenerationRequest): CreativeProvider | CreativeError {
    const match = this.providers.find(p =>
      p.capabilities().some(c =>
        c.capability === request.capability && c.skill === request.skill && c.kind === request.kind
      )
    )
    if (!match) {
      return err(
        'UNSUPPORTED_CAPABILITY',
        `nenhum provider atende capability='${request.capability}' skill='${request.skill}' kind='${request.kind}'`
      )
    }
    return match
  }

  async submit(raw: Partial<CreativeGenerationRequest>): Promise<CreativeGenerationResult> {
    const invalid = validateRequest(raw)
    if (invalid) return this.failure(raw, invalid)
    const request = raw as CreativeGenerationRequest

    const selected = this.select(request)
    if ('code' in selected) return this.failure(request, selected)

    try {
      const jobId = await selected.submit(request)
      this.jobOwners.set(jobId, selected)
      return { request_id: request.request_id, job_id: jobId, status: 'queued' }
    } catch (e: any) {
      // Providers lançam CreativeError; qualquer outra coisa vira erro normalizado
      // (nunca traceback bruto para o caller — detalhes ficam no log interno).
      if (e && typeof e.code === 'string' && typeof e.retryable === 'boolean') {
        return this.failure(request, e as CreativeError)
      }
      console.error('[creative][router] erro não normalizado no submit:', e)
      return this.failure(request, err('GENERATION_FAILED', 'falha interna ao submeter a geração', true))
    }
  }

  async getJob(jobId: string): Promise<CreativeGenerationResult | null> {
    const owner = this.jobOwners.get(jobId)
    if (!owner) return null
    try {
      return await owner.status(jobId)
    } catch (e: any) {
      if (e && typeof e.code === 'string') {
        return { request_id: 'unknown', job_id: jobId, status: 'failed', error: e as CreativeError }
      }
      console.error('[creative][router] erro não normalizado no status:', e)
      return {
        request_id: 'unknown', job_id: jobId, status: 'failed',
        error: err('GENERATION_FAILED', 'falha interna ao consultar o job', true)
      }
    }
  }

  async providersHealth(): Promise<ProviderHealthReport[]> {
    return Promise.all(
      this.providers.map(async p => {
        try {
          const h = await p.health()
          return { id: p.id(), tool: p.tool(), healthy: h.healthy, detail: h.detail }
        } catch {
          return { id: p.id(), tool: p.tool(), healthy: false, detail: 'health check falhou' }
        }
      })
    )
  }

  private failure(raw: Partial<CreativeGenerationRequest>, error: CreativeError): CreativeGenerationResult {
    return {
      request_id: raw.request_id || 'unknown',
      job_id: '',
      status: 'failed',
      error
    }
  }
}
