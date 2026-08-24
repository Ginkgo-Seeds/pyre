# Content Intelligence Factory — Backlog

Status: architecture package only. No live publishing or scraping behavior is introduced by this branch.

## P0 — Prove the closed loop

### P0.01 Contracts + validation

- validate `content.factory.run` request schema;
- define normalized result/error contracts;
- reject provider/tool/model selection from callers;
- reject `original_only=false` in v1;
- unit tests for schema and rights-state rules.

**Done when:** invalid inputs fail deterministically and contracts can be consumed by n8n/apps without provider knowledge.

### P0.02 Canonical Content Factory Job

Persist:

```text
factory_job_id
request_id
account_id
objective
niche
state
format_id
content_plan_id
artifact_ids
rights_state
qa_state
schedule
publication_ids
experiment_id
created_at
updated_at
```

Use Postgres as canonical state; Redis/queue state is operational only.

**Done when:** restart does not lose domain state and idempotent replay does not duplicate work.

### P0.03 Profile Intelligence v1

Implement a bounded analyzer over supplied/reference inputs.

P0 signals:

- content pillars;
- posting cadence;
- median views/reach when available;
- engagement composition;
- recurring hooks/formats;
- production complexity;
- rights risk;
- evidence/confidence.

Do not build general-purpose mass scraping in P0.

**Done when:** a fixed fixture produces a deterministic structured analysis with evidence pointers.

### P0.04 Format Miner v1

Create `content.format.extract`.

Extract reusable structure:

```text
hook
narrative_beats
time_to_payoff
duration
caption_style
cta
pace
aspect_ratio
```

**Done when:** source-media URLs are not required in the downstream creative plan.

### P0.05 Opportunity Scoring v1

Implement explicit weighted scoring using observable inputs and confidence.

Dimensions:

```text
viral_potential
monetization_potential
format_repeatability
production_cost
competition_density
rights_risk
audience_fit
confidence
```

No opaque LLM-only final score.

**Done when:** all score components are inspectable and test fixtures reproduce the same result.

### P0.06 Creative Planner v1

Create an original content plan from an approved format.

Output:

- hook variants;
- beat/script outline;
- asset requirements;
- target platform;
- template/composition intent;
- CTA;
- rights requirements;
- experiment variable.

**Done when:** generated plan contains no dependency on copying reference media.

### P0.07 Composition adapter boundary

Add `content.compose` abstraction.

First validated implementation: FFmpeg media worker.

Optional later implementation: Remotion-compatible adapter after license/runtime review.

**Done when:** callers do not know which composer executed the job and output includes media metadata + provenance.

### P0.08 Rights + QA gate

Create a policy service for:

- technical validation;
- rights/provenance;
- near-duplicate signal;
- brand/template checks;
- approval requirement.

Default-deny publication for:

```text
REFERENCE_ONLY
UNKNOWN
```

**Done when:** a non-publishable fixture cannot enter `SCHEDULED`.

### P0.09 One official publishing adapter

Start with one platform/account path only.

Requirements:

- official API;
- idempotency;
- scheduled UTC time + account timezone;
- external publication ID;
- remote-state reconciliation;
- classified retry;
- publication-limit awareness.

**Done when:** sandbox/test account can schedule/publish one approved original artifact without browser automation.

### P0.10 Analytics ingestion v1

Normalize the metrics available from the selected platform into the Pyre metrics contract.

At minimum where available:

```text
views
reach
likes
comments
shares
saves
follows
watch_time
```

**Done when:** metrics can be fetched again without duplicate snapshots and remain linked to the publication/content/experiment.

### P0.11 Learning loop v1

Use deterministic comparison first.

Input:

- experiment hypothesis;
- baseline/cohort;
- observed metrics.

Output:

- winning attributes;
- losing attributes;
- confidence;
- next controlled experiment.

**Done when:** a measured content item produces a new plan that changes an explicit variable rather than generating an unconstrained rewrite.

### P0.12 E2E fixture

Prove:

```text
reference evidence
 -> profile analysis
 -> format extraction
 -> opportunity score
 -> original plan
 -> asset generation
 -> composition
 -> rights/QA
 -> schedule/publish
 -> analytics
 -> learning update
```

Use one niche, one account, one platform and one format.

**Promotion target:** `PROTOTYPE`.

---

## P1 — Validate economics and reliability

- P1.01 second content format;
- P1.02 second platform adapter;
- P1.03 stronger duplicate/perceptual similarity checks;
- P1.04 template registry + versioning;
- P1.05 content cohorts/experiments;
- P1.06 affiliate attribution adapter;
- P1.07 low/base/high monetization scenarios;
- P1.08 cost ledger per content item;
- P1.09 failure/reconciliation dashboard;
- P1.10 human approval UX;
- P1.11 brand-policy layer;
- P1.12 scheduled analytics refresh.

**Promotion target:** `VALIDATED` after real-account evidence demonstrates stable publishing, correct metrics normalization and useful next-experiment recommendations.

---

## P2 — Scale the factory

- multi-account tenancy;
- portfolio-level niche/opportunity ranking;
- adaptive posting windows based on observed performance;
- budget-aware provider routing;
- asset reuse across formats when rights permit;
- cross-platform experiment attribution;
- sponsor/partner CRM handoff;
- owned-offer lead attribution;
- automated content retirement/replacement;
- statistical bandit/experiment allocation only after sufficient data quality;
- dashboard for expected value vs actual value;
- policy-driven autonomous scheduling within bounded limits.

**Promotion target:** `INTEGRATED` then `PRODUCTION` only after operational, rights, cost and analytics gates pass.

## Explicit non-backlog

Do not open implementation tasks for:

- bulk downloader/reposter;
- account/page identity cloning;
- follower-count revenue calculator;
- engagement bots;
- platform-limit bypass;
- captcha/session bypass;
- browser-driven publishing where an official API exists;
- “viral score” unsupported by evidence;
- automatic copyright assumptions.

## Recommended build order

```text
P0.01 contracts
 -> P0.02 job state
 -> P0.03 profile intelligence
 -> P0.04 format miner
 -> P0.05 scoring
 -> P0.06 planner
 -> P0.07 composer
 -> P0.08 rights/QA
 -> P0.09 publisher
 -> P0.10 analytics
 -> P0.11 learning
 -> P0.12 E2E
```

Do not parallelize publishing before rights/QA and idempotent job state exist.
