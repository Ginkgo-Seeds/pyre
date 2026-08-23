# Presenter Video — Provider Matrix

> Research snapshot: 2026-08-23.
>
> This document is architecture guidance, not legal advice. Revalidate upstream licenses, model cards, pricing and API terms before moving a provider to `PRODUCTION`.

## 1. Routing rule

Pyre never asks for a brand at the semantic boundary.

Correct:

```text
media.presenter.generate
media.lipsync.repair
media.voice.synthesize
media.asr.word_timestamps
media.timeline.compose
```

Incorrect:

```text
wan.generate
musetalk.sync
elevenlabs.voice
remotion.compose
```

Provider/model names belong inside adapters and routing evidence.

---

## 2. Provider classes

### A. Local/open execution

- ComfyUI runtime;
- Wan family;
- Hunyuan family;
- MuseTalk;
- LatentSync;
- LivePortrait;
- Kokoro;
- Whisper/faster-whisper;
- FFmpeg.

### B. Cloud/API execution

- commercial TTS providers;
- hosted image/video generation;
- hosted lipsync/avatar systems;
- hosted GPU workers.

### C. Composition/render

- FFmpeg;
- optional Remotion adapter;
- future compositor adapters.

---

## 3. Local stack shortlist

| Component | Capability fit | License snapshot | Pyre status | Notes |
|---|---|---|---|---|
| ComfyUI | execution graph/API | GPL-3.0 | P0 adapter | Run as isolated execution provider, not business-domain API |
| Wan2.2 | T2V/I2V/video generation | Apache-2.0 | P1 benchmark | Strong permissive candidate; benchmark hardware and workflow-specific VRAM |
| HunyuanVideo-1.5 | video generation | Tencent Hunyuan Community License | P1 conditional | Territory/commercial obligations require policy gate; not default universal provider |
| MuseTalk | lip sync / virtual human | code MIT; model described upstream as commercially usable | P0 benchmark | Strong candidate for dedicated lipsync adapter; audit dependencies |
| LatentSync | lip sync repair | Apache-2.0 | P0/P1 benchmark | Good semantic fit for repair, but benchmark latency/VRAM/quality |
| LivePortrait | portrait animation | MIT code, but upstream warns InsightFace detection models are non-commercial | P1 conditional | Commercial deployment requires replacing/removing restricted InsightFace models |
| Kokoro | TTS | Apache-licensed weights; inference/dependency details vary | P1 local fallback | Validate target-language quality and dependency licensing before production |
| Whisper / faster-whisper | ASR/timestamps | permissive ecosystem | P0 | Local ASR option; choose exact implementation in adapter |
| FFmpeg | encode/QA/composition | LGPL/GPL build-dependent | P0 | Pin build and document enabled codecs/license mode |

---

## 4. Wan2.2

Upstream:

```text
https://github.com/Wan-Video/Wan2.2
```

Observed license:

```text
Apache-2.0
```

Recommended role:

```text
media.video.broll.generate
media.presenter.generate        conditional after benchmark
```

Why not hardcode as presenter default:

- presenter identity consistency is a different benchmark from general I2V quality;
- lip-sync can require a dedicated downstream repair stage;
- local performance depends strongly on model variant, quantization, offload strategy and GPU memory.

Pyre policy:

```text
adapter = wan
workflow/profile = versioned
hardware_fit = benchmarked
```

No production status until a repeatable test set exists.

---

## 5. HunyuanVideo-1.5

Upstream:

```text
https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5
```

Important license properties observed in the upstream license snapshot:

- custom Tencent Hunyuan Community License;
- territory excludes EU, UK and South Korea;
- hosted-service/distribution obligations exist;
- additional terms apply to very large-scale services;
- outputs are subject to acceptable-use restrictions.

Therefore:

```text
provider_policy.license_region_gate = REQUIRED
```

This provider must not be placed in a universal fallback pool.

Recommended role:

```text
optional generation provider where territory + deployment terms pass policy
```

---

## 6. MuseTalk

Upstream:

```text
https://github.com/TMElyralab/MuseTalk
```

Observed upstream claims:

- code: MIT;
- trained model: upstream states use is allowed for commercial purposes;
- bundled/open dependencies retain their own licenses;
- test data should not be reused commercially without rights.

Recommended role:

```text
media.lipsync.repair
```

Benchmark criteria:

```text
identity preservation
mouth accuracy
resolution
jitter
temporal continuity
latency
VRAM
failure rate
```

---

## 7. LatentSync

Upstream:

```text
https://github.com/bytedance/LatentSync
```

Observed license:

```text
Apache-2.0
```

Recommended role:

```text
media.lipsync.repair
```

Pyre should compare it directly against MuseTalk using the same fixture set.

Do not select by GitHub stars. Select by verified output.

---

## 8. LivePortrait

Upstream:

```text
https://github.com/KlingAIResearch/LivePortrait
```

Observed:

- repository code MIT;
- license file explicitly warns that InsightFace models used by the project are non-commercial research assets;
- upstream recommends replacing those detection models for commercial deployment.

Therefore:

```text
commercial_ready = false
```

until the dependency chain is replaced/audited.

Possible role:

```text
media.presenter.animate
```

not direct default production provider.

---

## 9. Kokoro

Upstream inference repository:

```text
https://github.com/hexgrad/kokoro
```

Observed upstream positioning:

- lightweight 82M TTS;
- Apache-licensed model weights;
- suitable for local inference;
- some downstream dependencies may impose separate obligations.

Recommended role:

```text
media.voice.synthesize
```

as cost-effective/local fallback when language and voice quality pass workspace benchmark.

Do not assume every voice/language is production-quality.

---

## 10. Commercial TTS adapter

Pyre should keep a high-quality cloud adapter for cases where local TTS does not meet the target.

Semantic contract:

```text
media.voice.synthesize
```

Adapter inputs:

```text
text
language
voice_profile
pronunciation_map
rate
style
output_format
```

Never leak provider-specific voice IDs into campaign/domain objects. Store them in provider config references.

---

## 11. ASR

Recommended routing order:

```text
local ASR when available and quality acceptable
→ managed ASR when latency/quality/ops require it
```

Required semantic outputs:

```json
{
  "transcript": "...",
  "language": "pt",
  "segments": [],
  "words": [
    {"text":"...","start_ms":0,"end_ms":320,"confidence":0.99}
  ]
}
```

The word timestamp capability is more important to Pyre than the brand of ASR.

---

## 12. ComfyUI adapter

ComfyUI should be treated as a local execution service.

Adapter interface:

```text
workflow_key
workflow_version
inputs
expected_outputs
execution_policy
```

The adapter resolves actual node IDs and workflow JSON.

Benefits:

- no domain coupling to node graph;
- workflows can change without caller changes;
- local and remote ComfyUI runtimes can share the same contract;
- model files remain external to Git.

---

## 13. FFmpeg

FFmpeg is P0 for:

```text
media.audio.normalize
media.timeline.compose     baseline
media.video.encode
media.video.qa
```

Default verified delivery target:

```text
H.264
AAC
48 kHz stereo
yuv420p
BT.709
faststart
CFR where required by platform
```

Quality pipeline:

```text
render
→ loudness measurement
→ two-pass loudness normalization
→ master encode
→ share encode
→ full decode
→ ffprobe
→ black-frame/freeze checks
→ contact sheet
→ delivery report
```

---

## 14. Remotion

Official pricing/licensing snapshot observed in 2026 indicates:

- free use for individuals/small teams within stated limits;
- companies/automation products may require a paid license;
- automation pricing is usage-based with a minimum plan amount.

Therefore Remotion is an **optional adapter**, not a dependency of the core capability.

```text
media.timeline.compose
└─ adapter: ffmpeg       P0 baseline
└─ adapter: remotion     optional licensed backend
```

This preserves product portability.

---

## 15. n8n licensing boundary

n8n is a control/orchestration tool, not an exposed Pyre feature.

Current official guidance distinguishes internal use, hosted client workflows and embedding. Hosting/managing client workflows or embedding n8n in a product can require commercial/Embed licensing.

Pyre architecture therefore enforces:

```text
external user
→ Pyre API
→ Capability Bus
→ n8n internal orchestration
```

Never:

```text
external user
→ n8n editor/UI/workflow runtime directly
```

Before commercial SaaS launch, perform a fresh licensing review.

---

## 16. Routing tiers

### Tier L0 — local free/permissive baseline

```text
Kokoro/other validated local TTS
local ASR
MuseTalk or LatentSync
FFmpeg
ComfyUI
```

Purpose: lowest variable cost.

### Tier L1 — local GPU generation

```text
Wan / other validated open model
```

Purpose: reduce cloud generation cost when hardware is adequate.

### Tier C1 — cloud quality

```text
managed TTS
managed presenter/video generation
managed lip sync
```

Purpose: quality, speed, overflow, GPU unavailable.

### Tier H — hybrid

Example:

```text
cloud TTS
+ local motion plate
+ local lip-sync repair
+ local FFmpeg render
```

Routing should optimize the whole job, not individual calls in isolation.

---

## 17. Provider benchmark dataset

Create a controlled internal benchmark with at least:

- 3 presenter images;
- 3 lighting/background profiles;
- 2 languages;
- numbers/acronyms/proper names;
- plosives;
- 15s and 60s samples;
- one intentional hand gesture;
- one still/low-motion case.

Record:

```text
provider
model/version
hardware
workflow version
seed/params
latency
cost
VRAM peak
identity score
lip-sync score
visual defects
retry count
usable seconds / generated seconds
```

No provider reaches `VALIDATED` without this dataset.

---

## 18. Initial recommendation

### P0

- FFmpeg adapter;
- ASR adapter;
- one cloud/local TTS adapter;
- MuseTalk vs LatentSync benchmark;
- ComfyUI adapter;
- provider registry;
- cost governor.

### P1

- Wan2.2 benchmark;
- LivePortrait with commercial-safe detector replacement;
- Hunyuan policy adapter;
- Remotion optional compositor;
- cloud overflow providers.

### P2

- learned provider routing from historical QA/cost;
- auto-tuning of provider parameters;
- per-workspace benchmark profiles;
- dynamic GPU scheduling.
