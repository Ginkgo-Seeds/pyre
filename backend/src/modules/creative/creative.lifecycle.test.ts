// Testes unitários do CreativeRuntimeManager (Wave 9) — SEM shell/GPU/RAM real.
// Toda I/O é injetada (runScript/freeRamGiB/checkHealth).

import { test } from 'node:test'
import * as assert from 'node:assert'
import { CreativeRuntimeManager } from './runtime/creative-runtime.manager'

interface Harness {
  mgr: CreativeRuntimeManager
  calls: string[]
  setHealth: (h: boolean) => void
  setRam: (gib: number) => void
}

function makeManager(over: Partial<{ ttlSeconds: number; warmGate: number; floor: number; pressureMs: number; ram: number; healthy: boolean }> = {}): Harness {
  const calls: string[] = []
  let healthy = over.healthy ?? false
  let ram = over.ram ?? 4.0
  const mgr = new CreativeRuntimeManager({
    healthUrl: 'http://test.invalid/health',
    minFreeRamGiBForWarmKeep: over.warmGate ?? 2.0,
    idleTtlSeconds: over.ttlSeconds ?? 0.1,
    memoryPressureFloorGiB: over.floor ?? 1.5,
    startTimeoutSeconds: 5,
    pressureCheckMs: over.pressureMs ?? 30,
    runScript: async (s: string) => {
      calls.push(s.split('\\').pop()!)
      if (s.includes('creative-up')) healthy = true
      if (s.includes('creative-down')) healthy = false
    },
    freeRamGiB: () => ram,
    checkHealth: async () => healthy
  })
  return { mgr, calls, setHealth: (h) => { healthy = h }, setRam: (g) => { ram = g } }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

test('single-flight: 2 ensureAvailable concorrentes → apenas 1 start', async () => {
  const h = makeManager()
  await Promise.all([h.mgr.ensureAvailable(), h.mgr.ensureAvailable()])
  const ups = h.calls.filter(c => c === 'creative-up.ps1').length
  const dockers = h.calls.filter(c => c === 'docker-start-safe.ps1').length
  assert.strictEqual(ups, 1)
  assert.strictEqual(dockers, 1)
  assert.strictEqual(h.mgr.getState(), 'HEALTHY_COLD')
})

test('ensureAvailable com runtime já saudável → nenhum script executado', async () => {
  const h = makeManager({ healthy: true })
  await h.mgr.ensureAvailable()
  assert.strictEqual(h.calls.length, 0)
})

test('RAM gate: fim de job com RAM < gate → shutdown imediato (ram_gate)', async () => {
  const h = makeManager({ ram: 1.0, warmGate: 2.0, healthy: true })
  await h.mgr.ensureAvailable()
  h.mgr.jobStarted()
  h.mgr.jobFinished()
  await sleep(50)
  assert.ok(h.calls.includes('creative-down.ps1'))
  assert.strictEqual(h.mgr.getLastShutdownReason(), 'ram_gate')
})

test('TTL: RAM ok → warm keep, shutdown automático após idle TTL (idle_ttl)', async () => {
  const h = makeManager({ ram: 4.0, ttlSeconds: 0.1, healthy: true })
  await h.mgr.ensureAvailable()
  h.mgr.jobStarted()
  h.mgr.jobFinished()
  assert.strictEqual(h.mgr.getState(), 'IDLE')
  assert.ok(!h.calls.includes('creative-down.ps1'))   // ainda warm
  await sleep(250)
  assert.ok(h.calls.includes('creative-down.ps1'))
  assert.strictEqual(h.mgr.getLastShutdownReason(), 'idle_ttl')
  assert.strictEqual(h.mgr.getState(), 'STOPPED')
})

test('TTL cancelado por novo job: runtime é reutilizado, sem shutdown', async () => {
  const h = makeManager({ ram: 4.0, ttlSeconds: 0.15, healthy: true })
  await h.mgr.ensureAvailable()
  h.mgr.jobStarted(); h.mgr.jobFinished()
  await sleep(50)
  h.mgr.jobStarted()          // novo job durante o TTL → cancela shutdown pendente
  await sleep(250)
  assert.ok(!h.calls.includes('creative-down.ps1'))
  assert.strictEqual(h.mgr.getState(), 'BUSY')
  h.mgr.jobFinished()
})

test('memory pressure guard: RAM cai abaixo do floor durante IDLE → shutdown (memory_pressure)', async () => {
  const h = makeManager({ ram: 4.0, ttlSeconds: 10, floor: 1.5, pressureMs: 25, healthy: true })
  await h.mgr.ensureAvailable()
  h.mgr.jobStarted(); h.mgr.jobFinished()
  assert.strictEqual(h.mgr.getState(), 'IDLE')
  h.setRam(1.0)               // pressão de memória durante o TTL
  await sleep(150)
  assert.ok(h.calls.includes('creative-down.ps1'))
  assert.strictEqual(h.mgr.getLastShutdownReason(), 'memory_pressure')
})

test('NUNCA desligar com job BUSY', async () => {
  const h = makeManager({ ram: 4.0, healthy: true })
  await h.mgr.ensureAvailable()
  h.mgr.jobStarted()
  await h.mgr.shutdownIfIdle('idle_ttl')
  await h.mgr.shutdown('memory_pressure')
  assert.ok(!h.calls.includes('creative-down.ps1'))
  assert.strictEqual(h.mgr.getState(), 'BUSY')
  h.mgr.jobFinished()
})

test('start falha → estado ERROR e razão error', async () => {
  const calls: string[] = []
  const mgr = new CreativeRuntimeManager({
    healthUrl: 'x', minFreeRamGiBForWarmKeep: 2, idleTtlSeconds: 1,
    memoryPressureFloorGiB: 1.5, startTimeoutSeconds: 1, pressureCheckMs: 50,
    runScript: async (s) => { calls.push(s); throw new Error('script falhou') },
    freeRamGiB: () => 4, checkHealth: async () => false
  })
  await assert.rejects(() => mgr.ensureAvailable())
  assert.strictEqual(mgr.getState(), 'ERROR')
  assert.strictEqual(mgr.getLastShutdownReason(), 'error')
})
