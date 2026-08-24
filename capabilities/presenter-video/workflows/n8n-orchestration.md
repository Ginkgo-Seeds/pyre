# n8n Orchestration — Presenter Video Engine

## 1. Boundary decision

n8n is an **internal orchestration client**, not the product contract.

```text
Caller / Pyre UI / Scheduler
        ↓
Pyre Capability API
        ↓
Job + Evidence Ledger
        ↓
Queue / Events
        ↓
n8n orchestration
        ↓
Capability Bus / Provider Adapters
```

The canonical boundary remains:

```text
skill-request.v1 → content.presenter-video.generate → skill-result.v1
```

n8n may coordinate stages, approvals and polling, but it must not:

- expose provider SDKs to callers;
- become the source of truth for job state;
- store canonical domain state only inside workflow execution data;
- hardcode ComfyUI node IDs;
- directly decide licenses or rights policy;
- blindly retry billable generation calls;
- publish externally without publication policy.

---

## 2. Runtime assumptions

Target Ginkgo runtime:

```text
n8n main
n8n worker(s)
Redis / BullMQ
PostgreSQL
Hermes / Capability API
ComfyUI on-demand
GPU/local workers
external provider adapters
artifact store
```

n8n queue mode provides execution distribution. The Presenter Video Engine should use its own job/evidence semantics even when n8n executes a stage.

---

## 3. Workflow topology

Do not build one 150-node workflow.

Use a parent orchestration plus focused subworkflows:

```text
PV-00 Orchestrator
├── PV-01 Intake & Authorization
├── PV-02 Content Lock
├── PV-03 Voice & Audio Lock
├── PV-04 Visual Plan
├── PV-05 Provider Route
├── PV-06 Pilot Generation
├── PV-07 Pilot QA
├── PV-08 Full Presenter Generation
├── PV-09 Presenter QA & Repair
├── PV-10 Composition
├── PV-11 Render & Delivery QA
├── PV-12 Publication
└── PV-90 Recovery / Reconciliation
```

Common infrastructure workflows:

```text
CAP-01 Execute Capability
CAP-02 Poll Provider Run
CAP-03 Persist Evidence
CAP-04 Request Approval
CAP-05 Publish Event
CAP-06 Cost Ledger Update
CAP-07 Artifact Registration
```

---

## 4. Parent orchestrator — `PV-00`

### Trigger

Preferred triggers:

1. internal webhook/event from Capability API;
2. queue event;
3. explicit resume/reconcile command.

Not preferred:

- public unauthenticated webhook;
- direct social platform webhook invoking GPU/provider work;
- cron that scans every job every minute.

### Input

```json
{
  "job_id": "job_...",
  "request_id": "req_...",
  "state_version": 7,
  "desired_action": "continue",
  "trace_id": "trc_..."
}
```

The workflow reloads canonical job state from the Capability API/Postgres before acting.

### Core loop

```text
Trigger
→ Fetch Job Snapshot
→ Validate state_version
→ Determine next transition
→ Execute corresponding subworkflow
→ Persist evidence
→ Attempt atomic state transition
→ Emit event
→ stop / await approval / enqueue next transition
```

Never trust stale workflow payload as canonical state.

---

## 5. State transition pattern

Every stage follows:

```text
READ canonical job
↓
CHECK expected state + state_version
↓
EXECUTE deterministic stage
↓
REGISTER artifacts/evidence
↓
COMPARE-AND-SET state transition
↓
EMIT job.state.changed
```

Pseudo API:

```http
POST /v1/jobs/{job_id}/transition
If-Match: state_version=7

{
  "from": "audio_verified",
  "to": "visual_plan_locked",
  "evidence_ids": ["ev_01..."],
  "trace_id": "trc_..."
}
```

If version changed:

```text
409 STATE_CONFLICT
→ abort this execution
→ reload job
→ do not repeat provider side effect automatically
```

---

## 6. `PV-01 Intake & Authorization`

### Nodes / logical steps

```text
Start
→ GET job + request
→ JSON Schema Validate skill-request.v1
→ Resolve presenter asset
→ Probe media
→ Check rights snapshot
→ Check adult confirmation
→ Check remote-upload policy
→ Check voice clone authorization if voice sample exists
→ Build validation report
→ Register evidence
→ Branch
   ├─ technical error → failed/blocked
   ├─ approval missing → awaiting_approval
   └─ ready → authorization_checked
```

### Outputs

```text
input_validation_report
media_probe_report
authorization_snapshot
execution_ready
```

Important distinction:

```text
valid request != allowed remote execution
```

---

## 7. Approval pattern

Use `CAP-04 Request Approval`.

Input:

```json
{
  "job_id": "job_...",
  "approval_type": "budget.full_generation",
  "scope_hash": "sha256:...",
  "reason": "Pilot passed; full generation estimated at USD 1.42",
  "expires_at": null
}
```

Flow:

```text
Create approval request
→ set job awaiting_approval
→ emit approval.requested
→ end execution
```

Resume comes from a new internal event after approval is recorded.

Do not keep a n8n execution sleeping for hours/days waiting for approval.

---

## 8. `PV-02 Content Lock`

```text
Fetch request
→ if topic: call content.script.generate
→ if script: call content.script.polish
→ pronunciation extraction
→ beat-sheet generation
→ semantic/factual change check
→ register docs
→ hash script version
→ transition content_locked
```

Persist:

```text
SCRIPT.md / structured script artifact
BEAT_SHEET.json
PRONUNCIATIONS.json
script_sha256
```

If a human edits the script after lock, invalidate downstream revisions instead of silently continuing.

---

## 9. `PV-03 Voice & Audio Lock`

### Sequence

```text
Load locked script
→ Resolve voice capability
→ Cost/authorization gate
→ Execute TTS/voice clone
→ Register raw sections
→ Normalize audio
→ Assemble master narration
→ ASR transcription
→ Script-vs-ASR semantic diff
→ word timestamps
→ loudness/duration probe
→ register evidence
→ transition voice_locked/audio_verified
```

### Failure branches

```text
ASR mismatch
├─ localized mismatch → regenerate section only
├─ systemic mismatch → provider/voice config review
└─ repeated failure → blocked/failed
```

No visual generation starts until the final audio is accepted.

---

## 10. `PV-04 Visual Plan`

Inputs:

```text
script
beat sheet
master audio duration
word timestamps
brand profile
platform targets
supporting media
```

Outputs:

```text
STORYBOARD.json
TIMELINE.draft.json
safe-zones.json
caption-plan.json
broll-plan.json
```

Route selection:

```text
presenter_led
screen_demo
mixed_explainer
```

The workflow does not generate every B-roll asset immediately. It first creates the plan so generation is demand-driven.

---

## 11. `PV-05 Provider Route`

Do not implement scoring in n8n Function nodes as permanent business logic.

Call the routing service:

```http
POST /v1/router/resolve
```

Input:

```text
capability
constraints
budget
privacy policy
workspace provider policy
runtime health
```

Response:

```json
{
  "route_id": "route_...",
  "selected": {
    "adapter_id": "...",
    "provider": "..."
  },
  "candidates": [],
  "hard_gate_results": [],
  "estimated_cost": {},
  "requires_approval": []
}
```

Persist routing evidence before provider execution.

---

## 12. Generic execution — `CAP-01 Execute Capability`

This subworkflow is used by voice, ASR, presenter, lip-sync, composition and render stages.

```text
Receive capability invocation
→ GET route / adapter descriptor
→ enforce policy snapshot
→ check idempotency
→ create provider_run record
→ execute adapter
→ branch by run status
   ├─ succeeded → collect/register outputs
   ├─ running → enqueue poll
   ├─ blocked → persist blocker
   └─ failed → normalize/classify
```

Provider secrets are resolved server-side by the adapter/runtime, not passed around in ordinary n8n item JSON.

---

## 13. Asynchronous provider polling — `CAP-02`

### Correct

```text
provider_run has task_id
→ poll same task_id
→ running: schedule next poll
→ succeeded: collect
→ failed/cancelled: classify
```

### Incorrect

```text
timeout
→ call create again
→ pay twice
```

Polling cadence should be provider-aware.

Example policy:

```text
first poll: +5s
second: +10s
then: +20s
max interval: 60s
```

Do not exceed provider limits.

For long jobs, enqueue a future poll execution rather than pinning one worker with a long Wait node.

---

## 14. `PV-06 Pilot Generation`

```text
Load visual plan
→ choose smallest representative segment
→ resolve presenter provider
→ estimate pilot cost
→ approval gate if billable
→ submit pilot
→ poll/collect
→ register candidate
→ transition pilot_generated
```

Pilot should cover the riskiest elements, not necessarily the first three seconds.

A good pilot may include:

- name/number/plosive speech;
- small controlled gesture;
- representative framing;
- normal lighting;
- enough duration to detect identity drift.

---

## 15. `PV-07 Pilot QA`

Machine checks:

```text
probe/decode
expected duration
black/freeze detection
basic face continuity signals where available
```

Visual/semantic review:

```text
identity
mouth timing
hands
blink
exposure
crop
background drift
```

Outcomes:

```text
PASS → pilot_verified
REPAIRABLE → repair path
RETRYABLE → classified retry
FAIL_NONRETRYABLE → blocked/failed
```

After pilot pass, the budget governor computes full-generation estimate.

---

## 16. `PV-08 Full Presenter Generation`

```text
Check pilot evidence
→ check full-generation budget approval
→ submit one continuous generation when possible
→ poll
→ collect
→ register provider request/task/cost/artifacts
→ transition full_generation
```

If generation must be segmented, every segment shares a locked identity/camera/light profile.

---

## 17. `PV-09 Presenter QA & Repair`

Classify defect before action.

```text
mouth late + body good
→ media.lipsync.repair

identity drift
→ presenter regeneration with reduced motion

hand artifact
→ simplify/crop/regenerate

exposure drift
→ lock exposure/white balance and retry

corrupt output
→ collect again / provider error path
```

After repair, QA runs again and records parent artifact provenance.

---

## 18. `PV-10 Composition`

```text
Load final audio
→ load selected presenter
→ load supporting media
→ generate captions from final timestamps
→ create graphics/callouts
→ build backend-neutral timeline manifest
→ validate bounds/source offsets
→ invoke media.timeline.compose
→ register composition candidate
→ transition composition_built
```

Then:

```text
composition QA
→ collisions
→ safe zones
→ source-time continuity
→ audio routing
→ transition composition_verified
```

Invariant:

```text
master narration routed once
video source audio muted by default
```

---

## 19. `PV-11 Render & Delivery QA`

```text
compose/render candidate
→ FFmpeg delivery finalizer
→ two-pass loudness normalization
→ master encode
→ share encode
→ full decode
→ probe
→ black/freeze detection
→ contact sheet
→ caption validation
→ register QA report
```

Default delivery target:

```text
H.264
AAC 48 kHz stereo
yuv420p
BT.709
faststart
-16 LUFS program target unless destination overrides
```

Only after successful machine checks plus visual review:

```text
delivery_verified
→ publish_ready
```

---

## 20. `PV-12 Publication`

Publication is optional and side-effecting.

```text
Check target.publish
→ resolve account
→ verify publication approval/policy
→ choose platform asset/caption
→ call media.video.publish
→ persist post ID/status
→ emit publication.completed
```

Retries must be idempotent where platform APIs permit it.

Never regenerate video as a response to publication transport failure.

---

## 21. Recovery workflow — `PV-90`

Purpose: recover jobs after n8n restart, worker crash, provider timeout or queue interruption.

Run on:

- explicit operator command;
- startup/reconciliation schedule at low cadence;
- stale-job detector event.

Algorithm:

```text
query jobs in transient states
→ inspect last evidence/provider_run
→ if remote run exists and unresolved: poll it
→ if artifact exists but state transition missing: validate artifact and transition
→ if stage side effect never started: safely enqueue stage
→ if ambiguous billable state: block for reconciliation
```

Rule:

```text
uncertain billable state => do not resubmit
```

---

## 22. Queue design

Suggested logical queues:

```text
pyre.control
pyre.cpu
pyre.gpu
pyre.provider.poll
pyre.render
pyre.publish
```

Priority mapping:

```text
high   → urgent interactive/pilot
normal → campaign generation
low    → batch/backfill/benchmark
```

Avoid letting long GPU jobs starve webhooks/control-plane work.

---

## 23. Concurrency controls

Per workspace:

```text
max_concurrent_jobs
max_concurrent_paid_runs
max_concurrent_gpu_runs
```

Per provider:

```text
rate_limit
concurrency_limit
queue_depth_limit
```

Per local GPU:

```text
one heavy generation profile at a time by default
```

Exact numbers are runtime-configured, never assumed by the Skill.

---

## 24. Idempotency

Keys:

```text
job create        = request.idempotency_key
stage execution   = job_id + state_revision + stage
provider create   = run_id + normalized input hash
publication       = job_id + platform + account + asset revision
```

Store keys in the canonical database with uniqueness constraints.

---

## 25. Dead-letter handling

A stage moves to DLQ only after error classification and retry policy exhaustion.

DLQ record:

```text
job_id
stage
run_id
error_code
attempts
last_provider_task_id
artifact_ids
cost_to_date
recommended_action
```

DLQ is operational evidence, not a place to silently abandon jobs.

---

## 26. Observability

Every subworkflow propagates:

```text
trace_id
job_id
request_id
run_id
workspace_id
```

Emit structured events rather than relying solely on n8n execution logs.

Minimum events:

```text
job.state.changed
provider.selected
provider.started
provider.polled
provider.completed
provider.failed
approval.requested
approval.granted
artifact.created
qa.completed
cost.updated
publication.completed
```

---

## 27. Security

- n8n credentials store is not the canonical secret-management architecture for provider adapters;
- provider credentials should be resolved in adapter services/secret manager;
- redact headers and signed URLs from execution logs;
- use short-lived artifact access URLs when remote uploads are required;
- n8n must not receive raw secrets in ordinary webhook payloads;
- publication account tokens remain provider-side;
- Git contains no generated presenter assets or model weights.

---

## 28. Suggested n8n node pattern

A typical stage should remain visually boring:

```text
[Internal Trigger]
      ↓
[HTTP: Load Job]
      ↓
[IF: Expected State]
      ↓
[HTTP: Execute Capability]
      ↓
[Switch: running/succeeded/failed/blocked]
   ↙          ↓          ↘
[poll]   [Persist]    [Classify]
             ↓
[HTTP: Transition State]
             ↓
[HTTP: Emit Event]
```

If a workflow needs dozens of Code nodes to understand the domain, domain logic has leaked into n8n.

---

## 29. E2E dry-run workflow

Before live providers, create a deterministic fixture flow:

```text
sample script
+ synthetic/authorized fixture presenter
+ fixture narration
+ fixture presenter video
→ timeline
→ FFmpeg render
→ QA
→ skill-result.v1
```

No remote call and no publication side effect.

Acceptance:

- repeatable output metadata;
- schemas validate;
- retries are deterministic;
- state reconciliation works;
- no secrets;
- no live API dependency.

---

## 30. Production checklist

- [ ] all public triggers authenticated;
- [ ] Pyre API remains domain boundary;
- [ ] canonical state in Postgres;
- [ ] state transitions use optimistic concurrency;
- [ ] provider create calls are idempotency-aware;
- [ ] unresolved remote jobs are polled before resubmission;
- [ ] billable calls gated by budget policy;
- [ ] human approvals are durable records;
- [ ] GPU queue isolated from control traffic;
- [ ] publication is separate from generation;
- [ ] artifacts use immutable IDs/hashes;
- [ ] n8n logs redact secrets/temporary URLs;
- [ ] recovery workflow tested against worker restart;
- [ ] DLQ has operator procedure;
- [ ] metrics and cost events exported;
- [ ] E2E fixture passes before enabling live providers.
