---
name: content-intelligence-factory
description: Analyze content-market signals, mine repeatable editorial formats, plan original content, compose/publish it safely, measure performance, and feed evidence into the next experiment.
status: FEATURE
owner: pyre
version: 0.1.0
---

# Content Intelligence Factory

## Purpose

Provide a stable Pyre capability for evidence-driven social content operations without coupling callers to scraping tools, media providers, renderers, platform SDKs or model vendors.

## Canonical skill IDs

```text
content.profile.analyze
content.opportunity.score
content.format.extract
content.plan.create
content.compose
content.publish.schedule
content.analytics.ingest
content.learning.update
```

The full loop may be invoked as:

```text
content.factory.run
```

## Invariants

1. Caller is provider-agnostic.
2. Reference media is not presumed publishable.
3. Publication is a separate side effect from generation/composition.
4. `REFERENCE_ONLY` and `UNKNOWN` rights states cannot publish by default.
5. Revenue estimates must expose assumptions.
6. Performance scores must include evidence/confidence.
7. Remote publication state is reconciled before retry.
8. Idempotency applies to generation, composition and publication jobs.
9. LLM interpretation may explain metrics but cannot invent them.
10. Same-semantics-only fallback applies across providers/adapters.

## Minimal request

```json
{
  "skill": "content.factory.run",
  "request_id": "req_...",
  "account_id": "acct_...",
  "objective": "grow_audience",
  "niche": "automotive",
  "platforms": ["instagram"],
  "constraints": {
    "original_only": true,
    "max_cost_usd": 2.5,
    "approval_required": true
  }
}
```

## Minimal result

```json
{
  "request_id": "req_...",
  "status": "PLANNED",
  "factory_job_id": "cfj_...",
  "evidence": [],
  "next_action": "GENERATE_ASSETS"
}
```

## Profile Intelligence output

At minimum:

```text
niche
content_pillars
posting_cadence
performance_baseline
format_candidates
monetization_hypotheses
production_complexity
rights_risk
confidence
```

No `revenue_estimate` may be generated solely from follower count.

## Format contract

A format captures reusable editorial structure, not source media ownership.

```json
{
  "format_id": "fmt_...",
  "hook": "unexpected_event",
  "content_pillar": "road_incident",
  "narrative_beats": ["setup", "tension", "payoff"],
  "time_to_payoff_seconds": 8,
  "target_duration_seconds": 18,
  "caption_style": "short_contextual",
  "cta": "follow_for_more",
  "evidence": {
    "sample_size": 12,
    "median_views": 88000
  }
}
```

## Rights model

Allowed values:

```text
OWNED
LICENSED
GENERATED
REFERENCE_ONLY
UNKNOWN
```

Publishable by default:

```text
OWNED
LICENSED
GENERATED
```

A policy layer may be stricter but not weaker without explicit approval.

## Composition

The capability is `content.compose`.

Implementation may route to FFmpeg, Remotion-compatible composition, or another validated adapter. Provider/tool names are not caller inputs.

Expected output:

```text
artifact_uri
sha256
duration
width
height
codec
provenance
qa_state
```

## Publishing

`content.publish.schedule` accepts approved content and a platform target.

Requirements:

- official API adapter when available;
- persisted external publication ID;
- UTC canonical scheduled time;
- platform/account timezone metadata;
- publishing-limit awareness;
- idempotency key;
- classified retries;
- reconciliation before resubmit.

## Analytics

Normalized metrics include, when available:

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

Raw platform payloads may be preserved as evidence but are not the canonical cross-platform contract.

## Learning

`content.learning.update` must compare the outcome with a baseline or experiment cohort and return:

```text
what_changed
winning_attributes
losing_attributes
confidence
recommended_next_experiment
```

The next experiment must state which variable(s) change and which remain controlled.

## Monetization formulas

### Affiliate

```text
expected_revenue = expected_views * outbound_ctr * purchase_conversion_rate * average_commission
```

### Sponsorship

```text
expected_revenue = expected_reach / 1000 * negotiated_cpm * paid_insertions
```

### Owned offer

```text
expected_value = expected_views * lead_rate * close_rate * contribution_margin_or_ltv
```

Each estimate stores low/base/high assumptions.

## Safety / policy boundary

This capability must not be implemented as:

- identity impersonation;
- blind repost automation;
- platform-limit bypass;
- engagement manipulation;
- rights-state guessing;
- automated paid-media spend without a separate approval policy.

## Source of truth

Architecture: `docs/architecture/content-intelligence-factory.md`

Execution backlog: `capabilities/content-factory/BACKLOG.md`

Canonical schema: `capabilities/content-factory/contracts/content-factory.v1.schema.json`
