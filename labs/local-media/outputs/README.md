# Outputs locais

Esta pasta é um destino local planejado para artefatos gerados e seus exemplos de metadados. O cliente `api/submit_comfy_cloud.py` atual apenas submete o workflow e mostra o `prompt_id`: ele ainda não acompanha o job nem baixa imagens do Comfy Cloud.

## Organização

- `generated/`: reservado para imagens e outros arquivos gerados. Toda mídia nessa pasta é ignorada pelo Git; apenas `.gitkeep` mantém a estrutura vazia no repositório.
- `generation_log.example.json`: modelo sem dados reais para registrar uma geração futura.

Não coloque chaves, tokens, informações pessoais ou dados sensíveis nos nomes de arquivo ou logs. Ao usar o modelo de log, salve os registros reais em um local aprovado para a operação e confirme se eles devem ou não ser versionados antes de adicioná-los ao Git.

## Estado atual

Nenhuma mídia foi gerada ou baixada por esta entrega. A existência da pasta não significa que o fluxo de download esteja implementado.

## Como testar

Execute `git check-ignore -v outputs/generated/test.png`. O resultado esperado é uma regra de `.gitignore` protegendo o arquivo de exemplo. Execute também `git check-ignore outputs/generated/.gitkeep`; o resultado esperado é que `.gitkeep` não esteja ignorado.

## Como desfazer

Remova somente os arquivos locais que você criou dentro de `outputs/generated/`. Não remova registros ou mídia de terceiros sem confirmar origem, propriedade e necessidade de retenção.
