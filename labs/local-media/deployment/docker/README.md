# Docker (reservado para futura produção)

Nenhuma imagem Docker foi construída. Um Dockerfile só será criado quando o workflow API estiver aprovado e todas as versões de modelo/node puderem ser fixadas. Isso evita criar uma imagem grande, cara e difícil de reproduzir antes de saber o que realmente será usado.

Para RunPod Pod, Docker Compose não é suportado; uma futura imagem deve ser um contêiner único compatível com o template/worker escolhido. [Limitações de Pods](https://docs.runpod.io/pods/overview).
