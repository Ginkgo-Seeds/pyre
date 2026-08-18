// GoogleImageProvider — primeiro provider CLOUD (Wave 9), mesma abstração do local.
//
// Seleção (seção 14): fal.ai era a preferência operacional mas NÃO possui credencial
// nesta workstation; Higgsfield idem. A credencial disponível é GEMINI_API_KEY
// (API oficial Google Gemini). Modelo PINADO: gemini-2.5-flash-image (geração de
// imagem; ~US$0,039/imagem — abaixo do gate). O service legado nanoBanana.ts usa um
// agregador terceirizado sem credencial local e por isso não foi reutilizado.
//
// Custo (seção 15): submit é recusado se o custo estimado por imagem exceder
// MAX_CLOUD_TEST_COST_USD. billing_cost_usd é registrado por geração.
//
// Nota de execução: generateContent é síncrono (~5–20s). O submit dispara a chamada
// e guarda a promessa em memória de processo; restart do Pyre no meio de um job
// cloud → reconciliação marca PROVIDER_STATE_LOST (retryable) — política inicial
// documentada da Wave 9 (sem re-execução automática).

import { promises as fs } from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'
import { CAPABILITY_IMAGE_CLOUD, SKILL_IMAGE_GENERATE_CLOUD, CreativeGenerationRequest, err } from '../creative.contracts'
import {
  CreativeProvider, ProviderCapability, ProviderHealth,
  ProviderJobUpdate, ProviderProvenance, ProviderSubmission
} from './provider'

const MODEL = process.env.GOOGLE_IMAGE_MODEL || 'gemini-2.5-flash-image'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const OUTPUT_ROOT = process.env.COMFYUI_OUTPUT_ROOT || 'C:\\AI\\30-Assets\\images\\generated'
const CLOUD_SUBFOLDER = path.join('pyre', 'cloud')
// Lidos por chamada (testáveis via env)
const costPerImageUsd = () => Number(process.env.GOOGLE_IMAGE_COST_USD || 0.039)
const maxCloudTestCostUsd = () => Number(process.env.MAX_CLOUD_TEST_COST_USD || 0.25)

interface PendingCloudJob {
  done: boolean
  update?: ProviderJobUpdate
}

export class GoogleImageProvider implements CreativeProvider {
  private pending = new Map<string, PendingCloudJob>()

  id(): string { return 'cloud-google' }
  tool(): string { return 'gemini-image' }
  requiresLocalRuntime(): boolean { return false }
  // EXPERIMENTAL até um E2E cloud pago bem-sucedido (bloqueio atual: quota 429 — Wave 9).
  providerStatus() { return 'EXPERIMENTAL' as const }
  estimatedCostUsd(): number { return costPerImageUsd() }

  capabilities(): ProviderCapability[] {
    return [{ capability: CAPABILITY_IMAGE_CLOUD, skill: SKILL_IMAGE_GENERATE_CLOUD, kind: 'image' }]
  }

  provenance(): ProviderProvenance {
    return { provider_version: `google-genai:${MODEL}`, model: MODEL, model_sha256: 'n/a-cloud-model' }
  }

  private apiKey(): string | undefined { return process.env.GEMINI_API_KEY }

  async health(): Promise<ProviderHealth> {
    const key = this.apiKey()
    if (!key) return { healthy: false, detail: 'GEMINI_API_KEY ausente (credencial não configurada)' }
    try {
      const res = await fetch(`${API_BASE}/models/${MODEL}`, {
        headers: { 'x-goog-api-key': key },
        signal: AbortSignal.timeout(8000)
      })
      if (!res.ok) return { healthy: false, detail: `models endpoint HTTP ${res.status}` }
      return { healthy: true, detail: `${MODEL} disponível` }
    } catch {
      return { healthy: false, detail: 'sem resposta da API Google' }
    }
  }

  async submit(request: CreativeGenerationRequest, pyreJobId: string): Promise<ProviderSubmission> {
    const key = this.apiKey()
    if (!key) throw err('PROVIDER_UNAVAILABLE', 'credencial cloud não configurada', false)
    if (costPerImageUsd() > maxCloudTestCostUsd()) {
      throw err('INVALID_REQUEST',
        `custo estimado (US$${costPerImageUsd()}) excede o gate MAX_CLOUD_TEST_COST_USD (US$${maxCloudTestCostUsd()})`, false)
    }
    const providerJobId = randomUUID()
    const entry: PendingCloudJob = { done: false }
    this.pending.set(providerJobId, entry)
    void this.generate(request, pyreJobId, key)
      .then(update => { entry.update = update; entry.done = true })
      .catch((e: any) => {
        entry.update = {
          phase: 'failed',
          error: (e && typeof e.code === 'string') ? e : err('GENERATION_FAILED', 'falha na geração cloud', true)
        }
        entry.done = true
      })
    return { provider_job_id: providerJobId }
  }

  async fetchStatus(providerJobId: string): Promise<ProviderJobUpdate> {
    const entry = this.pending.get(providerJobId)
    if (!entry) {
      return { phase: 'failed', error: err('PROVIDER_STATE_LOST', 'estado do job cloud perdido (restart do processo)', true) }
    }
    if (!entry.done) return { phase: 'running' }
    return entry.update!
  }

  private async generate(request: CreativeGenerationRequest, pyreJobId: string, key: string): Promise<ProviderJobUpdate> {
    // gemini-2.5-flash-image trabalha por aspect ratio (1:1 padrão) — dimensões
    // exatas do request são atendidas "na dimensão equivalente suportada".
    let res: Response
    try {
      res = await fetch(`${API_BASE}/models/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: request.prompt + (request.negative_prompt ? `\n\nAvoid: ${request.negative_prompt}` : '') }] }],
          generationConfig: { responseModalities: ['IMAGE'] }
        }),
        signal: AbortSignal.timeout(60000)
      })
    } catch (e: any) {
      throw err(e?.name === 'TimeoutError' ? 'TIMEOUT' : 'PROVIDER_UNAVAILABLE', 'falha de conexão com a API Google', true)
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[creative][google] generateContent falhou:', res.status, detail.slice(0, 400))
      throw err(res.status === 429 ? 'PROVIDER_UNHEALTHY' : 'GENERATION_FAILED', `API Google retornou HTTP ${res.status}`, res.status >= 500 || res.status === 429)
    }
    const body: any = await res.json()
    const parts = body?.candidates?.[0]?.content?.parts || []
    const imgPart = parts.find((p: any) => p.inlineData?.data || p.inline_data?.data)
    if (!imgPart) throw err('ASSET_NOT_FOUND', 'API Google não retornou imagem', true)
    const inline = imgPart.inlineData || imgPart.inline_data
    const buf = Buffer.from(inline.data, 'base64')
    const mime = inline.mimeType || inline.mime_type || 'image/png'
    const ext = mime.includes('jpeg') ? 'jpg' : 'png'

    const dir = path.join(OUTPUT_ROOT, CLOUD_SUBFOLDER)
    await fs.mkdir(dir, { recursive: true })
    const assetPath = path.join(dir, `gcloud-${pyreJobId.slice(0, 8)}.${ext}`)
    await fs.writeFile(assetPath, buf)

    const dims = ext === 'png' ? readPngSize(buf) : { width: 0, height: 0 }
    const p = this.provenance()
    const sidecar = {
      request_id: request.request_id, job_id: pyreJobId,
      capability: request.capability, skill: request.skill,
      provider: this.id(), tool: this.tool(), model: p.model, model_sha256: p.model_sha256,
      prompt: request.prompt, negative_prompt: request.negative_prompt || '',
      seed: request.seed ?? null, preset: request.preset ?? null,
      resolution: `${dims.width}x${dims.height}`,
      billing_cost_usd: costPerImageUsd(),
      created_at: new Date().toISOString()
    }
    await fs.writeFile(`${assetPath}.pyre.json`, JSON.stringify(sidecar, null, 2), { flag: 'wx' }).catch(() => undefined)

    return {
      phase: 'completed',
      asset: { path: assetPath, mime_type: mime, width: dims.width, height: dims.height, bytes: buf.length },
      seed: request.seed ?? 0,
      billing_cost_usd: costPerImageUsd()
    }
  }
}

function readPngSize(buf: Buffer): { width: number; height: number } {
  if (buf.length < 24) return { width: 0, height: 0 }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}
