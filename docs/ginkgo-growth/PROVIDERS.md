# Provider and Integration Map

Ginkgo Growth must be provider-agnostic. Providers are selected through Runtime/Arsenal policy, not hardcoded into editorial logic.

## Core providers

| Capability | Primary candidates | Adapter responsibility |
|---|---|---|
| LLM reasoning/copy | OpenAI, Anthropic, Gemini, LiteLLM/local | normalized text/structured output |
| Speech-to-text | ElevenLabs Scribe, fallback STT | timestamps, diarization, transcript |
| Voice/TTS | ElevenLabs | voice asset + provenance |
| Image generation | OpenAI Image, Flux, ComfyUI | normalized image request/result |
| Video generation | Higgsfield, ComfyUI, additional approved providers | normalized video request/result |
| Human clip processing | FFmpeg | clip, crop, audio normalization |
| Programmatic video | Remotion + FFmpeg | deterministic templates/renders |
| Storage | R2/S3/Supabase Storage | durable media refs |
| State | Supabase/Postgres | canonical business state |
| Queue | Redis/BullMQ | async jobs/retries |
| Vector memory | pgvector/Qdrant | semantic retrieval |
| Publishing | official social APIs; Postiz as adapter where appropriate | normalized publish result |
| CRM | Ginkgo Ops | contact/intent/commercial state |
| Conversational sales | Callima | qualification/nurture/handoff |
| WhatsApp | Evolution or approved official adapter | conversation transport |
| Approval | Telegram/WhatsApp/dashboard | explicit human decision |
| Secrets | 1Password/Vault/managed secret store | credential references only |

## Social adapters

Target adapters:

```text
social.meta.instagram
social.meta.facebook
social.meta.threads
social.tiktok
social.youtube
social.x
social.linkedin
social.blog
social.postiz
```

Each adapter must implement the relevant subset of:

```text
publish.create
publish.status
comment.list/listen
comment.reply
dm.send
dm.receive
profile.eligibility
analytics.post
analytics.account
webhook.verify
```

Availability differs by platform/account/app permission. Unsupported capabilities MUST return `UNSUPPORTED` rather than falling back to browser automation silently.

## Media routing policy

Example provider registry record:

```yaml
capability: video.generate
provider: higgsfield
credential_ref: vault://media/higgsfield
quality_tier: premium
latency_class: async
cost_model: credits
supports:
  - text_to_video
  - image_to_video
fallbacks:
  - comfyui.video
status: VALIDATED
```

## Cost governor inputs

Every provider request should expose:

```text
estimated_cost
max_cost
quality_tier
latency_requirement
provider_health
fallbacks
campaign_priority
```

Suggested initial budget classes:

```yaml
organic_short:
  max_generation_cost_usd: 1
premium_short:
  max_generation_cost_usd: 3
youtube_long:
  max_generation_cost_usd: 10
launch_campaign:
  max_generation_cost_usd: null # human-approved budget
```

## Credential policy

Never store:

- API keys;
- OAuth refresh tokens;
- cookies;
- browser sessions;
- passwords;
- recovery codes;
- private client datasets.

Git stores only credential aliases such as:

```text
vault://social/meta/ginkgo
vault://social/meta/gabriel
vault://media/elevenlabs
vault://media/higgsfield
vault://infra/supabase
```

## Provider lifecycle

Use the standard lifecycle:

`FEATURE -> PROTOTYPE -> VALIDATED -> INTEGRATED -> PRODUCTION`

A provider may not become a default production route without evidence for authentication, limits, cost behavior, failure behavior, normalized result and fallback behavior.