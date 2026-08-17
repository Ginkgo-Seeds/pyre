# Instruções operacionais do projeto

Este repositório pertence a uma operação de conteúdo visual com ComfyUI. Qualquer pessoa ou agente que o altere deve explicar a ação em português claro antes de executá-la e, ao terminar cada etapa, informar: o que fez, por que fez, como testar, resultado esperado e como desfazer.

## Regras inegociáveis

1. Começar pelo Comfy Cloud; não criar Pod ou endpoint RunPod sem aprovação explícita.
2. Não baixar modelos grandes, instalar custom nodes ou iniciar treinamento de LoRA sem aprovação explícita e registro em `docs/models-and-nodes.md`.
3. Nunca gravar segredos. Usar variáveis de ambiente, manter `.env` ignorado e atualizar apenas `.env.example`.
4. Salvar todo workflow de ComfyUI em JSON em `workflows/`; manter a versão no nome e/ou nos metadados.
5. Antes de uma ação destrutiva ou de custo recorrente, criar um checkpoint documentado em `docs/05-checkpoints-de-validacao.md` e pedir confirmação.
6. Priorizar nodes nativos (core) e o menor número de modelos necessário.
7. Atualizar versões de modelos, ComfyUI e custom nodes em `docs/models-and-nodes.md` antes de depender deles.
8. Não usar imagens de pessoas reais como identidade de personagem sem comprovação de autorização.

## Convenções

- Personagem: somente adulta, fictícia e identificada por versão em `characters/`.
- Prompts: manter blocos reutilizáveis em arquivos `.md`, sem informação pessoal sensível.
- Saídas: usar `outputs/generated/`; nunca versionar mídia gerada por padrão.
- API: qualquer novo cliente deve aceitar configuração apenas por variáveis de ambiente e ter modo de simulação ou teste seguro.
