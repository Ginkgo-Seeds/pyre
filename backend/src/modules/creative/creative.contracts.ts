// Contratos provider-neutral do Creative Router (Wave 7).
// O caller conhece SOMENTE estes contratos — nunca ComfyUI, node IDs,
// workflow interno, paths de checkpoint, porta 8188 ou Docker.

export type CreativeKind = 'image'

// Arsenal contract desta wave (únicos suportados; futuros: creative.image.cloud, creative.video.cloud)
export const CAPABILITY_IMAGE_LOCAL = 'creative.image.local'
export const SKILL_IMAGE_GENERATE_LOCAL = 'media.image.generate.local'

export interface CreativeConstraints {
  privacy?: 'local-only' | 'cloud-ok'
  latency?: 'interactive' | 'batch'
  quality?: 'draft' | 'standard' | 'premium'
  max_cost?: number
}

export interface CreativeMetadata {
  caller?: string
  campaign_id?: string
  product_id?: string
  tags?: string[]
}

export interface CreativeGenerationRequest {
  request_id: string
  capability: string
  skill: string
  kind: CreativeKind
  prompt: string
  negative_prompt?: string
  width?: number
  height?: number
  seed?: number
  preset?: string
  constraints?: CreativeConstraints
  metadata?: CreativeMetadata
}

export type CreativeErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_UNHEALTHY'
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_CAPABILITY'
  | 'GENERATION_FAILED'
  | 'TIMEOUT'
  | 'ASSET_NOT_FOUND'

export interface CreativeError {
  code: CreativeErrorCode
  message: string
  retryable: boolean
}

export type CreativeJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface CreativeGenerationResult {
  request_id: string
  job_id: string
  status: CreativeJobStatus
  provider?: { id: string; tool: string; model: string }
  asset?: {
    id: string
    path: string
    mime_type: string
    width: number
    height: number
    bytes: number
  }
  generation?: {
    seed: number
    duration_ms: number
    workflow: string
    prompt_hash: string
  }
  cost?: {
    billing_cost_usd: number
    // Não afirmamos custo de computação local = zero; estimativa fica explícita como desconhecida.
    compute_cost_estimate: null
  }
  provenance?: {
    created_at: string
    provider_version: string
    model_sha256: string
  }
  error?: CreativeError
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface CreativePreset {
  width: number
  height: number
  batch: number
  steps: number
  cfg: number
  sampler: string
  scheduler: string
}

export const PRESETS: Record<string, CreativePreset> = {
  // Conservador: 768x768 reduz pressão de RAM/VRAM vs o benchmark 1024 da Wave 6
  // (pico medido em 1024: 7,58/8 GiB VRAM na RTX 4060).
  'sdxl-local-standard': {
    width: 768,
    height: 768,
    batch: 1,
    steps: 20,
    cfg: 6.5,
    sampler: 'euler',
    scheduler: 'normal'
  }
}

export const DEFAULT_PRESET = 'sdxl-local-standard'

// Limites de override permitidos nesta wave
export const MIN_DIMENSION = 256
export const MAX_DIMENSION = 1024

export function err(code: CreativeErrorCode, message: string, retryable = false): CreativeError {
  return { code, message, retryable }
}

// Valida o request normalizado. Retorna null quando válido.
export function validateRequest(req: Partial<CreativeGenerationRequest>): CreativeError | null {
  if (!req || typeof req !== 'object') return err('INVALID_REQUEST', 'corpo do request ausente')
  if (!req.request_id || typeof req.request_id !== 'string')
    return err('INVALID_REQUEST', 'request_id é obrigatório')
  if (!req.capability) return err('INVALID_REQUEST', 'capability é obrigatória')
  if (!req.skill) return err('INVALID_REQUEST', 'skill é obrigatória')
  if (req.kind !== 'image')
    return err('INVALID_REQUEST', `kind '${req.kind}' não suportado nesta versão (somente 'image')`)
  if (!req.prompt || typeof req.prompt !== 'string' || req.prompt.trim().length === 0)
    return err('INVALID_REQUEST', 'prompt é obrigatório')
  if (req.preset && !PRESETS[req.preset])
    return err('INVALID_REQUEST', `preset desconhecido: ${req.preset}`)
  for (const dim of ['width', 'height'] as const) {
    const v = req[dim]
    if (v !== undefined) {
      if (!Number.isInteger(v) || v < MIN_DIMENSION || v > MAX_DIMENSION)
        return err('INVALID_REQUEST', `${dim} deve ser inteiro entre ${MIN_DIMENSION} e ${MAX_DIMENSION}`)
      if (v % 8 !== 0) return err('INVALID_REQUEST', `${dim} deve ser múltiplo de 8`)
    }
  }
  if (req.seed !== undefined && (!Number.isInteger(req.seed) || req.seed < 0))
    return err('INVALID_REQUEST', 'seed deve ser inteiro não-negativo')
  return null
}
