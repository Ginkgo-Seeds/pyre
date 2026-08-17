# Decisão de plataforma

## Decisão

Usaremos **Comfy Cloud na Fase 1**. Não criaremos agora um RunPod Pod nem um endpoint RunPod Serverless.

## Por que esta é a escolha inicial

| Opção | Vantagem | Limite para esta fase | Decisão |
| --- | --- | --- | --- |
| Comfy Cloud | Não exige instalar ComfyUI ou administrar GPU; modelos e nodes disponíveis na plataforma; aceita workflow em JSON pela API. | A API exige plano Standard, Creator ou Pro e o catálogo de modelos precisa ser confirmado na conta. | **Usar agora** |
| RunPod Pod | Interface ComfyUI com controle de arquivos, nodes e modelos próprios; bom para desenvolvimento e depuração. | Exige escolher GPU, armazenar modelos, cuidar de volume e parar o Pod para controlar custo. | Preparar depois, se Cloud limitar o fluxo. |
| RunPod Serverless | Escala sob demanda e não cobra tempo ocioso de computação. | Requer empacotar e manter um worker/endpoint; cold start e armazenamento tornam o primeiro experimento mais complexo. | Só depois que o workflow for estável e houver demanda de lote. |

Essa escolha segue o princípio de começar com a menor superfície operacional. O Comfy Cloud usa a mesma lógica de workflow e sua API aceita o formato API do ComfyUI, o que preserva uma rota de migração. Em verificação feita em **21/07/2026**, a documentação oficial informava que o acesso por API do Cloud era experimental e estava disponível nos planos Standard, Creator e Pro; por isso esta entrega também contém uma versão manual completa. [Comfy Cloud](https://docs.comfy.org/get_started/cloud), [API do Comfy Cloud](https://docs.comfy.org/development/cloud/overview).

## Quando mudar de plataforma

Mude para **RunPod Pod** se qualquer condição abaixo for verdadeira:

- é preciso instalar modelo, LoRA ou custom node que não exista no Comfy Cloud;
- o workflow precisa ficar aberto para muitas iterações com controle total do ambiente;
- é necessário depurar arquivos e versões específicas do ComfyUI.

Mude para **RunPod Serverless** somente após todos estes critérios:

1. O JSON API foi executado com sucesso e está congelado em versão.
2. O modelo, nodes e suas versões estão documentados.
3. Há volume ou armazenamento de objetos definido para modelos e saídas.
4. A fila, as falhas e os custos por lote foram medidos em um teste piloto.
5. Existe uma necessidade real de receber solicitações automáticas, por exemplo via n8n.

RunPod descreve Pods como ambientes de GPU sob controle do operador, cobrados por minuto; os volumes persistentes exigem gestão deliberada. Serverless executa via endpoints que escalam sob demanda e precisa de armazenamento persistente para modelos e dados entre workers. [Visão de Pods](https://docs.runpod.io/pods/overview), [armazenamento de Pods](https://docs.runpod.io/pods/storage/types), [visão de Serverless](https://docs.runpod.io/serverless/overview), [armazenamento Serverless](https://docs.runpod.io/serverless/storage/overview).

## Como testar a decisão

1. Importe o workflow manual no Comfy Cloud.
2. Confirme se há um checkpoint SDXL compatível na conta.
3. Execute cinco imagens controladas, uma por vez, sem custom nodes.
4. Avalie identidade, qualidade e tempo por imagem.

Se isso funcionar, a decisão está validada. Se o Cloud não disponibilizar o checkpoint necessário ou impedir a experimentação, abra o checkpoint de migração para RunPod Pod — não pule diretamente para Serverless.

## Como desfazer

Não há recurso em nuvem criado. Para mudar de ideia, basta não executar no Comfy Cloud e seguir o plano de preparação de Pod; os JSONs permanecem portáveis.
