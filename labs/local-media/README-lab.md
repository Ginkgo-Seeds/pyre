# Comfy Content Studio

Base inicial para produzir conteúdo social com ComfyUI: uma influenciadora virtual fictícia, retratos, lifestyle, editoriais, carrosséis, capas, vídeo e produção em lote. A primeira fase é deliberadamente pequena: gera um retrato reprodutível, sem LoRA e sem nodes de terceiros.

## Estado desta entrega

- Plataforma escolhida: **Comfy Cloud**.
- Modelo previsto: **SDXL Base 1.0**; nenhum modelo foi baixado por este projeto.
- Nodes de terceiros: **nenhum**.
- Treinamento de LoRA: **não iniciado**.
- Execução API: preparada, mas não disparada (exige chave própria e plano Standard, Creator ou Pro; informação verificada na documentação oficial em 21/07/2026).

Leia primeiro [o diagnóstico](docs/00-diagnostico.md), [a decisão de plataforma](docs/01-decisao-plataforma.md) e [o guia do workflow](docs/03-workflow-retrato-consistente.md).

## Validação local, sem GPU e sem credenciais

No PowerShell, dentro desta pasta:

```powershell
python tests\validate_workflows.py
python api\submit_comfy_cloud.py --dry-run
```

Os dois comandos apenas validam JSON e montam a solicitação; não geram imagem, não baixam modelo e não enviam chave.

## Execução manual no Comfy Cloud

1. Entre no Comfy Cloud e importe `workflows/identity/portrait_consistent_manual_v01.json`.
2. No node **Load Checkpoint**, confirme o nome de checkpoint disponível. Se o arquivo não existir na lista, escolha um checkpoint SDXL compatível e faça a mesma troca no `.env` local.
3. Leia cada node em [docs/03-workflow-retrato-consistente.md](docs/03-workflow-retrato-consistente.md), execute uma imagem e avalie o rosto antes de mudar prompt ou seed.

O resultado esperado é um retrato editorial de uma personagem adulta fictícia, em 1024×1024. A seed fixa torna novas execuções do mesmo workflow reproduzíveis no mesmo ambiente; ela não substitui referência visual ou LoRA para consistência total.

## Execução por API

1. Copie `.env.example` para `.env` e preencha a chave somente nesse arquivo local.
2. Primeiro execute `python api\submit_comfy_cloud.py --dry-run`.
3. Depois, quando tiver uma chave e assinatura com acesso à API, execute `python api\submit_comfy_cloud.py`.

O cliente usa `COMFY_CLOUD_API_KEY` no cabeçalho HTTP, nunca grava a chave e permite mudar prompt, seed ou checkpoint por argumento. Detalhes em [docs/04-api-comfy-cloud.md](docs/04-api-comfy-cloud.md).

## Estrutura

```text
workflows/       Workflows versionados em JSON por finalidade
prompts/         Blocos de prompt revisáveis
characters/      Ficha da personagem fictícia e suas versões
references/      Imagens de referência aprovadas (vazio nesta fase)
api/             Cliente de submissão ao Comfy Cloud
deployment/      Preparação documentada para RunPod, sem implantação ativa
docs/            Decisões, guias e checkpoints
tests/           Validações sem rede
outputs/         Destino local planejado; o cliente atual ainda não baixa imagens do Cloud
```

Arquivos de mídia dentro de `outputs/generated/` são ignorados pelo Git. Consulte `outputs/README.md` para entender o que já funciona e o que ainda é planejado.

## Próxima porta de validação

Antes de baixar qualquer modelo ou gastar créditos, aprove o checkpoint SDXL disponível no Comfy Cloud e faça cinco execuções controladas do workflow. Critérios e próximos passos estão em [docs/05-checkpoints-de-validacao.md](docs/05-checkpoints-de-validacao.md).

Para preparar a primeira execução manual, siga [o checklist da primeira geração real](docs/06-primeira-geracao-real.md). O documento é apenas um guia: nenhuma geração é iniciada automaticamente.
