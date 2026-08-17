# API do Comfy Cloud — guia seguro

## O que foi preparado

`api/submit_comfy_cloud.py` lê o workflow API-format e o envia para `POST /api/prompt`. O segredo fica exclusivamente na variável `COMFY_CLOUD_API_KEY`; o script não o imprime, não salva a chave e não depende de bibliotecas de terceiros.

O Comfy Cloud aceita workflows em formato API, cria um job assíncrono e devolve um `prompt_id`. Em verificação feita em **21/07/2026**, a documentação oficial informava que a API era experimental e estava disponível nos planos Standard, Creator e Pro. [Visão geral](https://docs.comfy.org/development/cloud/overview), [submissão de workflow](https://docs.comfy.org/api-reference/cloud/workflow/submit-a-workflow-for-execution).

## Ação 1 — validação sem rede

```powershell
python api\submit_comfy_cloud.py --dry-run
```

- **Por que:** confirma JSON, nodes e substituições sem custo e sem enviar dados.
- **Como testar:** o comando deve imprimir endpoint, checkpoint, seed, dimensões e número de nodes.
- **Resultado esperado:** `"mode": "dry-run"`; nenhuma imagem ou job é criado.
- **Como desfazer:** nada foi alterado.

## Ação 2 — configurar segredo local

```powershell
Copy-Item .env.example .env
notepad .env
```

Preencha somente `COMFY_CLOUD_API_KEY`. Confirme também o nome exato do checkpoint disponível no seu Cloud em `COMFY_CHECKPOINT_NAME`. Nunca envie `.env` em chat, commit ou captura de tela.

- **Por que:** separa configuração secreta do código que pode ser versionado.
- **Como testar:** `git status --ignored` deve mostrar `.env` como ignorado, quando o projeto estiver em Git.
- **Resultado esperado:** o comando normal consegue autenticar sem que a chave apareça na saída.
- **Como desfazer:** apague apenas o arquivo `.env`; `.env.example` continua como modelo sem segredo.

## Ação 3 — submeter uma imagem

```powershell
python api\submit_comfy_cloud.py
```

Variações pontuais, sem editar o JSON-base:

```powershell
python api\submit_comfy_cloud.py --seed 2407202602
python api\submit_comfy_cloud.py --checkpoint "NOME-CONFIRMADO-NA-SUA-CONTA.safetensors"
```

- **Por que:** mantém o workflow como contrato versionado e torna a variação explícita no histórico do terminal/automação.
- **Como testar:** a resposta deve conter `"status": "submitted"` e um `prompt_id`; acompanhe o job no Comfy Cloud.
- **Resultado esperado:** uma imagem em 1024×1024 salva pelo node 7 no armazenamento do Cloud.
- **Como desfazer:** cancele o job pela fila do Cloud se ele ainda estiver pendente; não há alteração no JSON local.

## Integração futura

n8n deverá chamar este mesmo contrato com parâmetros permitidos (prompt, seed, checkpoint) e armazenar `prompt_id`, versão do workflow e status. A integração com Pyre depende de identificar o produto e a documentação da API correta; não será adivinhada nem receberá chaves no repositório.
