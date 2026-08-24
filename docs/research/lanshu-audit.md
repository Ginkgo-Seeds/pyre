# Auditoria técnica — `cclank/lanshu-create-ai-presenter-video`

> Upstream analisado: `https://github.com/cclank/lanshu-create-ai-presenter-video`
>
> Licença upstream: MIT.
>
> Objetivo desta auditoria: extrair os padrões de engenharia úteis sem acoplar Pyre a um modelo, fornecedor ou implementação específica.

## 1. Resumo executivo

O projeto Lanshu não é um gerador de vídeo completo por si só. Ele é uma **Skill de orquestração** que transforma uma solicitação de vídeo com apresentador em uma sequência controlada de produção, validação, geração, composição, QA e entrega.

O principal valor arquitetural está em seis decisões:

1. **narração final como relógio mestre** da timeline;
2. **state machine explícita** para impedir saltos de etapa;
3. **pilot gate** antes de geração longa/paga;
4. **roteamento por capacidade**, não por marca/modelo;
5. **evidência de execução e recuperação idempotente** para tarefas remotas;
6. **QA técnico + QA visual** antes de declarar o artefato concluído.

Para Pyre, esses padrões devem ser absorvidos, mas ampliados com Capability Bus, filas, score de providers, observabilidade, custos, versionamento de contratos, publicação multicanal e integração com o runtime Ginkgo.

---

## 2. Inventário upstream

Estrutura observada:

```text
lanshu-create-ai-presenter-video/
├── .github/
│   └── workflows/
│       └── validate.yml
├── agents/
│   └── openai.yaml
├── assets/
│   └── job.template.json
├── references/
│   ├── generation.md
│   ├── editing.md
│   └── qa-recovery.md
├── scripts/
│   ├── init_job.py
│   ├── preflight.py
│   └── finalize_delivery.sh
├── README.md
├── SKILL.md
├── LICENSE
└── .gitignore
```

---

## 3. Desmonte arquivo por arquivo

### 3.1 `README.md`

Responsabilidade:

- apresentar o projeto como Skill para Codex/agentes locais;
- definir requisitos mínimos;
- documentar o workflow macro;
- expor defaults de formato;
- declarar limites de privacidade, custo e segurança;
- orientar instalação local.

Padrões que vale manter:

- diferenciação clara entre **código gratuito** e **providers potencialmente pagos**;
- requirements explícitos (`Python`, `FFmpeg`, `ffprobe`, shell tooling);
- saída padrão vertical 9:16;
- aviso de autorização de imagem e voz;
- política de parar após repetidas falhas pagas.

Limitações para Pyre:

- não existe API formal de produto;
- não existe multi-tenant;
- não existe isolamento de jobs por workspace/cliente;
- não existe billing ledger central;
- não existe storage abstraction;
- não existe scheduler/publicador;
- não existe provider registry persistente.

### 3.2 `SKILL.md`

É o cérebro declarativo do upstream.

Define:

```text
intake
→ content_locked
→ audio_locked
→ visual_plan_locked
→ presenter_generated
→ composition_checked
→ rendered
→ verified
```

Pontos fortes:

- cada estado exige evidência;
- não permite gerar apresentador antes de travar a narração;
- prevê retomada do primeiro estado incompleto;
- separa geração, edição e QA em referências carregadas sob demanda;
- obriga registro de provider/model/version/task ID;
- diferencia falha de boca de falha de motion plate;
- trata tarefa remota interrompida como algo a ser consultado antes de reexecutado.

Melhoria Pyre:

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
→ published
```

Estados laterais:

```text
blocked
awaiting_approval
retrying
failed
cancelled
archived
```

### 3.3 `references/generation.md`

Responsabilidade:

- intake;
- autorização;
- script;
- voz;
- escolha de capacidade;
- billing gate;
- pilot gate;
- prompt do apresentador.

Padrão mais importante: **provider selection ocorre em runtime**.

Capabilities upstream:

- voice generation;
- main presenter;
- short motion;
- lip-sync repair;
- word timestamp ASR;
- timeline compositor;
- encoder/QA.

Pyre deve expandir para:

```text
content.script.generate
content.script.polish
media.voice.synthesize
media.voice.clone
media.audio.normalize
media.asr.transcribe
media.asr.word_timestamps
media.presenter.generate
media.presenter.animate
media.lipsync.repair
media.video.broll.generate
media.video.compose
media.video.encode
media.video.qa
media.video.publish
```

### 3.4 `references/editing.md`

Responsabilidade:

- selecionar rota visual;
- construir timeline determinística;
- gerir start/duration/source-offset;
- captions;
- keyword callouts;
- cover frame;
- export.

Excelente decisão:

```text
final_start
final_duration
source_start
```

são valores independentes.

Isso evita o erro comum em pipelines automáticos: alterar a abertura e acidentalmente reiniciar ou deslocar a fonte do apresentador.

Pyre deve representar cada asset de timeline como objeto versionado:

```json
{
  "track": "presenter",
  "start_ms": 0,
  "duration_ms": 4800,
  "source_offset_ms": 0,
  "asset_id": "asset_...",
  "muted": true
}
```

### 3.5 `references/qa-recovery.md`

Responsabilidade:

- QA de input;
- QA de áudio;
- QA de apresentador;
- QA da composição;
- QA da entrega;
- recovery recipes.

Ponto forte: falhas são tratadas por **classe de defeito** e não por “tentar novamente”.

Exemplos:

- mouth late + motion bom → lip-sync repair;
- identidade deriva → regenerar com motion reduzido;
- frozen PIP → revisar source offsets;
- loudness incorreto → normalização whole-program;
- tarefa remota interrompida → poll pelo task ID;
- três candidatos pagos rejeitados → stop gate.

Pyre deve transformar isso em um `failure taxonomy` machine-readable.

### 3.6 `assets/job.template.json`

O manifest upstream é simples e útil.

Blocos observados:

```text
input
creative
voice
plan
capabilities
manual_input_review
artifacts
qa
```

Limitações:

- `schema_version` é inteiro sem URI/versionamento semântico;
- não há tenant/workspace;
- não há idempotency key;
- não há timestamps de estado;
- não há actor/audit trail;
- não há budget ledger;
- não há provider candidates e routing score;
- não há provenance granular de asset;
- não há publicação/distribuição;
- não há retry policy por capability.

Pyre deve usar IDs globais e manifests append-friendly.

### 3.7 `scripts/init_job.py`

Responsabilidade:

- validar paths básicos;
- impedir overwrite de job não vazio;
- resolver dimensões por aspect ratio;
- criar estrutura de diretórios;
- popular `job.json`.

Padrões úteis:

- operação não destrutiva;
- paths resolvidos;
- limites de duração e dimensão;
- estrutura previsível por job.

Para Pyre:

- job creation deve virar API/command idempotente;
- diretório local deve ser uma implementação de `ArtifactStore`, não contrato principal;
- job ID deve ser UUID/ULID;
- arquivos pesados nunca devem entrar no Git.

### 3.8 `scripts/preflight.py`

Responsabilidade:

- probe via `ffprobe`;
- validar image/audio streams;
- verificar resolução e duração;
- separar `errors`, `warnings` e `remote_blockers`;
- exigir manual review flags;
- escrever relatório atomically.

Excelente distinção:

```text
ok != remote_ready
```

Um job pode ser tecnicamente válido, mas continuar bloqueado para execução remota.

Pyre deve preservar esse conceito como:

```text
validation_status
execution_readiness
approval_status
policy_status
```

### 3.9 `scripts/finalize_delivery.sh`

Responsabilidade:

- validar dependências;
- recusar overwrite;
- probe do render;
- medir loudness;
- aplicar loudnorm em duas passagens;
- gerar master e share copy;
- full decode;
- black-frame detection;
- contact sheet 3x3;
- delivery report.

Esse é o arquivo mais próximo de uma peça de produção real.

Padrões a absorver:

- `set -euo pipefail`;
- outputs não destrutivos;
- temporary directory;
- H.264/AAC/BT.709/yuv420p;
- `faststart`;
- decode completo pós-encode;
- relatório JSON;
- não expor paths absolutos em relatório compartilhável.

Pyre deve encapsular isso como `media.video.finalize` e permitir backends FFmpeg locais ou workers remotos.

### 3.10 `agents/openai.yaml`

Responsabilidade:

- metadados mínimos de interface;
- display name;
- short description;
- default prompt.

É suficiente para descoberta de Skill, mas não para Capability Registry Ginkgo.

Pyre precisa registrar também:

- capability name/version;
- lifecycle;
- input/output schema;
- required approvals;
- side effects;
- cost class;
- expected latency class;
- supported executors;
- required artifacts;
- fallback policy.

### 3.11 `.github/workflows/validate.yml`

Responsabilidade:

- CI básico da Skill.

Pyre deve ampliar CI com:

- schema validation;
- markdown links;
- contract tests;
- provider adapter conformance;
- fixture-based FFprobe checks;
- deterministic timeline tests;
- no-secret scans;
- dependency/license inventory.

---

## 4. O que copiar conceitualmente

### MUST KEEP

- audio master clock;
- pilot gate;
- state machine;
- runtime capability resolution;
- provider/task evidence;
- idempotent remote recovery;
- stop-after-repeated-paid-failure;
- technical + visual QA;
- deterministic timeline;
- full decode verification;
- portable reports.

### MODIFY

- local filesystem manifest → artifact abstraction;
- manual provider choice → routing engine;
- shell-only finalizer → worker capability;
- single-agent Skill → Skill + Capability Bus + executor adapters;
- generic JSON → versioned contracts;
- ad-hoc approvals → approval ledger.

### DO NOT COPY AS PRODUCT ARCHITECTURE

- provider calls diretamente dentro da Skill;
- paths absolutos como identidade de artefato;
- estado persistido somente em `job.json`;
- dependência de um compositor específico;
- n8n exposto ao usuário final;
- regeneração cega como estratégia de recovery.

---

## 5. Delta Lanshu → Ginkgo Pyre

| Dimensão | Lanshu | Pyre target |
|---|---|---|
| Orquestração | Skill local | Skill + Capability Bus + queue |
| Estado | `job.json` | Postgres + evidence ledger |
| Assets | filesystem | ArtifactStore abstraction |
| Providers | runtime manual/capability | registry + scoring + policy |
| Custos | aprovação manual | budget governor + ledger |
| Retry | regras textuais | typed retry/recovery policy |
| Render | shell FFmpeg | worker FFmpeg + optional compositor |
| ComfyUI | possível executor | provider adapter on-demand |
| Publicação | fora do escopo | Reels/TikTok/Shorts adapters |
| Multi-tenant | não | workspace/job isolation |
| Observabilidade | arquivos | events, metrics, traces, cost |
| Contratos | implícitos | `skill-request/result.v1` |
| Lifecycle | Skill única | FEATURE→PROTOTYPE→VALIDATED→INTEGRATED→PRODUCTION |

---

## 6. Decisão

**Status recomendado: ADOPT PATTERNS / DO NOT FORK AS PRODUCT CORE.**

A Skill upstream deve permanecer como referência arquitetural e opcionalmente como upstream monitorado. A implementação Ginkgo deve ser própria, provider-neutral e integrada ao Pyre/ai-stack.

O componente resultante chama-se neste repositório:

```text
content.presenter-video.generate
```

com sub-capabilities independentes para voz, ASR, presenter generation, lip-sync, composição, encode, QA e publicação.
