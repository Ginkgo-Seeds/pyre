# Runbook — Manus to Ginkgo-owned Social Runtime

Status: P0 migration plan

## Goal

Move the validated social operation away from Manus credits and into Ginkgo-owned infrastructure without requiring X, Threads or LinkedIn APIs on day one.

## Phase 0 — Preserve what already works

Keep:
- editorial positioning;
- channel-specific tone;
- GitHub project mining for LinkedIn;
- Trend Watch logic;
- content queues;
- metrics taxonomy;
- manual account ownership and authentication.

Do not move passwords, browser session exports or access tokens into Git.

## Phase 1 — Browser-first executor

Target flow:

```text
n8n schedule
  -> social orchestrator
  -> queue
  -> content draft
  -> browser.runtime
  -> 1Browser/Playwright
  -> X / Threads / LinkedIn
  -> execution evidence
  -> Postgres
```

### Setup

1. Create one stable Ginkgo social browser profile.
2. Authenticate X, Threads and LinkedIn manually.
3. Keep the profile persistent on the VPS/dedicated runner.
4. Do not store cookies/session archives in the repository.
5. Configure queue concurrency conservatively per channel.
6. Start with read/draft/publish only.
7. Add automated replies only after publication is stable and audited.

## Phase 2 — Official API adapters

Add official channel APIs as credentials become available.

Routing rule:

```text
if official_adapter.is_ready(channel):
    execute via API
else:
    execute via browser.runtime
```

The content/orchestration layer must not change when an executor changes.

## Phase 3 — Autonomous continuous loop

Recommended cycle:

```text
COLLECT SIGNALS
  -> RANK
  -> DRAFT
  -> POLICY CHECK
  -> SCHEDULE
  -> PUBLISH
  -> COLLECT METRICS
  -> CLASSIFY
  -> LEARN
```

Use event-driven execution where possible. Avoid creating an expensive LLM run just to poll time.

## LinkedIn policy

Primary content source: Ginkgo GitHub projects.

Generate posts around:
- problem/pain;
- purpose;
- architecture;
- feature shipped;
- before/after workflow;
- technical choice;
- business impact;
- lessons from implementation.

Use real project artifacts when available: diagrams, screenshots, repo assets, demos and architecture illustrations.

## X and Threads policy

Language: English by default for the high-volume AI/business automation operation.

Focus:
- AI agents;
- automation for businesses;
- coding agents;
- MCP;
- n8n;
- infrastructure;
- open source;
- model/tool launches;
- practical enterprise implications.

High volume means maximizing useful experiments inside platform rules, not mechanically posting at the fastest possible interval.

## Required evidence per execution

Persist:
- execution_id;
- task_id;
- channel;
- executor (`api` or `browser`);
- started_at;
- finished_at;
- result state;
- published URL/id when available;
- error class;
- retry count;
- content hash;
- screenshot/evidence pointer when useful.

## Secrets policy

Allowed in Git:
- variable names;
- schemas;
- examples with empty values;
- setup instructions.

Never commit:
- passwords;
- access tokens;
- refresh tokens;
- session cookies;
- browser profile archives;
- `.env` with real credentials;
- OAuth client secrets.

## P0 acceptance criteria

The first production slice is complete when:

- [ ] n8n can trigger one social cycle without Manus;
- [ ] a queued draft is persisted;
- [ ] X can publish through one authorized executor;
- [ ] Threads can publish through one authorized executor;
- [ ] LinkedIn can publish through one authorized executor;
- [ ] duplicate publication is prevented by content hash/idempotency key;
- [ ] every run leaves auditable evidence;
- [ ] a failed publish retries with bounded backoff;
- [ ] the dashboard can distinguish `PUBLISHED`, `FAILED` and `BLOCKED`;
- [ ] no real credential exists in Git history for this feature.
