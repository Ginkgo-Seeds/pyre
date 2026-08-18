// CreativeJobRepository — persistência de jobs criativos (Wave 9).
//
// Decisão de banco (seção 2 da wave): o Pyre usa Supabase (= Postgres) em produção.
// O repository fala Postgres puro via `pg` — localmente aponta para o Postgres já
// existente do ecossistema (ai-stack, schema dedicado `pyre`); em produção a MESMA
// implementação aponta para o Postgres do Supabase. Nenhum banco novo standalone.
// Sem CREATIVE_DB_URL configurada, cai para o modo in-memory (dev/testes), com log.
//
// Política de privacidade do prompt (documentada, seção 3): o prompt COMPLETO é
// armazenado junto do prompt_hash — banco local/privado do operador, necessário para
// idempotência semântica e reprodutibilidade. Nenhum secret é armazenado.

import { Pool } from 'pg'
import { CreativeGenerationRequest, CreativeJobStatus } from './creative.contracts'

export interface CreativeJobRecord {
  id: string
  request_id: string
  capability: string
  skill: string
  kind: string
  status: CreativeJobStatus
  provider_id: string | null
  provider_job_id: string | null
  prompt: string
  prompt_hash: string
  negative_prompt: string | null
  preset: string | null
  width: number | null
  height: number | null
  seed: number | null
  asset_path: string | null
  asset_mime: string | null
  asset_bytes: number | null
  billing_cost_usd: number | null
  compute_cost_estimate: number | null
  error_code: string | null
  error_message: string | null
  retryable: boolean | null
  routing_reason: string | null
  fallback_used: boolean
  created_at: string
  started_at: string | null
  completed_at: string | null
  updated_at: string
  metadata: Record<string, unknown> | null
}

export interface CreativeJobRepository {
  init(): Promise<void>
  create(job: {
    id: string
    request: CreativeGenerationRequest
    prompt_hash: string
    status: CreativeJobStatus
    routing_reason: string
  }): Promise<CreativeJobRecord>
  getById(id: string): Promise<CreativeJobRecord | null>
  getByRequestId(requestId: string): Promise<CreativeJobRecord | null>
  updateStatus(id: string, status: CreativeJobStatus): Promise<void>
  attachProviderJob(id: string, providerId: string, providerJobId: string): Promise<void>
  complete(id: string, data: {
    asset_path: string; asset_mime: string; asset_bytes: number
    seed: number; billing_cost_usd: number
    width: number; height: number
  }): Promise<void>
  fail(id: string, errorCode: string, errorMessage: string, retryable: boolean): Promise<void>
  listInFlight(): Promise<CreativeJobRecord[]>
}

const IN_FLIGHT: CreativeJobStatus[] = ['starting_runtime', 'submitted', 'running']

// ---------------------------------------------------------------------------
// In-memory (dev/testes; mesma semântica)
// ---------------------------------------------------------------------------

export class InMemoryCreativeJobRepository implements CreativeJobRepository {
  private rows = new Map<string, CreativeJobRecord>()

  async init(): Promise<void> { /* nada */ }

  async create(job: Parameters<CreativeJobRepository['create']>[0]): Promise<CreativeJobRecord> {
    const now = new Date().toISOString()
    const r = job.request
    const rec: CreativeJobRecord = {
      id: job.id,
      request_id: r.request_id,
      capability: r.capability,
      skill: r.skill,
      kind: r.kind,
      status: job.status,
      provider_id: null,
      provider_job_id: null,
      prompt: r.prompt,
      prompt_hash: job.prompt_hash,
      negative_prompt: r.negative_prompt ?? null,
      preset: r.preset ?? null,
      width: r.width ?? null,
      height: r.height ?? null,
      seed: r.seed ?? null,
      asset_path: null, asset_mime: null, asset_bytes: null,
      billing_cost_usd: null, compute_cost_estimate: null,
      error_code: null, error_message: null, retryable: null,
      routing_reason: job.routing_reason,
      fallback_used: false,
      created_at: now, started_at: null, completed_at: null, updated_at: now,
      metadata: (r.metadata as Record<string, unknown>) ?? null
    }
    this.rows.set(job.id, rec)
    return rec
  }

  async getById(id: string) { return this.rows.get(id) ?? null }

  async getByRequestId(requestId: string) {
    for (const r of this.rows.values()) if (r.request_id === requestId) return r
    return null
  }

  async updateStatus(id: string, status: CreativeJobStatus) {
    const r = this.rows.get(id); if (!r) return
    r.status = status; r.updated_at = new Date().toISOString()
    if (status === 'running' && !r.started_at) r.started_at = r.updated_at
  }

  async attachProviderJob(id: string, providerId: string, providerJobId: string) {
    const r = this.rows.get(id); if (!r) return
    r.provider_id = providerId; r.provider_job_id = providerJobId
    r.status = 'submitted'; r.updated_at = new Date().toISOString()
  }

  async complete(id: string, d: Parameters<CreativeJobRepository['complete']>[1]) {
    const r = this.rows.get(id); if (!r) return
    Object.assign(r, {
      status: 'completed', asset_path: d.asset_path, asset_mime: d.asset_mime,
      asset_bytes: d.asset_bytes, seed: d.seed, billing_cost_usd: d.billing_cost_usd,
      width: d.width, height: d.height,
      completed_at: new Date().toISOString(), updated_at: new Date().toISOString()
    })
  }

  async fail(id: string, errorCode: string, errorMessage: string, retryable: boolean) {
    const r = this.rows.get(id); if (!r) return
    Object.assign(r, {
      status: 'failed', error_code: errorCode, error_message: errorMessage, retryable,
      completed_at: new Date().toISOString(), updated_at: new Date().toISOString()
    })
  }

  async listInFlight() {
    return [...this.rows.values()].filter(r => IN_FLIGHT.includes(r.status))
  }
}

// ---------------------------------------------------------------------------
// Postgres (schema dedicado `pyre`; DDL idempotente; sem tocar em nada existente)
// ---------------------------------------------------------------------------

const DDL = `
CREATE SCHEMA IF NOT EXISTS pyre;
CREATE TABLE IF NOT EXISTS pyre.creative_jobs (
  id                TEXT PRIMARY KEY,
  request_id        TEXT NOT NULL,
  capability        TEXT NOT NULL,
  skill             TEXT NOT NULL,
  kind              TEXT NOT NULL,
  status            TEXT NOT NULL,
  provider_id       TEXT,
  provider_job_id   TEXT,
  prompt            TEXT NOT NULL,
  prompt_hash       TEXT NOT NULL,
  negative_prompt   TEXT,
  preset            TEXT,
  width             INTEGER,
  height            INTEGER,
  seed              BIGINT,
  asset_path        TEXT,
  asset_mime        TEXT,
  asset_bytes       BIGINT,
  billing_cost_usd  NUMERIC(10,4),
  compute_cost_estimate NUMERIC(10,4),
  error_code        TEXT,
  error_message     TEXT,
  retryable         BOOLEAN,
  routing_reason    TEXT,
  fallback_used     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata          JSONB
);
CREATE UNIQUE INDEX IF NOT EXISTS creative_jobs_request_id_uq ON pyre.creative_jobs (request_id);
CREATE INDEX IF NOT EXISTS creative_jobs_status_ix ON pyre.creative_jobs (status);
`

export class PgCreativeJobRepository implements CreativeJobRepository {
  private pool: Pool
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5 })
  }

  async init(): Promise<void> {
    await this.pool.query(DDL)
  }

  private rowToRecord(row: any): CreativeJobRecord {
    return {
      ...row,
      seed: row.seed === null ? null : Number(row.seed),
      asset_bytes: row.asset_bytes === null ? null : Number(row.asset_bytes),
      billing_cost_usd: row.billing_cost_usd === null ? null : Number(row.billing_cost_usd),
      compute_cost_estimate: row.compute_cost_estimate === null ? null : Number(row.compute_cost_estimate),
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
      started_at: row.started_at?.toISOString?.() ?? row.started_at,
      completed_at: row.completed_at?.toISOString?.() ?? row.completed_at,
      updated_at: row.updated_at?.toISOString?.() ?? row.updated_at
    }
  }

  async create(job: Parameters<CreativeJobRepository['create']>[0]): Promise<CreativeJobRecord> {
    const r = job.request
    const res = await this.pool.query(
      `INSERT INTO pyre.creative_jobs
        (id, request_id, capability, skill, kind, status, prompt, prompt_hash, negative_prompt,
         preset, width, height, seed, routing_reason, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [job.id, r.request_id, r.capability, r.skill, r.kind, job.status, r.prompt, job.prompt_hash,
       r.negative_prompt ?? null, r.preset ?? null, r.width ?? null, r.height ?? null,
       r.seed ?? null, job.routing_reason, r.metadata ? JSON.stringify(r.metadata) : null]
    )
    return this.rowToRecord(res.rows[0])
  }

  async getById(id: string) {
    const res = await this.pool.query('SELECT * FROM pyre.creative_jobs WHERE id = $1', [id])
    return res.rows[0] ? this.rowToRecord(res.rows[0]) : null
  }

  async getByRequestId(requestId: string) {
    const res = await this.pool.query('SELECT * FROM pyre.creative_jobs WHERE request_id = $1', [requestId])
    return res.rows[0] ? this.rowToRecord(res.rows[0]) : null
  }

  async updateStatus(id: string, status: CreativeJobStatus) {
    await this.pool.query(
      `UPDATE pyre.creative_jobs SET status = $2, updated_at = now(),
        started_at = CASE WHEN $2 = 'running' AND started_at IS NULL THEN now() ELSE started_at END
       WHERE id = $1`, [id, status])
  }

  async attachProviderJob(id: string, providerId: string, providerJobId: string) {
    await this.pool.query(
      `UPDATE pyre.creative_jobs SET provider_id = $2, provider_job_id = $3,
        status = 'submitted', updated_at = now() WHERE id = $1`,
      [id, providerId, providerJobId])
  }

  async complete(id: string, d: Parameters<CreativeJobRepository['complete']>[1]) {
    await this.pool.query(
      `UPDATE pyre.creative_jobs SET status = 'completed', asset_path = $2, asset_mime = $3,
        asset_bytes = $4, seed = $5, billing_cost_usd = $6, width = $7, height = $8,
        completed_at = now(), updated_at = now() WHERE id = $1`,
      [id, d.asset_path, d.asset_mime, d.asset_bytes, d.seed, d.billing_cost_usd, d.width, d.height])
  }

  async fail(id: string, errorCode: string, errorMessage: string, retryable: boolean) {
    await this.pool.query(
      `UPDATE pyre.creative_jobs SET status = 'failed', error_code = $2, error_message = $3,
        retryable = $4, completed_at = now(), updated_at = now() WHERE id = $1`,
      [id, errorCode, errorMessage, retryable])
  }

  async listInFlight() {
    const res = await this.pool.query(
      `SELECT * FROM pyre.creative_jobs WHERE status = ANY($1)`, [IN_FLIGHT])
    return res.rows.map(r => this.rowToRecord(r))
  }
}

export function buildRepository(): CreativeJobRepository {
  const url = process.env.CREATIVE_DB_URL
  if (url) return new PgCreativeJobRepository(url)
  console.warn('[creative][repo] CREATIVE_DB_URL ausente — usando repositório IN-MEMORY (jobs não sobrevivem a restart)')
  return new InMemoryCreativeJobRepository()
}
