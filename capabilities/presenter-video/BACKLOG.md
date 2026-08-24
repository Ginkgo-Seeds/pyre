# Presenter Video Engine — Implementation Backlog

## 0. Delivery strategy

The engine advances through the Ginkgo lifecycle:

```text
FEATURE → PROTOTYPE → VALIDATED → INTEGRATED → PRODUCTION
```

The objective is not to connect every provider at once. The objective is to make one complete path deterministic, measurable and recoverable, then add providers behind stable contracts.

---

# P0 — Foundation / PROTOTYPE

## P0.01 — Contract validation package

**Goal:** make `skill-request.v1` and `skill-result.v1` executable contracts.

Deliverables:

- JSON Schema validation library integration;
- contract fixtures: valid/invalid requests;
- CI validation;
- semantic error codes;
- version compatibility rules.

Acceptance:

- [ ] valid fixture passes;
- [ ] topic+script together is rejected;
- [ ] missing presenter is rejected;
- [ ] invalid dimensions/fps are rejected;
- [ ] unknown fields are rejected where schema forbids them;
- [ ] result fixtures validate;
- [ ] contract version appears in logs/events.

Dependencies: none.

Lifecycle gate: FEATURE.

---

## P0.02 — Canonical Job + Evidence Ledger

**Goal:** remove canonical state from workflow-local JSON.

Tables/entities:

```text
presenter_video_jobs
presenter_video_job_revisions
presenter_video_events
presenter_video_evidence
presenter_video_provider_runs
presenter_video_approvals
presenter_video_artifacts
presenter_video_qa_reports
presenter_video_publications
```

Minimum job fields:

```text
job_id
workspace_id
request_id
idempotency_key
capability
capability_version
state
state_version
created_at
updated_at
```

Acceptance:

- [ ] unique idempotency key per workspace;
- [ ] optimistic state versioning;
- [ ] append-only evidence/event records;
- [ ] state transition requires evidence where configured;
- [ ] job can be reconstructed after process restart;
- [ ] no provider secret stored.

Dependencies: P0.01.

---

## P0.03 — State Machine Service

**Goal:** enforce transition semantics outside n8n.

Deliverables:

- explicit allowed transition map;
- transition guards;
- invalidation rules;
- compare-and-set transition API;
- state history.

Acceptance:

- [ ] cannot jump `intake → rendered`;
- [ ] cannot reach `pilot_verified` without pilot QA evidence;
- [ ] changing audio revision invalidates downstream timeline/presenter states;
- [ ] concurrent transition conflict returns deterministic error;
- [ ] recovery can resume from first incomplete state.

Dependencies: P0.02.

---

## P0.04 — Artifact Store Abstraction

**Goal:** make local filesystem, object storage and future remote storage interchangeable.

Interface:

```text
put
get
head
exists
copy
create_signed_read
create_signed_write
delete_by_policy
```

Artifact metadata:

```text
asset_id
kind
uri
sha256
mime_type
size
duration
width/height
provenance
retention policy
```

Acceptance:

- [ ] source artifacts immutable;
- [ ] SHA-256 generated;
- [ ] job namespace isolation;
- [ ] reports use artifact IDs, not developer absolute paths;
- [ ] signed URLs are not persisted after expiration;
- [ ] generated media stays outside Git.

Dependencies: P0.02.

---

## P0.05 — Authorization + Approval Ledger

**Goal:** turn rights/cost/privacy approval into durable scoped evidence.

Approval types:

```text
rights.presenter_image
rights.voice_clone
privacy.remote_upload
budget.paid_pilot
budget.full_generation
creative.pilot
creative.final_preview
publication.external_side_effect
```

Acceptance:

- [ ] approval carries scope hash;
- [ ] changed provider/cost scope can invalidate approval;
- [ ] voice clone cannot execute without matching approval;
- [ ] remote upload cannot execute without matching policy;
- [ ] approval survives n8n restart;
- [ ] actor/time recorded.

Dependencies: P0.02.

---

## P0.06 — Provider Registry

**Goal:** register adapters as data, not hardcoded `if provider == ...` branches.

Descriptor fields:

```text
adapter_id
provider
version
capabilities
execution_class
health
license policy
territory policy
limits
pricing metadata
```

Acceptance:

- [ ] list candidates by capability;
- [ ] disable adapter without code change;
- [ ] policy-block provider by workspace/region;
- [ ] health affects availability;
- [ ] provider-specific fields do not leak into request contract.

Dependencies: P0.01.

---

## P0.07 — Provider Router v1

**Goal:** deterministic routing with hard gates + configurable scoring.

Hard gates:

```text
capability
health
license/territory
privacy
supported duration/aspect
budget
runtime/GPU availability
workspace allow/deny
```

Initial scores:

```text
quality
identity
lipsync
cost
latency
reliability
```

Acceptance:

- [ ] hard-gated candidates never receive a score;
- [ ] decision persisted with candidate evidence;
- [ ] local-first policy works;
- [ ] preferred/denied provider policy works;
- [ ] fallback stays within same semantic capability;
- [ ] material cost/privacy change requests approval.

Dependencies: P0.06, P0.05.

---

## P0.08 — Cost Governor + Cost Ledger

**Goal:** know what a job is expected to cost before billable work and what it actually cost afterward.

Acceptance:

- [ ] provider `estimate()` recorded;
- [ ] pilot and full-generation budgets separate;
- [ ] max job cost enforced;
- [ ] actual provider run cost recorded when known;
- [ ] 3 paid rejected candidates stop by default;
- [ ] cost-to-date available at every transition;
- [ ] unknown pricing is explicitly represented, not treated as zero.

Dependencies: P0.06, P0.05.

---

## P0.09 — FFmpeg Media Worker

Capabilities:

```text
media.audio.normalize
media.timeline.compose       baseline subset
media.video.encode
media.video.qa
```

Deliverables:

- ffprobe wrapper;
- two-pass loudness normalization;
- H.264/AAC output;
- full decode validation;
- black-frame detection;
- initial freeze detection;
- contact-sheet generator;
- master/share profiles;
- JSON reports.

Acceptance:

- [ ] refuses corrupt input;
- [ ] does not overwrite immutable output;
- [ ] output decodes fully;
- [ ] program loudness target configurable, default -16 LUFS;
- [ ] master/share metadata captured;
- [ ] absolute developer paths removed from portable reports;
- [ ] deterministic fixture passes on CI-compatible environment.

Dependencies: P0.04.

---

## P0.10 — ASR Adapter v1

Capabilities:

```text
media.asr.transcribe
media.asr.word_timestamps
```

Target first implementation: validated local Whisper-family implementation or equivalent.

Acceptance:

- [ ] transcript;
- [ ] segments;
- [ ] word start/end timestamps;
- [ ] confidence where backend exposes it;
- [ ] language hint;
- [ ] normalized adapter result;
- [ ] fixture containing numbers/proper names/English tokens.

Dependencies: P0.04, P0.06.

---

## P0.11 — TTS Adapter v1

Capability:

```text
media.voice.synthesize
```

Implement one working provider path first; keep cloud/local interchangeable.

Acceptance:

- [ ] pronunciation map input;
- [ ] language/rate configuration;
- [ ] WAV output profile;
- [ ] provider evidence;
- [ ] deterministic artifact registration;
- [ ] no provider voice ID stored in campaign domain object;
- [ ] audio can be ASR-verified.

Dependencies: P0.04, P0.06, P0.10.

---

## P0.12 — Audio Lock Pipeline

Flow:

```text
locked script
→ TTS
→ section normalization
→ concat
→ final loudness probe
→ ASR
→ semantic diff
→ word timestamps
→ audio revision lock
```

Acceptance:

- [ ] missing/repeated material speech detected;
- [ ] real audio duration becomes canonical timeline duration;
- [ ] regenerating one section creates new audio revision;
- [ ] downstream invalidation occurs when duration changes;
- [ ] final narration asset immutable.

Dependencies: P0.03, P0.09, P0.10, P0.11.

---

## P0.13 — ComfyUI Adapter v1

Capability execution bridge, not a workflow-specific domain API.

Deliverables:

- runtime health;
- workflow registry;
- `workflow_key + version` resolution;
- semantic input → node mapping;
- prompt submission;
- history polling;
- artifact collection;
- normalized errors;
- model/custom-node dependency declaration.

Acceptance:

- [ ] Pyre never sees node IDs;
- [ ] workflow hash/version persisted;
- [ ] missing model/custom node fails preflight;
- [ ] adapter handles ComfyUI unavailable state;
- [ ] generated assets registered through Artifact Store;
- [ ] no model weights in Git.

Dependencies: P0.04, P0.06.

---

## P0.14 — Lip-sync benchmark: MuseTalk vs LatentSync

**Goal:** choose first validated `media.lipsync.repair` adapter based on evidence.

Dataset:

- at least 3 authorized/synthetic presenters;
- pt-BR + English phrase samples;
- names/numbers/plosives;
- 15s and 60s cases;
- low-motion and one controlled gesture.

Measure:

```text
identity retention
mouth timing
visual artifacts
latency
VRAM peak
failure rate
usable/generated ratio
```

Acceptance:

- [ ] same fixture for both systems;
- [ ] results committed as metadata/report, not source media if sensitive;
- [ ] selected adapter documented;
- [ ] dependency licenses inventoried;
- [ ] fallback strategy documented.

Dependencies: P0.13 or standalone worker environment, P0.09.

---

## P0.15 — Presenter Adapter v1

Capability:

```text
media.presenter.generate
```

First implementation may be a local or cloud provider chosen after hardware/quality benchmark.

Acceptance:

- [ ] exact master-audio input supported or downstream lip-sync path defined;
- [ ] provider task ID persisted for async provider;
- [ ] poll before resubmit;
- [ ] visual anchors accepted;
- [ ] cost estimate available for billable path;
- [ ] output artifact provenance complete.

Dependencies: P0.06–P0.08, P0.12, P0.14.

---

## P0.16 — Pilot Gate

Acceptance:

- [ ] representative pilot segment selected;
- [ ] pilot cost estimated;
- [ ] billable approval checked;
- [ ] identity/lipsync/technical QA run;
- [ ] full generation cannot start on failed pilot;
- [ ] approved pilot evidence scoped to provider/config revision.

Dependencies: P0.15, P0.18.

---

## P0.17 — Timeline Manifest v1

Deliverables:

- JSON Schema;
- start/duration/source-offset model;
- track definitions;
- master-audio invariant;
- safe-zone metadata;
- captions/graphics references.

Acceptance:

- [ ] start/duration/source offset are independent;
- [ ] source offset does not reset when intro duration changes;
- [ ] timeline bounds validator;
- [ ] exactly one master narration route;
- [ ] presenter source muted by default.

Dependencies: P0.12.

---

## P0.18 — QA Engine v1

Machine QA:

```text
probe/decode
dimensions/fps/duration
loudness
black frames
freeze detection
timeline bounds
caption bounds
contact sheet
```

Visual QA schema:

```text
identity
lipsync
hands
blinks
lighting
continuity
caption readability
safe zones
```

Acceptance:

- [ ] technical pass and visual pass represented separately;
- [ ] typed defects map to recovery actions;
- [ ] QA report references exact artifact revision;
- [ ] threshold config per profile;
- [ ] delivery cannot verify on corrupt output.

Dependencies: P0.09, P0.17.

---

## P0.19 — Recovery Engine v1

Acceptance:

- [ ] interrupted remote task polls stored task ID;
- [ ] timeout vs rate limit vs invalid input classified;
- [ ] good motion + bad mouth routes to lip-sync repair;
- [ ] state can recover after worker/n8n restart;
- [ ] ambiguous billable state blocks rather than resubmits;
- [ ] retry ceiling enforced.

Dependencies: P0.03, P0.06, P0.18.

---

## P0.20 — Deterministic E2E Fixture

No external side effect.

Fixture path:

```text
request
→ content fixture
→ audio fixture/local TTS
→ ASR
→ presenter fixture
→ captions
→ timeline
→ FFmpeg composition
→ encode
→ QA
→ skill-result.v1
```

Acceptance:

- [ ] works offline or with fully mocked provider calls;
- [ ] request/result schemas pass;
- [ ] job resumes after simulated crash;
- [ ] duplicate request does not duplicate job;
- [ ] no live publication;
- [ ] no secret required for CI.

Dependencies: all relevant P0 foundation tasks.

---

# P1 — VALIDATED / INTEGRATED

## P1.01 — n8n orchestration

Implement `PV-00` through `PV-12` and `PV-90` from `workflows/n8n-orchestration.md`.

Acceptance:

- [ ] n8n reloads canonical job state;
- [ ] workflows are stage-oriented, not monolithic;
- [ ] long provider jobs use poll queue/re-entry;
- [ ] approvals are durable events;
- [ ] GPU workloads do not block control plane;
- [ ] reconciliation after n8n restart proven.

Dependencies: P0 state/API layers.

---

## P1.02 — Wan2.2 adapter/benchmark

Evaluate:

```text
media.video.broll.generate
media.presenter.generate (conditional)
```

Acceptance:

- [ ] pinned model/workflow revision;
- [ ] RTX/local hardware benchmark documented;
- [ ] VRAM/latency measured;
- [ ] output quality compared with cloud baseline;
- [ ] Apache-2.0 obligations documented;
- [ ] no assumption that general I2V quality equals presenter quality.

---

## P1.03 — HunyuanVideo policy adapter

Do not enable globally.

Acceptance:

- [ ] license territory gate represented in provider registry;
- [ ] workspace deployment policy checks territory/use case;
- [ ] provider disabled where terms do not fit;
- [ ] model/version benchmark documented;
- [ ] legal/licensing review checkpoint before PRODUCTION.

---

## P1.04 — LivePortrait commercial-safe experiment

Acceptance:

- [ ] restricted InsightFace dependency identified;
- [ ] commercial-safe detector replacement researched/implemented before commercial-ready status;
- [ ] quality regression measured;
- [ ] dependency SBOM generated.

---

## P1.05 — Optional Remotion Composer Adapter

Purpose: richer deterministic graphics when licensing/usage economics fit.

Acceptance:

- [ ] core timeline contract unchanged;
- [ ] FFmpeg remains fallback baseline;
- [ ] license/plan gate documented;
- [ ] output parity tests;
- [ ] renderer failure does not invalidate source artifacts.

---

## P1.06 — Caption Engine v1

Outputs:

```text
captions.json
SRT
VTT
optional burned captions
```

Acceptance:

- [ ] generated from final word timestamps;
- [ ] semantic phrase segmentation;
- [ ] platform safe-zone profiles;
- [ ] keyword emphasis tied to spoken words;
- [ ] collision checks.

---

## P1.07 — Brand/Profile System

Persist reusable:

```text
font references
typography scale
logo/watermark refs
caption presets
callout presets
safe-region preference
intro/outro policy
voice profile
presenter profile
```

Acceptance:

- [ ] no binary proprietary font committed unless licensing permits;
- [ ] profile version attached to job;
- [ ] changing profile creates new composition revision.

---

## P1.08 — Publication adapters

Initial targets:

```text
Instagram Reels
TikTok
YouTube Shorts
```

Acceptance:

- [ ] generation and publication separated;
- [ ] account/token resolution server-side;
- [ ] publication idempotency key;
- [ ] post ID/status stored;
- [ ] failed post does not regenerate media;
- [ ] dry-run support.

---

## P1.09 — Benchmark harness

Make provider comparison repeatable.

Acceptance:

- [ ] fixture manifest versioned;
- [ ] latency/cost/QA captured automatically;
- [ ] local GPU information recorded;
- [ ] provider version/model/workflow hash stored;
- [ ] comparative report generated.

---

## P1.10 — Observability dashboards

Metrics:

```text
time_to_first_pilot
job_total_latency
cost_per_verified_video
cost_per_published_video
provider_success_rate
retry_rate
identity_fail_rate
lipsync_repair_rate
render_fail_rate
publication_fail_rate
```

Acceptance:

- [ ] trace correlation job/request/provider run;
- [ ] cost dashboard;
- [ ] provider health dashboard;
- [ ] no sensitive request content in metrics labels.

---

## P1.11 — 10+ Video Validation Set

Promote to `VALIDATED` only after repeatable real/authorized or synthetic fixture testing.

Acceptance:

- [ ] ≥10 completed videos;
- [ ] at least 2 presenter profiles;
- [ ] at least 2 content styles;
- [ ] 15–75s duration range;
- [ ] documented failure/recovery cases;
- [ ] measured cost/latency;
- [ ] QA thresholds calibrated.

---

# P2 — PRODUCTION / Optimization

## P2.01 — Multi-tenant quotas

- workspace concurrency;
- daily/monthly spend;
- GPU quotas;
- provider allowlist;
- retention policies.

## P2.02 — Learned Provider Routing

Use historical evidence to predict:

```text
quality probability
expected retries
expected usable-second cost
latency
```

Never allow learned ranking to bypass hard policy gates.

## P2.03 — Automatic Recovery Selection

Train/encode defect-to-repair recommendations from QA history.

Example:

```text
LIPSYNC_FAIL + identity_pass
→ dedicated repair preferred
```

## P2.04 — Dynamic GPU Scheduler

- model warm pool;
- VRAM-aware queue;
- local vs cloud overflow;
- GPU-minute accounting.

## P2.05 — Campaign Batch Engine

```text
campaign brief
→ N scripts
→ N jobs
→ budget envelope
→ staggered generation
→ publication calendar
```

## P2.06 — A/B creative variants

Reuse expensive accepted components:

```text
same presenter motion/audio where valid
+ alternate hook/cover/caption treatment
```

Avoid regenerating the entire video when a cheaper composition-only variant is sufficient.

## P2.07 — Performance feedback loop

Ingest platform metrics:

```text
retention
3-second hold
completion rate
CTR
engagement
conversion
```

Feed back into content/visual templates, not directly into ungoverned provider selection.

---

# Promotion gates

## FEATURE → PROTOTYPE

- [ ] request/result schemas exist;
- [ ] state machine documented;
- [ ] at least one adapter contract;
- [ ] E2E fixture path designed.

## PROTOTYPE → VALIDATED

- [ ] end-to-end execution works;
- [ ] pilot gate works;
- [ ] recovery/idempotency works;
- [ ] 10+ benchmark videos;
- [ ] costs measured;
- [ ] QA thresholds established.

## VALIDATED → INTEGRATED

- [ ] Capability Bus integration;
- [ ] Postgres ledger;
- [ ] Redis/queue integration;
- [ ] n8n orchestration;
- [ ] ComfyUI/local adapter integration;
- [ ] observability and secrets reviewed.

## INTEGRATED → PRODUCTION

- [ ] multi-tenant isolation;
- [ ] quotas/budget enforcement;
- [ ] provider disable/failover controls;
- [ ] production publication adapters;
- [ ] license/dependency/SBOM review;
- [ ] retention/privacy review;
- [ ] SLOs and operator runbook;
- [ ] incident recovery tested.

---

# Definition of Done for v1

A Presenter Video v1 is complete when a caller can submit one canonical request and the system can:

```text
validate rights/policy
→ lock content
→ create and verify narration
→ route/select provider
→ generate low-cost pilot
→ verify pilot
→ generate presenter
→ repair lip sync when needed
→ compose deterministic timeline
→ render master/share
→ run machine + visual QA
→ return verified artifacts/cost/evidence
```

with safe recovery after process interruption and without leaking provider-specific semantics into the caller contract.
