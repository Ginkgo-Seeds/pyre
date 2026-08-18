// CreativeRuntimeManager — lifecycle on-demand do runtime local (Wave 9).
//
// State machine (documentada em docs/CREATIVE_RUNTIME_LIFECYCLE.md, Mermaid):
//   STOPPED → STARTING → HEALTHY_COLD → BUSY → (job fim) → gate de RAM:
//     RAM ≥ warm_keep → HEALTHY_WARM/IDLE com TTL → idle_ttl → STOPPING → STOPPED
//     RAM < warm_keep → STOPPING imediato (ram_gate)
//   pressão de memória durante IDLE (< floor) → STOPPING (memory_pressure)
//   NUNCA desliga com job BUSY. Erros → ERROR (start falhou).
//
// SEGURANÇA (seção 9): SOMENTE comandos allowlisted FIXOS abaixo. Nenhum input
// externo (command/args/path/script de request) é aceito ou interpolado — os
// callers só podem chamar ensureAvailable()/jobStarted()/jobFinished().

import { execFile } from 'child_process'
import * as os from 'os'

const ALLOWLISTED = {
  dockerSafeStart: process.env.CREATIVE_DOCKER_SAFE_START || 'C:\\AI\\60-Tools\\docker\\docker-start-safe.ps1',
  comfyUp: process.env.CREATIVE_COMFY_UP || 'C:\\dev\\ai-stack\\scripts\\creative-up.ps1',
  comfyDown: process.env.CREATIVE_COMFY_DOWN || 'C:\\dev\\ai-stack\\scripts\\creative-down.ps1'
} as const

export type RuntimeState =
  | 'STOPPED' | 'STARTING' | 'HEALTHY_COLD' | 'HEALTHY_WARM'
  | 'BUSY' | 'IDLE' | 'STOPPING' | 'ERROR'

export type ShutdownReason = 'idle_ttl' | 'memory_pressure' | 'ram_gate' | 'manual' | 'error' | 'maintenance'

export interface RuntimeManagerConfig {
  healthUrl: string
  minFreeRamGiBForWarmKeep: number
  idleTtlSeconds: number
  memoryPressureFloorGiB: number
  startTimeoutSeconds: number
  pressureCheckMs?: number
  // Injeção para testes unitários (sem shell/GPU):
  runScript?: (script: string) => Promise<void>
  freeRamGiB?: () => number
  checkHealth?: () => Promise<boolean>
}

function defaultRunScript(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
      { timeout: 300000, windowsHide: true },
      (err) => err ? reject(err) : resolve())
  })
}

export class CreativeRuntimeManager {
  private state: RuntimeState = 'STOPPED'
  private busyCount = 0
  private startPromise: Promise<void> | null = null   // single-flight
  private ttlTimer: NodeJS.Timeout | null = null
  private pressureTimer: NodeJS.Timeout | null = null
  private lastShutdownReason: ShutdownReason | null = null
  private cfg: Required<Pick<RuntimeManagerConfig, 'healthUrl' | 'minFreeRamGiBForWarmKeep' | 'idleTtlSeconds' | 'memoryPressureFloorGiB' | 'startTimeoutSeconds' | 'pressureCheckMs'>>
  private runScript: (script: string) => Promise<void>
  private freeRamGiB: () => number
  private checkHealth: () => Promise<boolean>

  constructor(cfg: RuntimeManagerConfig) {
    this.cfg = {
      healthUrl: cfg.healthUrl,
      minFreeRamGiBForWarmKeep: cfg.minFreeRamGiBForWarmKeep,
      idleTtlSeconds: cfg.idleTtlSeconds,
      memoryPressureFloorGiB: cfg.memoryPressureFloorGiB,
      startTimeoutSeconds: cfg.startTimeoutSeconds,
      pressureCheckMs: cfg.pressureCheckMs ?? 15000
    }
    this.runScript = cfg.runScript ?? defaultRunScript
    this.freeRamGiB = cfg.freeRamGiB ?? (() => os.freemem() / 2 ** 30)
    this.checkHealth = cfg.checkHealth ?? (async () => {
      try {
        const res = await fetch(this.cfg.healthUrl, { signal: AbortSignal.timeout(4000) })
        return res.ok
      } catch { return false }
    })
  }

  getState(): RuntimeState { return this.state }
  getLastShutdownReason(): ShutdownReason | null { return this.lastShutdownReason }

  /** Garante runtime saudável. SINGLE-FLIGHT: chamadas concorrentes aguardam o MESMO start. */
  async ensureAvailable(): Promise<void> {
    if (await this.checkHealth()) {
      if (this.state === 'STOPPED' || this.state === 'ERROR') this.state = 'HEALTHY_WARM'
      return
    }
    if (!this.startPromise) {
      this.startPromise = this.doStart().finally(() => { this.startPromise = null })
    }
    return this.startPromise
  }

  private async doStart(): Promise<void> {
    this.state = 'STARTING'
    this.log('runtime_starting', {})
    try {
      await this.runScript(ALLOWLISTED.dockerSafeStart)
      await this.runScript(ALLOWLISTED.comfyUp)
      const deadline = Date.now() + this.cfg.startTimeoutSeconds * 1000
      while (Date.now() < deadline) {
        if (await this.checkHealth()) { this.state = 'HEALTHY_COLD'; this.log('runtime_healthy', {}); return }
        await new Promise(r => setTimeout(r, 5000))
      }
      throw new Error(`runtime não ficou saudável em ${this.cfg.startTimeoutSeconds}s`)
    } catch (e: any) {
      this.state = 'ERROR'
      this.lastShutdownReason = 'error'
      this.log('runtime_start_failed', { detail: e?.message })
      throw e
    }
  }

  jobStarted(): void {
    this.busyCount++
    this.state = 'BUSY'
    this.cancelTimers()
  }

  /** Fim de job: aplica gate de RAM → warm-keep com TTL, ou shutdown imediato. */
  jobFinished(): void {
    this.busyCount = Math.max(0, this.busyCount - 1)
    if (this.busyCount > 0) return
    this.evaluateIdle()
  }

  evaluateIdle(): void {
    const free = this.freeRamGiB()
    if (free < this.cfg.minFreeRamGiBForWarmKeep) {
      this.log('ram_gate_triggered', { free_ram_gib: Math.round(free * 100) / 100, gate_gib: this.cfg.minFreeRamGiBForWarmKeep })
      void this.shutdown('ram_gate')
      return
    }
    this.state = 'IDLE'
    this.log('warm_keep', { free_ram_gib: Math.round(free * 100) / 100, ttl_s: this.cfg.idleTtlSeconds })
    this.cancelTimers()
    this.ttlTimer = setTimeout(() => { void this.shutdownIfIdle('idle_ttl') }, this.cfg.idleTtlSeconds * 1000)
    // Guarda de pressão de memória durante o TTL (seção 11)
    this.pressureTimer = setInterval(() => {
      const f = this.freeRamGiB()
      if (f < this.cfg.memoryPressureFloorGiB && this.busyCount === 0) {
        this.log('memory_pressure', { free_ram_gib: Math.round(f * 100) / 100 })
        void this.shutdownIfIdle('memory_pressure')
      }
    }, this.cfg.pressureCheckMs)
    this.ttlTimer.unref?.(); this.pressureTimer.unref?.()
  }

  async shutdownIfIdle(reason: ShutdownReason): Promise<void> {
    if (this.busyCount > 0) return   // NUNCA desligar com job em execução
    await this.shutdown(reason)
  }

  async shutdown(reason: ShutdownReason): Promise<void> {
    if (this.busyCount > 0) return
    this.cancelTimers()
    if (this.state === 'STOPPED' || this.state === 'STOPPING') return
    this.state = 'STOPPING'
    this.lastShutdownReason = reason
    this.log('runtime_shutdown', { shutdown_reason: reason })
    try { await this.runScript(ALLOWLISTED.comfyDown) } catch (e: any) {
      this.log('runtime_shutdown_error', { detail: e?.message })
    }
    this.state = 'STOPPED'
  }

  private cancelTimers(): void {
    if (this.ttlTimer) { clearTimeout(this.ttlTimer); this.ttlTimer = null }
    if (this.pressureTimer) { clearInterval(this.pressureTimer); this.pressureTimer = null }
  }

  private log(event: string, fields: Record<string, unknown>): void {
    console.log(JSON.stringify({ component: 'creative-runtime-manager', event, runtime_state: this.state, ...fields }))
  }
}

export function buildRuntimeManager(): CreativeRuntimeManager {
  return new CreativeRuntimeManager({
    healthUrl: (process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188') + '/system_stats',
    minFreeRamGiBForWarmKeep: Number(process.env.CREATIVE_MIN_FREE_RAM_GIB || 2.0),
    idleTtlSeconds: Number(process.env.CREATIVE_IDLE_TTL_SECONDS || 300),
    memoryPressureFloorGiB: Number(process.env.CREATIVE_MEMORY_FLOOR_GIB || 1.5),
    startTimeoutSeconds: Number(process.env.CREATIVE_START_TIMEOUT_SECONDS || 240)
  })
}
