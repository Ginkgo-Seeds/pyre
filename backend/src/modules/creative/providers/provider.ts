// Abstração de provider criativo. O Router conhece SOMENTE esta interface.
// Providers futuros (fal.ai, Higgsfield, Google image/video) implementam o
// mesmo contrato sem que o Router ou os callers mudem.

import { CreativeGenerationRequest, CreativeGenerationResult } from '../creative.contracts'

export interface ProviderCapability {
  capability: string
  skill: string
  kind: string
}

export interface ProviderHealth {
  healthy: boolean
  detail?: string
}

export interface CreativeProvider {
  /** Identificador estável do provider (ex.: 'local'). */
  id(): string
  /** Ferramenta concreta por trás do provider (ex.: 'comfyui-local'). */
  tool(): string
  /** Pares capability/skill/kind que este provider atende. */
  capabilities(): ProviderCapability[]
  /** Health check REAL (endpoint do serviço, não apenas porta aberta). */
  health(): Promise<ProviderHealth>
  /** Submete um request validado; retorna o job_id do Pyre. */
  submit(request: CreativeGenerationRequest): Promise<string>
  /** Estado atual do job (pode ainda estar rodando). */
  status(jobId: string): Promise<CreativeGenerationResult>
  /** Resultado final normalizado (igual a status quando concluído). */
  result(jobId: string): Promise<CreativeGenerationResult>
}
