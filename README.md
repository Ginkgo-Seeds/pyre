# Ginkgo Pyre

Plataforma comercial de conteúdo, mídia e operações sociais conduzidas por agentes de IA.

**Status:** produto oficial em desenvolvimento  
**Repositório canônico:** `ginkgoai/ginkgo-pyre`  
**Kernel:** Ginkgo Tree  
**Licença atual:** proprietária comercial, com versões históricas sob MIT

> Pyre é uma distribuição vertical do Ginkgo Tree. Este repositório contém somente módulos de estratégia editorial, geração de mídia, publicação, reciclagem e análise social. Identidade, tenancy, billing, políticas, auditoria, execução e white-label pertencem ao kernel compartilhado.

## Papel no ecossistema

```text
AI Stack — laboratório aberto Apache-2.0
        │
        ▼
Ginkgo Tree — kernel comercial e white-label OS
        │
        └── Pyre — conteúdo e social operations
```

## Escopo do produto

- calendário editorial multi-marca;
- pesquisa, pauta e estratégia de conteúdo;
- copywriting e adaptação por canal;
- geração e transformação de imagens, áudio e vídeo;
- reciclagem de conteúdo longo em formatos curtos;
- publicação e agendamento multicanal;
- aprovação humana por risco e marca;
- experimentos de criativos e variações;
- analytics, aprendizado e realimentação da pauta;
- operação dedicada ou white-label mediante contrato.

## Fronteira de responsabilidades

### Este repositório contém

- módulos editoriais e media factory;
- adaptadores de redes sociais;
- workflows e políticas de publicação;
- interface e navegação específicas do Pyre;
- templates de conteúdo e schemas de campanha;
- métricas e loops de aprendizado social;
- testes, documentação e deploy da edição.

### Ginkgo Tree contém

- autenticação, organizações, RBAC e multi-tenancy;
- billing, metering e carteira de tokens;
- agent runtime, skills, approvals e auditoria;
- secrets boundary e contratos de execução;
- white-label, temas, domínios e componentes compartilhados.

Pyre deve consumir pacotes privados versionados do namespace `@ginkgo/*`. Não copie o kernel para este repositório.

## Arquitetura de alto nível

```text
Operador / Marca
      │
      ▼
Pyre Web ──► módulos editoriais
                  │
                  ├──► Ginkgo Tree kernel
                  ├──► filas e workers de mídia
                  ├──► n8n como executor limitado
                  ├──► provedores de geração
                  └──► publicadores e analytics
```

## Princípios

1. **Marca como política:** tom, identidade, restrições e aprovação são dados versionados.
2. **Publicação controlada:** ações externas obedecem autorização, calendário e kill switch.
3. **Proveniência:** ativos gerados registram modelo, prompt, versão e fontes permitidas.
4. **Direitos autorais e de imagem:** materiais precisam de origem e permissão compatíveis.
5. **Medição fecha o loop:** performance realimenta pauta e experimentos.
6. **Produto não duplica kernel:** capacidades reutilizáveis retornam ao Ginkgo Tree.

## Desenvolvimento

- comportamento reutilizável por várias edições → `ginkgo-tree`;
- comportamento exclusivo de conteúdo/social → `ginkgo-pyre`;
- exemplo genérico e sanitizado → `ai-stack`.

Nunca versione tokens sociais, contas de clientes, mídia privada, exports de produção ou dados analíticos identificáveis.

## Licenciamento

Este repositório possuía versões históricas sob MIT. A licença histórica está preservada em `LICENSES/MIT-2025.txt`. Novas revisões proprietárias seguem `LICENSE` e `LICENSING.md`.

Produção, hospedagem, distribuição, white-label, OEM e acesso ao código dependem de autorização escrita da Ginkgo AI Systems.
