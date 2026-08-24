# Third-Party References and License Gates

> Snapshot date: 2026-08-23.
>
> This inventory records architecture/research dependencies and candidate execution providers. It is not a substitute for a fresh license review before production deployment.

## Upstream architectural reference

### `cclank/lanshu-create-ai-presenter-video`

Repository:

```text
https://github.com/cclank/lanshu-create-ai-presenter-video
```

License observed:

```text
MIT
```

Use in Pyre:

- architectural reference;
- state-machine inspiration;
- audio-master-clock pattern;
- pilot gate;
- deterministic timeline concepts;
- QA/recovery design patterns.

Decision:

```text
ADOPT PATTERNS
DO NOT USE UPSTREAM AS PYRE PRODUCT CORE
```

Pyre implementation is provider-neutral and uses its own contracts, state model, provider registry, approvals, cost ledger and runtime integration.

If upstream code is later copied or modified directly, preserve the applicable MIT copyright/license notice in accordance with the license.

---

## Candidate execution/runtime dependencies

| Project | Candidate role | Observed license/constraint snapshot | Gate before PRODUCTION |
|---|---|---|---|
| ComfyUI | local workflow execution | GPL-3.0 | architecture/license boundary review |
| Wan2.2 | video generation | Apache-2.0 | model/workflow benchmark + dependency inventory |
| HunyuanVideo-1.5 | video generation | Tencent Hunyuan Community License | territory/use/deployment policy review |
| MuseTalk | lip-sync | code MIT; upstream states model commercially usable | dependency/model asset audit |
| LatentSync | lip-sync | Apache-2.0 | dependency/model asset audit |
| LivePortrait | portrait animation | MIT code; upstream warns InsightFace model restrictions | replace/review restricted detector assets |
| Kokoro | local TTS | Apache-licensed model weights; dependencies separate | dependency + language/quality validation |
| FFmpeg | compose/encode/QA | build-dependent LGPL/GPL obligations | pin build/config and document enabled codecs |
| Remotion | optional compositor | commercial terms depend on user/company/automation usage | current license/pricing review before enabling |
| n8n | internal orchestration | Sustainable Use License / commercial licensing boundaries | keep internal boundary; fresh SaaS/Embed review |

---

## License policy model

Provider Registry should support:

```text
license_id
license_snapshot_at
commercial_ready
territory_allowlist
territory_denylist
hosted_service_allowed
redistribution_allowed
model_asset_constraints
required_notices
review_required
```

Example:

```yaml
provider: liveportrait
commercial_ready: false
review_required: true
block_reason: "Default dependency chain may include InsightFace models restricted to non-commercial research."
```

Policy gates are evaluated before provider scoring.

---

## Dependency rule

A permissive top-level repository license does not automatically make every bundled item commercially deployable.

Before promoting an adapter to `PRODUCTION`, inventory:

- source-code license;
- model/checkpoint license;
- tokenizer/encoder/detector licenses;
- dataset/test asset restrictions;
- custom ComfyUI nodes;
- fonts;
- music/SFX;
- stock presenter/voice rights;
- external API terms;
- redistribution/hosting conditions.

---

## Artifact rule

Do not commit to Git:

- model weights;
- user presenter images;
- cloned voice samples;
- generated production videos;
- paid-provider responses containing temporary URLs;
- secrets/tokens;
- third-party media unless redistribution rights are clear.

Git should hold:

- adapter code;
- hashes/versions;
- workflow manifests where redistribution is permitted;
- license/attribution records;
- schemas;
- non-sensitive fixtures;
- benchmark metadata.

---

## SBOM / production gate

Before `INTEGRATED → PRODUCTION`:

- generate SBOM for each local worker image;
- record exact model/checkpoint hashes;
- record ComfyUI/custom-node commits;
- record FFmpeg build/config;
- verify model/commercial rights;
- verify territory restrictions;
- verify provider API terms;
- preserve required third-party notices;
- document any paid runtime licenses.

No adapter should inherit `commercial_ready=true` merely because its parent repository is open source.
