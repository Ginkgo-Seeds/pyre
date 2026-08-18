// ComfyUIProvider v2 — adapter do runtime local, repository-driven (Wave 9).
// Estado de jobs vive no CreativeJobRepository (não mais em memória do provider).
// Workflow/nodes/porta/paths continuam encapsulados aqui — nunca no caller.

import { promises as fs } from 'fs'
import * as path from 'path'
import {
  CAPABILITY_IMAGE_LOCAL,
  SKILL_IMAGE_GENERATE_LOCAL,
  CreativeGenerationRequest,
  DEFAULT_PRESET,
  PRESETS,
  err
} from '../creative.contracts'
import {
  CreativeProvider, ProviderCapability, ProviderHealth,
  ProviderJobUpdate, ProviderProvenance, ProviderSubmission
} from './provider'

const BASE_URL = process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188'
const DEFAULT_MODEL = process.env.COMFYUI_DEFAULT_MODEL || 'sd_xl_base_1.0.safetensors'
const OUTPUT_ROOT = process.env.COMFYUI_OUTPUT_ROOT || 'C:\\AI\\30-Assets\\images\\generated'
const DEFAULT_MODEL_SHA256 =
  process.env.COMFYUI_DEFAULT_MODEL_SHA256 ||
  '31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b'
const OUTPUT_SUBFOLDER = 'pyre'

export class ComfyUIProvider implements CreativeProvider {
  id(): string { return 'local' }
  tool(): string { return 'comfyui-local' }
  requiresLocalRuntime(): boolean { return true }

  capabilities(): ProviderCapability[] {
    return [{ capability: CAPABILITY_IMAGE_LOCAL, skill: SKILL_IMAGE_GENERATE_LOCAL, kind: 'image' }]
  }

  provenance(): ProviderProvenance {
    return { provider_version: 'comfyui-v0.29.2@3221224', model: DEFAULT_MODEL, model_sha256: DEFAULT_MODEL_SHA256 }
  }

  async health(): Promise<ProviderHealth> {
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

  resolveSettings(request: CreativeGenerationRequest) {
    const preset = PRESETS[request.preset || DEFAULT_PRESET]
    return {
      width: request.width ?? preset.width,
      height: request.height ?? preset.height,
      steps: preset.steps,
      cfg: preset.cfg,
      sampler: preset.sampler,
      scheduler: preset.scheduler,
      seed: request.seed ?? Math.floor(Math.random() * 2 ** 32)
    }
  }

  async submit(request: CreativeGenerationRequest, pyreJobId: string): Promise<ProviderSubmission> {
    const s = this.resolveSettings(request)
    const graph = this.buildWorkflow(request, s, pyreJobId)
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
    return { provider_job_id: body.prompt_id }
  }

  async fetchStatus(providerJobId: string, ctx: { request: CreativeGenerationRequest; pyreJobId: string }): Promise<ProviderJobUpdate> {
    let hist: any
    try {
      const res = await fetch(`${BASE_URL}/history/${providerJobId}`, { signal: AbortSignal.timeout(10000) })
      hist = await res.json()
    } catch {
      return { phase: 'running' }   // indisponibilidade transitória de polling não falha o job
    }
    const entry = hist?.[providerJobId]
    if (!entry) return { phase: 'running' }
    if (entry.status?.status_str === 'error') {
      console.error('[creative][comfyui] execução com erro:', JSON.stringify(entry.status).slice(0, 800))
      return { phase: 'failed', error: err('GENERATION_FAILED', 'a geração falhou no runtime local', true) }
    }
    if (!entry.status?.completed) return { phase: 'running' }

    const outputs = entry.outputs || {}
    let image: { filename: string; subfolder: string } | undefined
    for (const nodeOut of Object.values<any>(outputs)) {
      if (nodeOut?.images?.length) { image = nodeOut.images[0]; break }
    }
    if (!image) return { phase: 'failed', error: err('ASSET_NOT_FOUND', 'execução concluiu sem asset de saída', false) }

    const assetPath = image.subfolder
      ? path.join(OUTPUT_ROOT, image.subfolder, image.filename)
      : path.join(OUTPUT_ROOT, image.filename)
    let bytes = 0
    try { bytes = (await fs.stat(assetPath)).size } catch {
      return { phase: 'failed', error: err('ASSET_NOT_FOUND', 'asset gerado não encontrado no storage', true) }
    }

    const s = this.resolveSettings(ctx.request)
    await this.writeSidecar(assetPath, ctx, s.seed, `${s.width}x${s.height}`)
    return {
      phase: 'completed',
      asset: { path: assetPath, mime_type: 'image/png', width: s.width, height: s.height, bytes },
      seed: s.seed,
      billing_cost_usd: 0
    }
  }

  private async writeSidecar(assetPath: string, ctx: { request: CreativeGenerationRequest; pyreJobId: string }, seed: number, resolution: string) {
    try {
      const p = this.provenance()
      const sidecar = {
        request_id: ctx.request.request_id, job_id: ctx.pyreJobId,
        capability: ctx.request.capability, skill: ctx.request.skill,
        provider: this.id(), tool: this.tool(), model: p.model, model_sha256: p.model_sha256,
        prompt: ctx.request.prompt, negative_prompt: ctx.request.negative_prompt || '',
        seed, preset: ctx.request.preset || DEFAULT_PRESET, resolution,
        created_at: new Date().toISOString()
      }
      await fs.writeFile(`${assetPath}.pyre.json`, JSON.stringify(sidecar, null, 2), { flag: 'wx' })
    } catch (e: any) {
      if (e?.code !== 'EEXIST') console.error('[creative][comfyui] sidecar não gravado:', e?.message)
    }
  }

  private buildWorkflow(request: CreativeGenerationRequest, s: ReturnType<ComfyUIProvider['resolveSettings']>, jobId: string): Record<string, unknown> {
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
