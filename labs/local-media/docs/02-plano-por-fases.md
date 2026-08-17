# Plano por fases

| Fase | Objetivo | Entregável | Porta de validação | Estado |
| --- | --- | --- | --- | --- |
| 0 — Fundação | Diagnóstico, estrutura e segurança | Este repositório, `.env.example`, JSONs e testes sem rede | Testes locais passam; nenhum segredo/modelo foi adicionado | Concluída |
| 1 — Identidade inicial | Escolher uma versão visual fictícia reproduzível, sem LoRA | Cinco retratos candidatos e ficha `virtual_creator_v02` aprovada | Mesmo checkpoint/prompt/seed reproduzem a candidata; direitos de referência verificados | Pronta para aprovação |
| 2 — Lifestyle e editorial | Criar variações de cenário, roupa e enquadramento preservando a personagem | Workflows em `lifestyle/` e `campaigns/` | Alterar uma variável por vez e comparar contra a imagem âncora | Pendente |
| 3 — Carrossel e capas | Produzir formatos 1:1, 4:5 e 9:16 com área segura para texto | Workflows em `carousel/` e roteiro visual | Exportação legível em tela de celular e sem texto gerado pela IA | Pendente |
| 4 — Lote e catálogo | Gerar variações controladas e registrar metadados | Manifests de lote, convenção de nomes e seleção humana | Lote pequeno de 10 imagens com custo, tempo e falhas medidos | Pendente |
| 5 — Keyframes e vídeo | Validar movimento vertical a partir de imagens aprovadas | Workflow de keyframes e teste de Reel | Identidade não degrada entre início/fim; direitos de áudio e vídeo verificados | Pendente |
| 6 — Automação | Integrar gatilho, fila, armazenamento e aprovação humana | Contrato de API para n8n; integração com Pyre somente após confirmar qual produto/API é usado | Nenhuma chave em código; idempotência e reexecução testadas | Pendente |
| 7 — Produção em RunPod | Migrar apenas o fluxo comprovado | Pod ou endpoint Serverless com versões fixadas | Teste de carga, custo por artefato, backup e desligamento validados | Pendente |

## Ordem de trabalho da Fase 1

1. Confirmar no Comfy Cloud o checkpoint SDXL exato disponível.
2. Atualizar o campo de checkpoint no workflow e no `.env` **local**, se necessário.
3. Gerar cinco sementes, preservando todo o resto.
4. Escolher uma candidata e registrar a seed, modelo, prompt e data.
5. Reexecutar a escolhida para verificar reprodutibilidade antes de expandir escopo.

## Fora de escopo nesta fase

- Treinar ou baixar LoRA.
- Instalar custom nodes.
- Criar Pod, endpoint ou imagem Docker.
- Automatizar publicação em rede social.
- Assumir qual sistema é “Pyre” sem a URL/documentação exata fornecida pela operação.
