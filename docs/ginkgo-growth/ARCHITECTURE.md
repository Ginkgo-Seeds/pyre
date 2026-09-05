# Ginkgo Growth — Technical Architecture

## End-to-end topology

```mermaid
flowchart TB

subgraph SRC[Sources]
  S1[Gabriel Live / YouTube / Stream]
  S2[Manual video/audio upload]
  S3[Screen demo / product recording]
  S4[GitHub PR / Release / Commit]
  S5[Ginkgo product events]
  S6[Research / News / Trends]
  S7[Comments / DMs / Questions]
  S8[Historical Analytics]
end

subgraph ING[Ingestion]
  I0[MEDIA-00 Intake Router]
  I1[MEDIA-01 Live Ingest]
  I2[MEDIA-02 File Ingest]
  I3[MEDIA-03 Product Signals]
  I4[MEDIA-04 Trend Radar]
  I5[MEDIA-05 Audience Signals]
end

S1-->I1
S2-->I2
S3-->I2
S4-->I3
S5-->I3
S6-->I4
S7-->I5
S8-->I5
I1-->I0
I2-->I0
I3-->I0
I4-->I0
I5-->I0

subgraph DATA[Data Plane]
  PG[(Supabase / PostgreSQL)]
  Q[(Redis / BullMQ)]
  OBJ[(R2 / S3 / Supabase Storage)]
  VEC[(pgvector / Qdrant)]
end

I0-->PG
I0-->Q
I0-->OBJ

subgraph CONTROL[Control Plane]
  RT[Ginkgo Runtime]
  BUS[Capability Bus]
  POL[Policy Engine]
  COST[Cost Governor]
  ARS[Ginkgo Arsenal]
  SEC[Credential refs / Vault]
end
RT-->BUS-->POL-->COST-->ARS
SEC-->ARS

subgraph INTEL[Content Intelligence]
  C10[MEDIA-10 Transcription]
  C11[MEDIA-11 Semantic Segmentation]
  C12[MEDIA-12 Knowledge Extraction]
  C13[MEDIA-13 Topic + Hook Scoring]
  C14[MEDIA-14 Editorial Planner]
  C15[MEDIA-15 Brand Splitter]
  C16[MEDIA-16 Content Atomizer]
  C17[MEDIA-17 Script Factory]
end
I0-->C10-->C11-->C12-->C13-->C14-->C15-->C16-->C17
C10-->PG
C11-->PG
C12-->VEC
C13-->PG
C14-->PG
C16-->PG
C17-->PG

subgraph MODEL[Model Router]
  MR[LLM Router]
  OAI[OpenAI]
  ANT[Anthropic]
  GEM[Gemini]
  LOC[LiteLLM / Local]
end
C12-->MR
C13-->MR
C14-->MR
C16-->MR
C17-->MR
MR-->OAI
MR-->ANT
MR-->GEM
MR-->LOC

subgraph MEDIA[Media Generation Fabric]
  M20[MEDIA-20 Asset Router]
  M21[MEDIA-21 Human Clip Extractor]
  M22[MEDIA-22 Voice]
  M23[MEDIA-23 Image]
  M24[MEDIA-24 Video]
  M25[MEDIA-25 Diagram / Motion]
  M26[MEDIA-26 Screenshot / Capture]
  M27[MEDIA-27 Captions]
  EL[ElevenLabs]
  IMG[GPT Image / Flux]
  CF[ComfyUI]
  HF[Higgsfield]
  REM[Remotion]
  FF[FFmpeg]
end
C17-->M20
M20-->M21
M20-->M22-->EL
M20-->M23
M23-->IMG
M23-->CF
M20-->M24
M24-->HF
M24-->CF
M20-->M25
M20-->M26
M20-->M27
M21-->REM
M22-->REM
M23-->REM
M24-->REM
M25-->REM
M26-->REM
M27-->REM
REM-->FF
FF-->OBJ
FF-->PG

subgraph QA[Quality + Governance]
  Q30[MEDIA-30 QA Coordinator]
  QE[Editorial QA]
  QB[Brand QA]
  QF[Fact QA]
  QV[Visual QA]
  QAUD[Audio QA]
  QD[Duplicate QA]
  QP[Platform QA]
  QR[Risk Classification]
end
FF-->Q30
Q30-->QE
Q30-->QB
Q30-->QF
Q30-->QV
Q30-->QAUD
Q30-->QD
Q30-->QP
Q30-->QR

subgraph APPROVAL[Approval]
  RISK{Risk class}
  GREEN[GREEN / Autopublish]
  YELLOW[YELLOW / Approval]
  RED[RED / Manual only]
  CHAT[Telegram / WhatsApp approval]
end
Q30-->RISK
RISK--GREEN-->GREEN
RISK--YELLOW-->YELLOW-->CHAT
CHAT--Approve-->GREEN
CHAT--Regenerate-->M20
RISK--RED-->RED

subgraph GROWTH[Growth Engine]
  G01[GROWTH-01 Campaign Designer]
  G02[GROWTH-02 CTA Optimizer]
  G03[GROWTH-03 Lead Magnet Factory]
  G04[GROWTH-04 Experiment Builder]
  G05[GROWTH-05 Funnel Resolver]
end
C14-->G01
C16-->G01
G01-->G02-->G03-->G04-->G05
G01-->PG
G03-->OBJ
G04-->PG

subgraph SCHED[Scheduler]
  S40[MEDIA-40 Inventory]
  S41[MEDIA-41 Calendar Planner]
  S42[MEDIA-42 Saturation Guard]
  S43[MEDIA-43 Best-time Selector]
  S44[MEDIA-44 Publish Queue]
end
GREEN-->S40
G05-->S40
S40-->S41-->S42-->S43-->S44-->Q

subgraph PUB[Publisher Adapters]
  P50[MEDIA-50 Publisher Router]
  IG[Instagram / Meta]
  FB[Facebook / Meta]
  TH[Threads]
  TT[TikTok Business]
  YT[YouTube]
  X[X]
  LI[LinkedIn]
  CMS[Blog / CMS]
  POSTIZ[Postiz Adapter]
end
Q-->P50
P50-->IG
P50-->FB
P50-->TH
P50-->TT
P50-->YT
P50-->X
P50-->LI
P50-->CMS
P50-->POSTIZ
P50-->PG

subgraph ENG[Engagement Engine]
  E10[GROWTH-10 Comment Listener]
  E11[GROWTH-11 Keyword Resolver]
  E12[GROWTH-12 DM Router]
  E13[GROWTH-13 Follow / Eligibility Gate]
  E14[GROWTH-14 Asset Delivery]
  E15[GROWTH-15 Conversation State]
end
IG-->E10
TH-->E10
TT-->E10
X-->E10
LI-->E10
E10-->E11-->E12-->E13-->E14-->E15-->PG

subgraph LEADS[Lead Engine]
  L20[GROWTH-20 Lead Capture]
  L21[GROWTH-21 Identity Resolution]
  L22[GROWTH-22 Intent Graph]
  L23[GROWTH-23 Lead Scoring]
  L24[GROWTH-24 Qualification]
  L25[GROWTH-25 CRM Sync]
end
E14-->L20-->L21-->L22-->L23-->L24-->L25
L20-->PG
L22-->VEC
L23-->PG

subgraph CRM[CRM + Sales]
  OPS[Ginkgo Ops]
  CALLIMA[Callima]
  WA[WhatsApp / Evolution]
  EMAIL[Email]
  CAL[Calendar]
  HUMAN[Human Sales]
end
L25-->OPS-->CALLIMA
CALLIMA-->WA
CALLIMA-->EMAIL
CALLIMA-->CAL
CALLIMA-->HUMAN

subgraph NURTURE[Nurture + Referral + Paid]
  N30[GROWTH-30 Nurture]
  N31[GROWTH-31 Referral]
  N32[GROWTH-32 Retargeting Builder]
  ADS[Meta / TikTok / Other Ads]
end
OPS-->N30
N30-->N31
N30-->N32-->ADS

subgraph ANALYTICS[Analytics + Learning]
  A01[ANALYTICS-01 Social Metrics]
  A02[ANALYTICS-02 Normalizer]
  A03[ANALYTICS-03 Attribution]
  A04[ANALYTICS-04 Winner Detector]
  A05[ANALYTICS-05 Growth Scoring]
  A06[ANALYTICS-06 Experiment Resolver]
  A07[ANALYTICS-07 Next Brief]
end
IG-->A01
FB-->A01
TH-->A01
TT-->A01
YT-->A01
X-->A01
LI-->A01
CMS-->A01
A01-->A02-->A03-->A04-->A05-->A06-->A07
A01-->PG
A03-->PG
A04-->PG
A06-->PG
A07-->C14
A07-->S1

subgraph OBS[Observability]
  O1[OPS-01 Execution Logger]
  O2[OPS-02 Failure Recovery]
  O3[OPS-03 Dead Letter Queue]
  O4[OPS-04 Cost Meter]
  O5[OPS-05 SLA Monitor]
  O6[OPS-06 Audit Evidence]
end
Q-->O1
PG-->O1
O1-->O2-->O3
O1-->O4
O1-->O5
O1-->O6
```

## Runtime boundary

```mermaid
flowchart LR
  INTENT[Media / Growth Intent] --> RT[Ginkgo Runtime]
  RT --> POL[Policy]
  POL --> BUS[Capability Bus]
  BUS --> N8N[n8n Executor]
  BUS --> API[Direct API Executor]
  BUS --> HUMAN[Human Approval]
  N8N --> MW[MEDIA workflows]
  N8N --> GW[GROWTH workflows]
  N8N --> AW[ANALYTICS workflows]
  N8N --> OW[OPS workflows]
  MW --> RES[Normalized Result]
  GW --> RES
  AW --> RES
  OW --> RES
  API --> RES
  HUMAN --> RES
  RES --> EVID[Evidence]
  EVID --> RT
```

## Physical deployment target

```mermaid
flowchart TB
  subgraph VERCEL[Vercel]
    DASH[Media/Growth Dashboard]
    LANDING[Dynamic Lead Magnet Pages]
  end

  subgraph SUPA[Supabase]
    AUTH[Auth]
    DB[(Postgres)]
    STORE[(Storage)]
    VECTOR[(pgvector)]
  end

  subgraph VPS[Hostinger VPS]
    N8N[n8n Main]
    WORKER[n8n Worker]
    REDIS[(Redis)]
    RUNTIME[Ginkgo Runtime]
    RENDER[Remotion / FFmpeg worker]
    POSTIZ[Postiz]
  end

  subgraph GPU[GPU / Cloud GPU]
    COMFY[ComfyUI]
  end

  subgraph EXT[External Providers]
    OPENAI[OpenAI]
    ANTHROPIC[Anthropic]
    GEMINI[Gemini]
    ELEVEN[ElevenLabs]
    HIGGS[Higgsfield]
    META[Meta]
    TIKTOK[TikTok]
    XAPI[X]
    LINKEDIN[LinkedIn]
    YOUTUBE[YouTube]
  end

  DASH-->RUNTIME
  LANDING-->DB
  RUNTIME-->N8N
  N8N-->WORKER
  N8N-->DB
  N8N-->STORE
  N8N-->REDIS
  WORKER-->RENDER
  WORKER-->COMFY
  N8N-->OPENAI
  N8N-->ANTHROPIC
  N8N-->GEMINI
  N8N-->ELEVEN
  N8N-->HIGGS
  N8N-->META
  N8N-->TIKTOK
  N8N-->XAPI
  N8N-->LINKEDIN
  N8N-->YOUTUBE
  N8N-->POSTIZ
```

## Design rule

No provider, social network, or model is allowed to become the architecture. All integrations must be replaceable behind contracts and adapters.