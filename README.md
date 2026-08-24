# ginkgo-pyre

IA de social media, calendário automático, copywriting e criação visual.

## Capability map

```text
Pyre
├── planning / content
├── creative generation
├── scheduling
├── publishing
└── content.presenter-video.generate
```

## Presenter Video Engine

Status inicial:

```text
FEATURE
```

Objetivo: transformar tema/roteiro + mídia autorizada em vídeo de apresentador verificável, provider-neutral e pronto para distribuição, usando a narração final como relógio mestre.

Arquitetura:

- `docs/architecture/presenter-video-engine.md` — desenho completo do motor;
- `docs/research/lanshu-audit.md` — auditoria arquivo por arquivo do upstream de referência;
- `capabilities/presenter-video/SKILL.md` — Skill/capability principal;
- `capabilities/presenter-video/PROVIDERS.md` — provider matrix e estratégia local/cloud;
- `capabilities/presenter-video/THIRD_PARTY.md` — inventário de licenças e gates;
- `capabilities/presenter-video/contracts/` — request/result/job/adapter/failure contracts;
- `capabilities/presenter-video/provider-registry.example.yaml` — exemplo de registry e routing profiles;
- `capabilities/presenter-video/workflows/n8n-orchestration.md` — topologia de workflows e recovery;
- `capabilities/presenter-video/BACKLOG.md` — implementação P0/P1/P2 e promotion gates.

### Fluxo alvo

```text
topic/script + authorized presenter
              ↓
         content lock
              ↓
          voice lock
              ↓
        audio + ASR QA
              ↓
          visual plan
              ↓
 provider routing + cost gate
              ↓
             pilot
              ↓
          pilot QA
              ↓
       full generation
              ↓
      lip-sync repair? ──┐
              ↓          │
       deterministic     │
        composition      │
              ↓          │
          render/QA ←────┘
              ↓
        publish_ready
              ↓
      optional publishing
```

### Arquitetura de execução

```text
Pyre Capability API
        ↓
Capability Bus
        ↓
Job / Evidence Ledger
        ↓
Provider Router + Cost Governor
        ↓
┌──────────────┬───────────────┬─────────────┐
│ Local/GPU    │ Cloud/API     │ Media       │
│ ComfyUI      │ providers     │ FFmpeg      │
│ model worker │               │ compositor  │
└──────────────┴───────────────┴─────────────┘
        ↓
QA + Artifact Store
        ↓
Publication adapters
```

### Invariantes

- provider fica atrás de adapter;
- Capability Bus é caller-agnostic;
- fallback somente com mesma semântica;
- aprovação não é confundida com gate externo;
- geração paga longa passa por pilot gate;
- task remota é consultada antes de qualquer resubmissão;
- vídeo não é considerado entregue sem full decode + QA;
- n8n é orquestrador interno, não fronteira de produto;
- assets/model weights/secrets permanecem fora do Git.

## Lifecycle

```text
FEATURE
→ PROTOTYPE
→ VALIDATED
→ INTEGRATED
→ PRODUCTION
```

Os critérios de promoção estão detalhados em `capabilities/presenter-video/BACKLOG.md`.
