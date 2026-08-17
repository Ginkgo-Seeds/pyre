// ComfyUIProvider — adapter do runtime criativo local (ai-stack-comfyui).
// Encapsula TODOS os detalhes do ComfyUI (workflow, node IDs, porta, paths).
// Lógica traduzida do smoke validado na Wave 6 (creative-smoke-sdxl.ps1 +
// smoke-sdxl-v1.json) — nada de PowerShell aqui.
//
// Mapeamento de jobs: in-memory (Map) — MVP documentado. O prompt_id interno
// do ComfyUI NUNCA escapa como contrato; o caller só vê o job_id do Pyre.

import { createHash, randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import * as path from 'path'
import {
  CAPABILITY_IMAGE_LOCAL,
  SKILL_IMAGE_GENERATE_LOCAL,
  CreativeGenerationRequest,
  CreativeGenerationResult,
  DEFAULT_PRESET,
  PRESETS,
  err
} from '../creative.contracts'
import { CreativeProvider, ProviderCapability, ProviderHealth } from './provider'

// Config externa (env) — defaults corretos para Pyre rodando no HOST
// (ComfyUI publica somente 127.0.0.1:8188; se o Pyre um dia rodar em container,
// configurar COMFYUI_BASE_URL para a topologia adequada em vez de mudar código).
const BASE_URL = process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188'
const DEFAULT_MODEL = process.env.COMFYUI_DEFAULT_MODEL || 'sd_xl_base_1.0.safetensors'
const OUTPUT_ROOT = process.env.COMFYUI_OUTPUT_ROOT || 'C:\\AI\\30-Assets\\images\\generated'
// Registro de proveniência do modelo padrão (MODEL_REGISTRY.md dos assets)
const DEFAULT_MODEL_SHA256 =
  process.env.COMFYUI_DEFAULT_MODEL_SHA256 ||
  '31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b'
const PROVIDER_VERSION = 'comfyui-v0.29.2@3221224'
const OUTPUT_SUBFOLDER = 'pyre'

interface JobEntry {
  promptId: string
  request: CreativeGenerationRequest
  settings: { width: number; height: number; steps: number; cfg: number; sampler: string; scheduler: string; seed: number }
  submittedAt: number
  finished?: CreativeGenerationResult
}

interface ComfyImageRef { filename: string; subfolder: string; type: string }

export class ComfyUIProvider implements CreativeProvider {
  private jobs = new Map<string, JobEntry>()

  id(): string { return 'local' }
  tool(): string { return 'comfyui-local' }

  capabilities(): ProviderCapability[] {
    return [{ capability: CAPABILITY_IMAGE_LOCAL, skill: SKILL_IMAGE_GENERATE_LOCAL, kind: 'image' }]
  }

  async health(): Promise<ProviderHealth> {
    // Health REAL: /system_stats precisa responder (validado na Wave 5).
    try {
      const res = await fetch(`${BASE_URL}/system_stats`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return { healthy: false, detail: `system_stats HTTP ${res.status}` }
      const stats: any = await res.json()
      const device = stats?.devices?.[0]?.name || 'gpu desconhecida'
      return { healthy: true, detail: `${stats?.system?.comfyui_version || 'comfyui'} | ${device}` }
    } catch (e: any) {
      return { healthy: false, detail: e?.name === 'TimeoutError' ? 'timeout em /system_stats' : 'sem resposta' }
    }
  }

  async submit(request: CreativeGenerationRequest): Promise<string> {
    const health = await this.health()
    if (!health.healthy) {
      throw err('PROVIDER_UNHEALTHY', `provider local indisponível: ${health.detail}`, true)
    }

    const preset = PRESETS[request.preset || DEFAULT_PRESET]
    const settings = {
      width: request.width ?? preset.width,
      height: request.height ?? preset.height,
      steps: preset.steps,
      cfg: preset.cfg,
      sampler: preset.sampler,
      scheduler: preset.scheduler,
      seed: request.seed ?? Math.floor(Math.random() * 2 ** 32)
    }

    const jobId = randomUUID()
    const graph = this.buildWorkflow(request, settings, jobId)

    let res: Response
    try {
      res = await fetch(`${BASE_URL}/prompt`, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ prompt: graph, client_id: 'pyre-creative-router' }),
        signal: AbortSignal.timeout(15000)
      })
    } catch {
      throw err('PROVIDER_UNAVAILABLE', 'falha de conexão com o runtime local', true)
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[creative][comfyui] /prompt falhou:', res.status, detail.slice(0, 500))
      throw err('GENERATION_FAILED', 'o runtime local rejeitou o pedido de geração', false)
    }
    const body: any = await res.json()
    if (!body?.prompt_id) throw err('GENERATION_FAILED', 'runtime local não retornou identificador de execução', true)

    this.jobs.set(jobId, { promptId: body.prompt_id, request, settings, submittedAt: Date.now() })
    return jobId
  }

  async status(jobId: string): Promise<CreativeGenerationResult> {
    const job = this.jobs.get(jobId)
    if (!job) {
      return {
        request_id: 'unknown', job_id: jobId, status: 'failed',
        error: err('ASSET_NOT_FOUND', 'job desconhecido para este provider')
      }
    }
    if (job.finished) return job.finished

    let hist: any
    try {
      const res = await fetch(`${BASE_URL}/history/${job.promptId}`, { signal: AbortSignal.timeout(10000) })
      hist = await res.json()
    } catch {
      return this.running(job, jobId) // indisponibilidade transitória de polling não falha o job
    }

    const entry = hist?.[job.promptId]
    if (!entry) return this.running(job, jobId)
    if (entry.status?.status_str === 'error') {
      console.error('[creative][comfyui] execução com erro:', JSON.stringify(entry.status).slice(0, 800))
      const failed: CreativeGenerationResult = {
        request_id: job.request.request_id, job_id: jobId, status: 'failed',
        error: err('GENERATION_FAILED', 'a geração falhou no runtime local', true)
      }
      job.finished = failed
      return failed
    }
    if (!entry.status?.completed) return this.running(job, jobId)

    return await this.finalize(job, jobId, entry)
  }

  async result(jobId: string): Promise<CreativeGenerationResult> {
    return this.status(jobId)
  }

  // -------------------------------------------------------------------------

  private running(job: JobEntry, jobId: string): CreativeGenerationResult {
    return { request_id: job.request.request_id, job_id: jobId, status: 'running' }
  }

  private async finalize(job: JobEntry, jobId: string, entry: any): Promise<CreativeGenerationResult> {
    const durationMs = Date.now() - job.submittedAt
    const outputs = entry.outputs || {}
    let image: ComfyImageRef | undefined
    for (const nodeOut of Object.values<any>(outputs)) {
      if (nodeOut?.images?.length) { image = nodeOut.images[0]; break }
    }
    if (!image) {
      const failed: CreativeGenerationResult = {
        request_id: job.request.request_id, job_id: jobId, status: 'failed',
        error: err('ASSET_NOT_FOUND', 'execução concluiu sem asset de saída', false)
      }
      job.finished = failed
      return failed
    }

    const assetPath = image.subfolder
      ? path.join(OUTPUT_ROOT, image.subfolder, image.filename)
      : path.join(OUTPUT_ROOT, image.filename)

    let bytes = 0
    try { bytes = (await fs.stat(assetPath)).size } catch {
      const failed: CreativeGenerationResult = {
        request_id: job.request.request_id, job_id: jobId, status: 'failed',
        error: err('ASSET_NOT_FOUND', 'asset gerado não encontrado no storage', true)
      }
      job.finished = failed
      return failed
    }

    const promptHash = createHash('sha256').update(job.request.prompt, 'utf8').digest('hex')
    const createdAt = new Date().toISOString()
    const result: CreativeGenerationResult = {
      request_id: job.request.request_id,
      job_id: jobId,
      status: 'completed',
      provider: { id: this.id(), tool: this.tool(), model: DEFAULT_MODEL },
      asset: {
        id: image.filename,
        path: assetPath,
        mime_type: 'image/png',
        width: job.settings.width,
        height: job.settings.height,
        bytes
      },
      generation: {
        seed: job.settings.seed,
        duration_ms: durationMs,
        workflow: 'sdxl-txt2img-v1',
        prompt_hash: promptHash
      },
      cost: { billing_cost_usd: 0, compute_cost_estimate: null },
      provenance: { created_at: createdAt, provider_version: PROVIDER_VERSION, model_sha256: DEFAULT_MODEL_SHA256 }
    }

    // Sidecar próprio do Pyre (sufixo .pyre.json — nunca sobrescreve sidecars existentes)
    try {
      const sidecar = {
        request_id: job.request.request_id,
        job_id: jobId,
        capability: job.request.capability,
        skill: job.request.skill,
        provider: this.id(),
        tool: this.tool(),
        model: DEFAULT_MODEL,
        model_sha256: DEFAULT_MODEL_SHA256,
        prompt: job.request.prompt,
        negative_prompt: job.request.negative_prompt || '',
        seed: job.settings.seed,
        preset: job.request.preset || DEFAULT_PRESET,
        resolution: `${job.settings.width}x${job.settings.height}`,
        generation_seconds: Math.round(durationMs / 100) / 10,
        created_at: createdAt
      }
      await fs.writeFile(`${assetPath}.pyre.json`, JSON.stringify(sidecar, null, 2), { flag: 'wx' })
    } catch (e: any) {
      if (e?.code !== 'EEXIST') console.error('[creative][comfyui] sidecar não gravado:', e?.message)
    }

    job.finished = result
    return result
  }

  // Workflow SDXL txt2img — tradução direta do smoke-sdxl-v1.json validado.
  // Detalhe interno do adapter: nunca exposto ao caller.
  private buildWorkflow(
    request: CreativeGenerationRequest,
    s: JobEntry['settings'],
    jobId: string
  ): Record<string, unknown> {
    const prefix = `${OUTPUT_SUBFOLDER}/pyre-${jobId.slice(0, 8)}`
    return {
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: DEFAULT_MODEL } },
      '5': { class_type: 'EmptyLatentImage', inputs: { width: s.width, height: s.height, batch_size: 1 } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: request.prompt, clip: ['4', 1] } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: request.negative_prompt || '', clip: ['4', 1] } },
      '3': {
        class_type: 'KSampler',
        inputs: {
          model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0],
          seed: s.seed, steps: s.steps, cfg: s.cfg,
          sampler_name: s.sampler, scheduler: s.scheduler, denoise: 1.0
        }
      },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
      '9': { class_type: 'SaveImage', inputs: { images: ['8', 0], filename_prefix: prefix } }
    }
  }
}
