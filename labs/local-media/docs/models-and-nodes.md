# Inventário de modelos e nodes

Atualizado em 21/07/2026. Este documento registra dependências aprovadas; não é uma ordem de download.

## Modelo necessário para o workflow v01

| Tipo | Identificador no workflow | Versão pretendida | Situação | Observação |
| --- | --- | --- | --- | --- |
| Checkpoint | `sd_xl_base_1.0.safetensors` | SDXL Base 1.0 | Não baixado nem confirmado no catálogo da conta | O nome é um padrão inicial. Antes de executar, confirmar a disponibilidade exata no Comfy Cloud e atualizar de modo consistente. |

O checkpoint deve fornecer modelo, CLIP e VAE compatíveis para o node `CheckpointLoaderSimple`. Não foram previstos refiner, LoRA, ControlNet, IP-Adapter ou modelo de vídeo nesta etapa.

## Nodes

| Node | Origem | Versão | Finalidade |
| --- | --- | --- | --- |
| CheckpointLoaderSimple | ComfyUI core | Conforme ambiente Cloud | Carrega modelo, CLIP e VAE. |
| CLIPTextEncode | ComfyUI core | Conforme ambiente Cloud | Codifica prompts positivo e negativo. |
| EmptyLatentImage | ComfyUI core | Conforme ambiente Cloud | Define canvas e lote. |
| KSampler | ComfyUI core | Conforme ambiente Cloud | Realiza a difusão. |
| VAEDecode | ComfyUI core | Conforme ambiente Cloud | Converte latente em pixels. |
| SaveImage | ComfyUI core | Conforme ambiente Cloud | Emite a imagem. |

## Custom nodes

**Nenhum instalado ou exigido.** Antes de incluir qualquer custom node, registrar repositório oficial, commit/tag, licença, finalidade, compatibilidade com Comfy Cloud/RunPod e procedimento de remoção.
