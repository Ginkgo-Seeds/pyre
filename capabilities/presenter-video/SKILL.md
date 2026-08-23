---
name: ginkgo-presenter-video
description: Generate, repair, verify, export, and optionally publish presenter-led videos from a topic or script plus authorized media. Route all execution through Ginkgo capabilities and provider adapters; use the final narration as the master clock.
---

# Ginkgo Presenter Video

## Capability

```text
content.presenter-video.generate
```

Lifecycle at introduction:

```text
FEATURE
```

Target lifecycle:

```text
FEATURE → PROTOTYPE → VALIDATED → INTEGRATED → PRODUCTION
```

## Required outcome

Given a topic or finished script and authorized presenter media, produce:

- locked production script;
- final narration;
- word timestamps;
- presenter source;
- deterministic composition manifest;
- master render;
- share render(s);
- captions;
- QA reports;
- provider/cost evidence;
- optional platform publication result.

## Non-negotiable invariants

1. Final narration is the master clock.
2. Do not generate presenter media before content and voice are locked.
3. Do not upload remote assets without the applicable rights/privacy approval.
4. Do not clone a voice without explicit authorization.
5. Do not perform a long paid generation before a useful pilot passes.
6. Do not retry a remote paid task before polling the existing task ID.
7. Do not switch providers when doing so materially changes privacy, appearance, quality, or cost without policy/approval.
8. Do not let a video source introduce an unapproved audio track into final composition.
9. Do not mark delivery complete until output fully decodes and QA evidence exists.
10. Do not expose provider credentials, signed URLs, local absolute paths, or user assets in Git.

## Capability decomposition

```text
content.presenter-video.generate
├── content.script.generate|polish
├── media.voice.synthesize|clone
├── media.audio.normalize
├── media.asr.transcribe
├── media.asr.word_timestamps
├── media.presenter.generate|animate
├── media.lipsync.repair
├── media.video.broll.generate          optional
├── media.timeline.compose
├── media.video.encode
├── media.video.qa
└── media.video.publish                 optional side effect
```

## Start a job

The caller sends `skill-request.v1`.

Minimum semantic input:

```json
{
  "capability": "content.presenter-video.generate",
  "input": {
    "topic": "Explain context engineering in 60 seconds",
    "presenter_asset_id": "ast_presenter_01"
  },
  "creative": {
    "language": "pt-BR",
    "aspect": "9:16",
    "duration_target_s": 60
  }
}
```

A request may provide `script` instead of `topic`.

## State machine

```text
intake
→ authorization_checked
→ content_locked
→ voice_locked
→ audio_verified
→ visual_plan_locked
→ pilot_generated
→ pilot_verified
→ full_generation
→ presenter_verified
→ composition_built
→ composition_verified
→ rendered
→ delivery_verified
→ publish_ready
→ published? 
```

Side states:

```text
blocked
awaiting_approval
retrying
failed
cancelled
archived
```

## Stage 1 — Intake and authorization

Validate:

- topic or script exists;
- presenter asset exists and decodes;
- intended use has recorded rights;
- remote upload policy;
- voice sample, when supplied, is authorized for the requested operation;
- creative spec is internally consistent;
- requested platform/aspect/duration can be represented.

Output evidence:

```text
input_validation_report
authorization_snapshot
asset_probe_report
```

A job may be technically valid while still `execution_ready=false`.

## Stage 2 — Content lock

For a topic:

```text
hook → promise → 2–4 useful beats → synthesis → close
```

For a supplied script:

- preserve factual meaning;
- optimize spoken rhythm;
- preserve or explicitly surface meaningful factual changes;
- build pronunciation map for names, acronyms, numbers, English tokens, and brand terms.

Persist:

```text
script_version
script_hash
beat_sheet
pronunciation_map
```

Changing the script after lock invalidates voice/audio and all downstream states.

## Stage 3 — Voice lock and audio verification

Resolve `media.voice.synthesize` or `media.voice.clone` by capability.

Generate full narration before main presenter generation.

Persist raw and final audio.

Then:

1. normalize sections;
2. concatenate deterministically;
3. run ASR;
4. compare intended script to transcript;
5. detect omissions/additions/repetitions;
6. create word timestamps;
7. record real duration.

The real final-audio duration becomes the timeline duration.

## Stage 4 — Visual plan

Select route:

```text
presenter_led
screen_demo
mixed_explainer
```

Build:

- storyboard;
- visual beats;
- B-roll requirements;
- presenter safe region;
- caption safe region;
- platform safe zones;
- cover frame;
- CTA/close behavior;
- deterministic timeline draft.

Do not fabricate evidence from products or interfaces. Conceptual visuals must remain conceptual.

## Stage 5 — Provider routing

For each sub-capability:

1. apply hard gates;
2. enumerate candidate adapters;
3. fetch live health/capability metadata when available;
4. estimate cost;
5. score candidates;
6. persist routing decision;
7. execute selected provider.

Provider name must never be part of the caller-facing semantic capability.

## Stage 6 — Pilot gate

Generate the smallest useful pilot.

Primary checks:

- identity stability;
- mouth timing;
- crop/framing;
- exposure/white balance;
- hands/gesture risk;
- provider reliability;
- expected cost per usable second.

Only proceed after `pilot_verified`.

## Stage 7 — Full presenter generation

Prefer one continuous source tied to the locked audio.

If splitting is necessary:

- same identity source;
- same provider/model configuration;
- same camera/framing;
- same light treatment;
- quiet edge holds;
- source timing preserved.

Persist every remote execution:

```text
provider
model
version
region
sanitized_request
provider_task_id
requested_units
estimated_cost
actual_cost
started_at
completed_at
artifact_ids
acceptance_notes
```

## Stage 8 — Lip-sync repair

When motion plate is accepted but mouth timing fails:

```text
accepted motion plate
+ exact locked audio
→ media.lipsync.repair
```

Do not regenerate full body motion by default.

Recheck:

- plosives;
- names;
- numbers;
- English tokens;
- phrase endings;
- final settled mouth.

## Stage 9 — Composition

Build from a backend-independent timeline contract.

Every clip has:

```text
start_ms
duration_ms
source_offset_ms
track
asset_id
```

Video sources are muted unless the creative contract explicitly allows a non-narration track.

The master narration is routed once.

Add after audio/media lock:

- captions;
- keyword callouts;
- chapter labels;
- progress indicator;
- watermark;
- B-roll;
- cover frame;
- close frame.

## Stage 10 — Render and QA

Machine QA:

- ffprobe;
- codecs;
- dimensions;
- fps;
- duration;
- loudness;
- audio channels/sample rate;
- black frames;
- freeze detection;
- full decode;
- caption/timeline bounds;
- contact sheet.

Visual QA:

- identity;
- mouth timing;
- hands;
- blink behavior;
- continuity;
- background;
- lighting;
- face obstruction;
- captions;
- platform safe zones;
- final-frame quality.

No `delivery_verified` without both classes of QA.

## Stage 11 — Delivery

Default outputs:

```text
master.mp4
share.mp4
captions.srt
captions.vtt
captions.json
thumbnail.png
qa-report.json
provider-runs.json
cost-report.json
manifest.json
```

Platform variants may add destination-specific assets.

## Stage 12 — Publication

Publication is separate and optional.

Before side effect:

- destination resolved;
- account resolved;
- asset verified;
- caption/copy version locked;
- publication policy satisfied;
- approval satisfied when required.

Persist platform post ID and resulting status.

## Failure recovery

### Remote task interrupted

Poll stored provider task ID first.

### Identity drift

Retry from original presenter asset with reduced motion and stronger camera/light anchors.

### Hands/fingers fail

Reduce gesture or crop hands outside the risk area; structural artifacts require regeneration.

### Lip-sync late but motion good

Use lip-sync repair, not full regeneration.

### Audio mismatch

Regenerate only the mismatching semantic section, renormalize, concatenate, rerun ASR, and create a new audio revision.

### Timeline/source reset

Inspect `source_offset_ms`; opening edits must not reset presenter source time.

### Captions collide

Re-segment from final word timestamps and platform safe zones.

### Three rejected paid candidates

Stop by default. Preserve evidence and summarize:

- repeated defect;
- attempts;
- spend;
- next variable to change;
- additional expected cost.

## Provider policy

See `PROVIDERS.md`.

## Orchestration policy

See `workflows/n8n-orchestration.md`.

## Contracts

See `contracts/`.

## Backlog and acceptance gates

See `BACKLOG.md`.
