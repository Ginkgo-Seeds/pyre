// Abstração de provider criativo (v2 — Wave 9, repository-driven).
// O Router conhece SOMENTE esta interface; local e cloud implementam o mesmo
// contrato e o caller não consegue detectar o provider pelo formato da resposta.

import { CreativeError, CreativeGenerationRequest } from '../creative.contracts'

export interface ProviderCapability {
  capability: string
  skill: string
  kind: string
}

export interface ProviderHealth {
  healthy: boolean
  detail?: string
}

export interface ProviderSubmission {
  provider_job_id: string
}

export interface ProviderJobUpdate {
  phase: 'running' | 'completed' | 'failed'
  asset?: { path: string; mime_type: string; width: number; height: number; bytes: number }
  seed?: number
  billing_cost_usd?: number
  error?: CreativeError
}

export interface ProviderProvenance {
  provider_version: string
  model: string
  model_sha256: string
}

// Wave 10 (§8): elegibilidade de providers no Skill Atlas.
// EXPERIMENTAL nunca é selecionável por requests normais de produção —
// somente em modo eval/test explícito com policy própria.
export type ProviderStatus = 'VALIDATED' | 'EXPERIMENTAL' | 'DISABLED'

export interface CreativeProvider {
  /** Identificador estável (ex.: 'local', 'cloud-google'). */
  id(): string
  /** Ferramenta concreta (ex.: 'comfyui-local', 'gemini-image'). */
  tool(): string
  capabilities(): ProviderCapability[]
  /** true → Router aciona o CreativeRuntimeManager antes do submit. */
  requiresLocalRuntime(): boolean
  /** Status de validação no Atlas (VALIDATED | EXPERIMENTAL | DISABLED). */
  providerStatus(): ProviderStatus
  /** Custo estimado de billing por geração (US$). Local = 0. */
  estimatedCostUsd(): number
  provenance(): ProviderProvenance
  /** Health REAL (endpoint do serviço/credencial), nunca só porta aberta. */
  health(): Promise<ProviderHealth>
  /** Submete; retorna o id interno do provider (nunca exposto ao caller). */
  submit(request: CreativeGenerationRequest, pyreJobId: string): Promise<ProviderSubmission>
  /** Consulta andamento de um job já submetido. */
  fetchStatus(providerJobId: string, ctx: { request: CreativeGenerationRequest; pyreJobId: string }): Promise<ProviderJobUpdate>
}
