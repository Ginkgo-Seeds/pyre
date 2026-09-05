# Ginkgo Growth — Data Contracts

The system must normalize data before applying business logic. Platform-specific payloads remain inside adapters.

## Canonical entities

```text
content_sources
transcripts
segments
content_ideas
content_assets
media_assets
renders
brands
brand_profiles
editorial_policies
templates
campaigns
ctas
lead_magnets
funnels
publish_jobs
platform_posts
social_interactions
dm_sessions
contacts
contact_identities
intent_signals
lead_score_events
qualifications
conversions
attribution_events
experiments
experiment_variants
analytics_snapshots
provider_usage
cost_events
workflow_runs
execution_evidence
dead_letters
```

## ContentSource

```json
{
  "id": "src_123",
  "type": "live|video|audio|github|product_event|trend|audience_signal",
  "brand_scope": ["gabriel", "ginkgo"],
  "uri": "storage://...",
  "duration_seconds": 7200,
  "occurred_at": "ISO-8601",
  "metadata": {},
  "status": "ready"
}
```

## Segment

```json
{
  "id": "seg_123",
  "source_id": "src_123",
  "start_ms": 788000,
  "end_ms": 1164000,
  "topic": "agent tool governance",
  "summary": "...",
  "hook_score": 0.89,
  "technical_depth": 0.91,
  "controversy": 0.72,
  "evergreen": 0.96,
  "claim_refs": [],
  "recommended_formats": ["short", "thread", "linkedin", "carousel"]
}
```

## ContentAsset

```json
{
  "id": "asset_123",
  "source_refs": ["seg_123"],
  "brand_id": "gabriel",
  "persona": "founder-builder",
  "topic": "agent architecture",
  "hook": "n8n is not the brain of your agent",
  "format": "short_video",
  "platform_targets": ["instagram", "tiktok", "youtube_shorts"],
  "objective": "follow|comment|save|share|dm|lead|book|authority",
  "growth_strategy": "comment_keyword",
  "cta_id": "cta_456",
  "campaign_id": "camp_789",
  "risk_class": "GREEN",
  "status": "approved"
}
```

## Campaign

```json
{
  "id": "camp_789",
  "name": "Media Engine Blueprint",
  "objective": "lead_capture",
  "brand_id": "gabriel",
  "keyword": "MOTOR",
  "lead_magnet_id": "lm_001",
  "funnel_id": "funnel_001",
  "start_at": "ISO-8601",
  "end_at": null,
  "status": "active"
}
```

## SocialInteraction

```json
{
  "id": "int_123",
  "event_type": "social.interaction",
  "platform": "instagram",
  "account_id": "gabriel_main",
  "interaction_type": "comment|dm|reply|follow|save|share|click",
  "platform_user_id": "external-id",
  "platform_post_id": "external-post-id",
  "text": "MOTOR",
  "campaign_id": "camp_789",
  "occurred_at": "ISO-8601",
  "raw_event_ref": "secure-log-ref"
}
```

## ContactIdentity

```json
{
  "contact_id": "contact_123",
  "platform": "instagram",
  "platform_user_id": "external-id",
  "username": "example",
  "verified_at": "ISO-8601",
  "consent": {
    "dm": true,
    "email": false,
    "retargeting": false
  }
}
```

## IntentSignal

```json
{
  "id": "intent_123",
  "contact_id": "contact_123",
  "topic": "n8n",
  "signal_type": "comment_keyword|download|quiz|audit|pricing|meeting",
  "weight": 4,
  "campaign_id": "camp_789",
  "occurred_at": "ISO-8601"
}
```

## Lead score baseline

```text
view/weak signal              +1
comment                        +2
follow                         +3
save                           +3
share                          +4
asset request                  +4
email opt-in                   +5
qualification answer           +8
audit request                 +15
meeting request               +20
```

Suggested tiers:

```text
0-10   audience
11-25  engaged
26-45  MQL
46-70  SQL
71+    priority
```

Weights are a starting hypothesis, not permanent truth. They must be calibrated from conversion data.

## PublishRequest

```json
{
  "id": "pub_123",
  "asset_id": "asset_123",
  "platform": "instagram",
  "account_id": "gabriel_main",
  "scheduled_at": "ISO-8601",
  "caption": "...",
  "media_refs": ["media_123"],
  "cta_id": "cta_456",
  "idempotency_key": "...",
  "risk_class": "GREEN"
}
```

## PublishResult

```json
{
  "publish_request_id": "pub_123",
  "status": "success|failed|blocked",
  "platform_post_id": "external-id",
  "published_at": "ISO-8601",
  "permalink": "...",
  "provider_error": null,
  "evidence_refs": ["evidence_123"]
}
```

## AnalyticsSnapshot

```json
{
  "platform_post_id": "external-id",
  "window": "24h",
  "views": 241800,
  "impressions": 255000,
  "watch_time_seconds": 8480000,
  "completion_rate": 0.42,
  "comments": 2901,
  "saves": 3912,
  "shares": 2104,
  "profile_visits": 10420,
  "follows": 1521,
  "dm_triggers": 740,
  "leads": 188,
  "mqls": 61,
  "meetings": 9,
  "revenue": 4500,
  "content_cost": 2.71
}
```

## Attribution dimensions

Every publishable asset should be attributable to:

```text
source_id
topic
hook
brand
template
format
platform
campaign
cta
lead_magnet
experiment_variant
provider stack
generation cost
```

## Idempotency

Required for:

- ingest webhooks;
- comment/DM events;
- publishing;
- asset delivery;
- CRM sync;
- analytics snapshots;
- ad-audience sync.

A duplicate event must resolve to a no-op or safe replay, never a duplicate external action.

## Evidence

Every external side effect must create evidence containing at minimum:

```text
correlation_id
workflow_id
execution_id
input_ref
provider/platform
request timestamp
result status
external object id when available
cost
latency
error classification
```
