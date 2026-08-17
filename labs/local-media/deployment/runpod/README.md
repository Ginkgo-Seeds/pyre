# Preparação para RunPod (não implantada)

Não existe Pod, volume, chave nem endpoint criado nesta entrega. Esta pasta existe para receber a configuração apenas quando a validação no Comfy Cloud justificar a migração.

## Quando usar Pod

Use um Pod para desenvolver e depurar workflows que dependam de modelos ou custom nodes fora do catálogo Cloud. O Pod oficial de ComfyUI expõe normalmente a interface HTTP e pode preservar modelos em volume; parar e editar Pods têm implicações de armazenamento e reinicialização. Consulte [o tutorial oficial de ComfyUI em Pod](https://docs.runpod.io/tutorials/pods/comfyui) antes de criar recursos.

## Quando usar Serverless

Use Serverless somente com workflow API estabilizado, imagem de worker versionada, armazenamento persistente e estimativa de cold start/custo por artefato. O RunPod tem guia específico para [ComfyUI em Serverless](https://docs.runpod.io/tutorials/serverless/comfyui).

## Próxima ação permitida

Após a aprovação do Checkpoint C, elaborar uma proposta sem aplicar infraestrutura: GPU candidata, tamanho de disco/volume, modelo/nodes, variáveis de ambiente, tempo de desligamento, estratégia de backup e estimativa de custo. Não usar chaves reais no arquivo de proposta.
