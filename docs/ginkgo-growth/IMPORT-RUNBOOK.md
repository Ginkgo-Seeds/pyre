# Ginkgo Growth — Import / Bootstrap Runbook

This document defines how Ginkgo Growth should be imported into the existing Ginkgo stack once executable workflow exports are added.

## 1. Repository placement

Current canonical blueprint location:

```text
Ginkgo-Seeds/pyre/docs/ginkgo-growth/
```

Future executable assets should live under:

```text
n8n/
├── media/
├── growth/
├── analytics/
└── ops/

schemas/
├── events/
├── content/
├── social/
└── growth/

config/
├── brands/
├── policies/
└── providers/
```

Do not commit credentials in exported n8n JSON.

## 2. Prerequisites

Required infrastructure:

- n8n main instance;
- at least one n8n worker when queue mode is enabled;
- Redis;
- Supabase/Postgres;
- object storage;
- Ginkgo Runtime reachable from executor path;
- credential store / secret references;
- at least one validated LLM provider;
- FFmpeg/Remotion worker for media P0;
- one real social-platform adapter for publishing;
- one real social-platform event path for P0 Growth.

Optional until later phases:

- ElevenLabs;
- Higgsfield;
- ComfyUI/GPU;
- Postiz;
- paid ads integrations.

## 3. Environment contract

Use aliases/secret refs rather than literal credentials.

Example environment names:

```text
GROWTH_DATABASE_URL
GROWTH_REDIS_URL
GROWTH_STORAGE_BUCKET
GINKGO_RUNTIME_URL
GINKGO_OPS_URL
MEDIA_RENDERER_URL
PUBLISHING_GLOBAL_ENABLED
DM_AUTOMATION_ENABLED
SYNTHETIC_VOICE_ENABLED
SYNTHETIC_VIDEO_ENABLED
```

Provider credentials should be resolved by the deployment environment or n8n credential objects, not copied into Git.

## 4. Database first

Before importing workflows, create the canonical state layer for at least:

```text
content_sources
transcripts
segments
content_ideas
content_assets
media_assets
renders
campaigns
ctas
lead_magnets
publish_jobs
platform_posts
social_interactions
dm_sessions
contacts
contact_identities
intent_signals
lead_score_events
analytics_snapshots
workflow_runs
execution_evidence
dead_letters
```

P0 migrations must be reviewed separately before production application.

## 5. Import order

Import workflows in dependency order.

### Wave A — OPS foundation

```text
OPS-01 Execution Logger
OPS-02 Failure Recovery
OPS-03 Dead Letter Handler
OPS-04 Cost Meter
OPS-05 SLA Monitor
OPS-06 Audit Evidence
```

### Wave B — Media P0

```text
MEDIA-00 Intake Router
MEDIA-01 Live Ingest
MEDIA-10 Transcription
MEDIA-11 Semantic Segmentation
MEDIA-14 Editorial Planner
MEDIA-15 Brand Splitter
MEDIA-16 Content Atomizer
MEDIA-17 Script Factory
MEDIA-21 Human Clip Extractor
MEDIA-27 Caption Engine
MEDIA-28 Remotion Render
MEDIA-29 FFmpeg Process
MEDIA-30 QA Coordinator
MEDIA-35 Risk Classifier
MEDIA-36 Approval Gateway
MEDIA-40 Content Inventory
MEDIA-44 Publish Queue
MEDIA-50 Publisher Router
one platform adapter
ANALYTICS-01 Metrics Collector
ANALYTICS-02 Normalizer
```

### Wave C — Growth P0

```text
GROWTH-01 Campaign Designer
GROWTH-05 Funnel Resolver
GROWTH-10 Comment Listener
GROWTH-11 Keyword Resolver
GROWTH-12 DM Router
GROWTH-13 Follow/Eligibility Gate
GROWTH-14 Asset Delivery
GROWTH-15 Conversation State
GROWTH-20 Lead Capture
GROWTH-21 Identity Resolution
GROWTH-23 Lead Scoring
GROWTH-25 CRM Sync
```

### Wave D — Advanced media/growth

Only after P0 evidence:

```text
synthetic voice
synthetic images
synthetic video
lead magnet factory
experiment engine
referral
retargeting
paid amplification
```

## 6. n8n import procedure

When workflow JSON exports are present:

1. Open the target n8n instance.
2. Import each workflow JSON in the documented wave order.
3. Keep workflows inactive during credential binding.
4. Replace every credential placeholder with the matching n8n credential or secret reference.
5. Verify webhook paths and environment-specific URLs.
6. Confirm queue/worker execution for async jobs.
7. Run contract tests with publishing and DM kill switches OFF.
8. Run one controlled real external call per provider/adapter.
9. Store evidence.
10. Enable only the specific P0 path being validated.

## 7. Required credential aliases

Recommended naming:

```text
GROWTH_SUPABASE
GROWTH_REDIS
MEDIA_OPENAI
MEDIA_ANTHROPIC
MEDIA_GEMINI
MEDIA_ELEVENLABS
MEDIA_HIGGSFIELD
MEDIA_COMFYUI
SOCIAL_META_GABRIEL
SOCIAL_META_GINKGO
SOCIAL_TIKTOK_GABRIEL
SOCIAL_TIKTOK_GINKGO
SOCIAL_X_GABRIEL
SOCIAL_X_GINKGO
SOCIAL_LINKEDIN_GABRIEL
SOCIAL_LINKEDIN_GINKGO
SOCIAL_YOUTUBE_GABRIEL
SOCIAL_YOUTUBE_GINKGO
GINKGO_OPS_API
GINKGO_RUNTIME_API
```

Only create aliases for integrations actually enabled.

## 8. Brand bootstrap

Create two initial brand profiles:

### Gabriel

```yaml
id: gabriel
voice:
  - technical
  - direct
  - first_person
  - opinionated_when_supported
content_bias:
  - build_in_public
  - deep_technical
  - experiments
  - founder_view
```

### Ginkgo

```yaml
id: ginkgo
voice:
  - institutional
  - precise
  - research_led
  - product_led
content_bias:
  - product
  - engineering
  - research
  - case_studies
  - governance
```

A source may feed both brands, but generated posts must not be literal duplicates.

## 9. First production test

Use one controlled source and one controlled campaign.

Example:

```text
SOURCE: Gabriel 30-60 min technical recording
CAMPAIGN: Media Engine Blueprint
KEYWORD: MOTOR
PLATFORM: Instagram
LEAD MAGNET: architecture diagram / blueprint
```

Expected chain:

```text
source
-> transcript
-> segments
-> 3 content assets
-> 1 GREEN reel
-> publish
-> real keyword comment
-> DM
-> eligibility check
-> asset delivery
-> contact
-> intent signal
-> Ginkgo Ops
-> 24h analytics
```

Do not declare P0 complete if any stage is simulated after publishing.

## 10. Rollback / containment

If an integration misbehaves:

1. set the relevant kill switch to false;
2. deactivate the platform adapter workflow;
3. preserve failed payload/evidence;
4. stop retry storms;
5. drain or quarantine affected queue jobs;
6. repair the adapter/contract;
7. replay only idempotent events.

Global containment:

```text
PUBLISHING_GLOBAL_ENABLED=false
DM_AUTOMATION_ENABLED=false
```

## 11. Definition of imported

Ginkgo Growth is not considered imported merely because JSON files appear in n8n.

`IMPORTED = workflows loaded + credentials bound + contracts validated + worker path healthy + one real end-to-end P0 execution + evidence stored.`
