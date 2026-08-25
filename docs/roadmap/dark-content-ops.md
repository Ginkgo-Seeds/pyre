# Roadmap — Pyre Dark Content Operations

## Objetivo

Levar Pyre de documentação para um MVP que consiga operar o ciclo:

```text
Asset -> Schedule -> Publish -> Reconcile -> Measure
```

Depois evoluir para:

```text
Research -> Create -> Publish -> Measure -> Optimize
```

## Milestone 0 — Foundation

### Entregáveis

- [ ] monorepo definido
- [ ] `apps/web`
- [ ] `apps/api`
- [ ] `workers/publisher`
- [ ] `workers/render`
- [ ] `packages/contracts`
- [ ] `packages/adapters`
- [ ] Postgres
- [ ] Redis/BullMQ
- [ ] object storage
- [ ] local Docker Compose

### Schemas mínimos

- [ ] Workspace
- [ ] SocialAccount
- [ ] ContentExperiment
- [ ] ContentVariant
- [ ] MediaAsset
- [ ] PublicationIntent
- [ ] PublicationAttempt
- [ ] MetricSnapshot
- [ ] OptimizationDecision

### Testes obrigatórios

- [ ] state machine
- [ ] idempotency key
- [ ] duplicate scheduling
- [ ] retry policy
- [ ] normalized provider errors

## Milestone 1 — Distribution MVP

### Backend

- [ ] criar workspace
- [ ] registrar conta social fake
- [ ] upload de asset
- [ ] criar publication intent
- [ ] scheduler de intents vencidos
- [ ] queue publisher
- [ ] fake provider adapter
- [ ] persistir attempts
- [ ] cancelar intent
- [ ] retry com backoff
- [ ] dead-letter state

### Frontend

- [ ] calendário
- [ ] composer
- [ ] upload
- [ ] tabela de publicações
- [ ] status operacional
- [ ] tela de falhas
- [ ] bulk select
- [ ] bulk schedule

### DoD

30 conteúdos devem poder ser agendados em lote usando fixtures sem alteração manual no banco.

## Milestone 2 — Primeiro provider real

Prioridade sugerida: Meta.

### Adapter

- [ ] OAuth
- [ ] capability discovery
- [ ] token reference
- [ ] publish validation
- [ ] media publish
- [ ] external id persistence
- [ ] reconciliation
- [ ] error mapping

### Segurança

- [ ] secrets fora do banco de aplicação
- [ ] scopes mínimos
- [ ] encryption at rest
- [ ] token refresh strategy
- [ ] revocation
- [ ] log redaction

### DoD

Um PublicationIntent deve chegar a `PUBLISHED` em conta de teste e ser reconciliado posteriormente sem intervenção manual.

## Milestone 3 — Media Factory

### FFmpeg worker

- [ ] normalize video
- [ ] resize 9:16
- [ ] trim
- [ ] concatenate
- [ ] audio normalize
- [ ] subtitle burn-in
- [ ] thumbnail extraction
- [ ] technical validation

### Remotion

- [ ] template contract
- [ ] text overlays
- [ ] brand tokens
- [ ] reusable compositions
- [ ] render queue

### Batch

- [ ] N inputs -> N variants
- [ ] progress reporting
- [ ] partial failure handling
- [ ] immutable output hashes

## Milestone 4 — Content Intelligence

- [ ] niche research contract
- [ ] reference analysis contract
- [ ] hook taxonomy
- [ ] script generation
- [ ] brand voice profile
- [ ] CTA generation
- [ ] deduplication
- [ ] experiment creation
- [ ] variant generation

## Milestone 5 — Analytics

- [ ] metrics collector
- [ ] periodic snapshots
- [ ] unified metric names
- [ ] content cohort queries
- [ ] experiment comparison
- [ ] operational dashboard
- [ ] content performance dashboard

## Milestone 6 — Optimization Agent

### Read-only mode

- [ ] observe metrics
- [ ] identify winners/losers
- [ ] generate explanation
- [ ] propose action
- [ ] attach evidence

### Approval mode

- [ ] policy engine
- [ ] approve/reject UI
- [ ] apply approved decision
- [ ] audit event

### Bounded autonomy

Liberar apenas quando houver evidência suficiente.

- [ ] horário
- [ ] hook variants
- [ ] thumbnails
- [ ] CTA
- [ ] slot allocation

Mudança de nicho, conta, identidade, orçamento ou volume permanece approval-required.

## Backlog P0

1. contracts
2. database schema
3. publication state machine
4. fake adapter
5. scheduler
6. queue
7. calendar UI
8. bulk scheduling
9. operational logs
10. first real adapter

## Backlog P1

1. media ingest
2. FFmpeg worker
3. templates
4. caption engine
5. metric snapshots
6. batch editing
7. workspace RBAC
8. provider capability matrix

## Backlog P2

1. experiment engine
2. optimization proposals
3. cohort analysis
4. automated allocation
5. multi-provider optimization

## KPIs técnicos

| KPI | Meta inicial |
|---|---:|
| publish success rate | > 98% excluindo erros permanentes do provider |
| duplicate publish rate | 0% |
| queue job traceability | 100% |
| intents com audit trail | 100% |
| scheduler lag p95 | < 60s |
| render failure com reason code | 100% |

## KPIs de produto

| KPI | Meta inicial |
|---|---:|
| tempo para agendar 30 posts | < 2 min |
| cliques médios por post em operação batch | < 1 |
| taxa de ações bulk vs individuais | > 70% |
| conteúdo com hipótese associada após Intelligence | > 90% |
| decisões autônomas com evidência | 100% |

## Regra de evolução

Não implementar autonomia antes da observabilidade.

Ordem correta:

```text
execute reliably
-> observe completely
-> recommend safely
-> automate selectively
```

O produto só deve virar “autônomo” depois de conseguir explicar o que fez, por que fez e como desfazer.