# ginkgo-pyre

IA de social media, calendário automático, copywriting e criação visual.

## Direction

Pyre is evolving into the Ginkgo social operations control plane: trend intelligence, content generation, governed publishing, engagement preparation, metrics and lead signals across X, Threads and LinkedIn.

The permanent runtime is designed to be Ginkgo-owned rather than dependent on Manus credits.

### Architecture

- [Self-hosted Social Operations](docs/architecture/self-hosted-social-ops.md)
- [Manus Migration Runbook](docs/runbooks/manus-migration.md)
- [`social-task.v1` contract](contracts/social-task.v1.schema.json)

### Runtime direction

```text
Hostinger VPS
  -> n8n
  -> Social Orchestrator
  -> Redis/BullMQ
  -> LiteLLM
  -> Supabase/Postgres
  -> official social APIs OR 1Browser/Playwright
  -> ginkgo-pyre dashboard
```

Lifecycle:

```text
DRAFT -> REVIEW -> SCHEDULED -> RUNNING -> PUBLISHED -> MEASURED
```

Current migration status: `PROTOTYPE / P0`.
