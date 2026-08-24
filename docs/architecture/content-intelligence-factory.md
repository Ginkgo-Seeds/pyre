# Content Intelligence Factory

Status: **FEATURE / architecture**

## Objective

Turn Pyre into a learning content-production system that discovers winning editorial patterns, generates original assets, schedules publication through official APIs, measures performance, and feeds results back into the next generation.

This is **not** a repost/cloning engine. The system may study public reference material and user-authorized assets, but the production path must create original or properly licensed outputs.

## Product thesis

The valuable abstraction is not “clone a page”. It is:

```text
market/profile signals
  -> opportunity scoring
  -> format mining
  -> original creative generation
  -> deterministic composition
  -> QA/rights gate
  -> scheduling/publication
  -> analytics
  -> learning loop
```

A page/account is only one deployment target of the factory.

## What we keep

From the observed dark-page workflow, retain only the defensible primitives:

1. profile/market intelligence;
2. editorial-format mining;
3. reusable visual templates;
4. batch rendering;
5. calendar/scheduling;
6. analytics;
7. monetization modeling;
8. automated iteration.

## What we explicitly reject

The following are outside the canonical Pyre design:

- identity cloning/impersonation;
- blind download-and-repost pipelines;
- treating a new frame/logo as sufficient originality;
- browser automation when an official publishing API is available;
- follower-count-only revenue projections;
- unverifiable “viral score” or revenue numbers;
- silent publication without policy/rights checks;
- provider-specific semantics leaking into caller contracts.

## Core capabilities

### 1. Profile Intelligence

Input: public/profile metadata, authorized analytics, sampled posts and performance signals.

Output:

- niche and sub-niche;
- posting cadence;
- median and percentile performance;
- view/follower efficiency;
- engagement composition;
- growth/momentum signal when evidence exists;
- recurring content pillars;
- top formats/hooks;
- production complexity;
- rights/reuse risk;
- monetization hypotheses.

Follower count is context, not the primary ranking signal.

### 2. Opportunity Scoring

Normalized dimensions:

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

The final score must include evidence and confidence. No black-box number without the inputs used to derive it.

### 3. Format Miner

Extract the **grammar** of a successful post instead of copying its media.

Canonical format representation:

```text
hook
content_pillar
scene/archetype
narrative_beats
time_to_payoff
duration
caption_style
text_overlay_style
cta
aspect_ratio
pace
music/audio_role
observed_performance
```

The format is reusable. Source media is not assumed reusable.

### 4. Creative Planner

Transforms opportunity + format into an original content brief:

- angle;
- hook variants;
- script/beat sheet;
- required assets;
- source/licensing requirements;
- target platform(s);
- render template;
- CTA;
- experiment hypothesis.

### 5. Asset Generation

Use existing Pyre provider-neutral creative capabilities for images/video/audio where possible.

Principles:

- providers remain behind adapters;
- original/user-owned/licensed inputs only for production;
- source and generated artifacts are immutable;
- provenance is persisted;
- cloud/local routing follows constraints and cost policy;
- no silent semantic fallback.

### 6. Batch Composer

Preferred implementation split:

- **FFmpeg**: deterministic media operations, normalization, overlays, transcoding, concatenation, captions;
- **Remotion-compatible adapter**: optional richer React-driven templates/animation, subject to license review and provider-neutral wrapping.

The caller asks for `content.compose`; it does not select FFmpeg/Remotion directly.

### 7. Quality + Rights Gate

A content item cannot become publishable until passing:

- technical media validation;
- duplicate/near-duplicate check;
- rights/provenance validation;
- policy/platform validation;
- text/caption QA;
- brand/template QA;
- optional human approval according to policy.

Rights state is explicit:

```text
OWNED
LICENSED
GENERATED
REFERENCE_ONLY
UNKNOWN
```

`REFERENCE_ONLY` and `UNKNOWN` are never publishable by default.

### 8. Scheduler / Publisher

Publishing is an isolated side effect.

```text
Content Factory -> Publish Job -> Platform Adapter -> Official API
```

Requirements:

- official APIs when available;
- platform capability registry;
- scheduled time in canonical UTC plus display timezone;
- rate/publishing limit awareness;
- idempotency key;
- retry only after failure classification;
- remote-state reconciliation before resubmission;
- persisted external publication ID;
- audit trail.

### 9. Analytics

Per-content normalized metrics:

```text
impressions
reach
views
watch_time
avg_watch_time
completion_rate
likes
comments
shares
saves
profile_visits
follows
link_clicks
leads
conversions
revenue
cost
```

Metrics must preserve `platform`, `account_id`, `content_id`, capture timestamp and source.

### 10. Learning Loop

The learning engine compares hypotheses against outcomes and updates priors for future planning.

```text
published content
  -> normalized metrics
  -> cohort/baseline comparison
  -> winning/losing attributes
  -> updated format score
  -> new experiment brief
```

Initially deterministic/statistical. LLM interpretation is advisory, never the sole measurement engine.

## Monetization model

Do not estimate revenue from followers alone.

### Affiliate

```text
expected_revenue =
  expected_views
  * outbound_ctr
  * purchase_conversion_rate
  * average_commission
```

### Sponsorship

```text
expected_revenue =
  expected_reach / 1000
  * negotiated_cpm
  * paid_insertions
```

### Owned product/service

```text
expected_value =
  expected_views
  * lead_rate
  * close_rate
  * contribution_margin_or_ltv
```

Every projection stores assumptions and outputs a range, not a fake precise number.

## Canonical state machine

```text
DISCOVERED
  -> SCORED
  -> PLANNED
  -> ASSETS_READY
  -> COMPOSED
  -> QA_PENDING
  -> APPROVED
  -> SCHEDULED
  -> PUBLISHED
  -> MEASURED
  -> LEARNED
```

Failure and rejection states are terminal for that attempt but may create a new version/experiment.

## System boundaries

```mermaid
flowchart LR
    A[Profile/Market Signals] --> B[Profile Intelligence]
    B --> C[Opportunity Scoring]
    C --> D[Format Miner]
    D --> E[Creative Planner]
    E --> F[Asset Generation]
    F --> G[Batch Composer]
    G --> H[QA + Rights Gate]
    H --> I[Scheduler]
    I --> J[Platform Adapters]
    J --> K[Social Platforms]
    K --> L[Analytics Ingestion]
    L --> M[Learning Engine]
    M --> C
```

## Ownership split

### Pyre owns

- domain contracts;
- opportunity/profile intelligence;
- format representation;
- content plan/job state;
- brand/template semantics;
- rights/provenance gate;
- analytics normalization;
- learning logic;
- publication intent.

### ai-stack/runtime owns

- generic queues/workers;
- model/provider execution;
- Postgres/Redis infrastructure;
- n8n orchestration runtime;
- ComfyUI lifecycle;
- generic FFmpeg worker runtime;
- secrets and provider credentials.

Pyre must not absorb infra orchestration that belongs in the runtime plane.

## Initial platform scope

P0: one account + one platform adapter + one content format + deterministic metrics loop.

The architecture must remain multi-platform, but the prototype should prove the loop before adding breadth.

## Non-goals for v1

- autonomous account farms;
- mass scraping as a product feature;
- bypassing platform limits;
- engagement manipulation;
- automatic rights assumptions;
- fully autonomous spend/budget decisions;
- opaque “viral AI” scoring.

## Success criteria

A v1 is successful when Pyre can:

1. turn evidence from a target niche into a structured format/opportunity brief;
2. generate an original piece using existing provider-neutral media capabilities;
3. compose it deterministically;
4. prove rights/provenance and QA state;
5. schedule/publish via a supported official adapter;
6. ingest normalized performance data;
7. compare the result with a baseline;
8. create a materially different next experiment from what was learned.
