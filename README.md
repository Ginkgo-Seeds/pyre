# Ginkgo Pyre

Studio comercial de criação multimodal assistida por IA, inspirado em fluxos unificados de produção como Google Flow.

**Status:** produto oficial em desenvolvimento  
**Repositório canônico:** `ginkgoai/ginkgo-pyre`  
**Kernel:** Ginkgo Tree  
**Licença atual:** proprietária comercial, com versões históricas sob MIT

> Pyre é primeiro um studio de criação. Estratégia social, calendário e publicação são extensões de distribuição dos ativos produzidos, não a identidade principal do produto.

## Papel no ecossistema

```text
AI Stack — laboratório aberto Apache-2.0
        │
        ▼
Ginkgo Tree — autonomia, limites, memória e white-label
        │
        └── Pyre — multimodal AI creation studio
```

## Escopo principal

- ideação e desenvolvimento de conceitos;
- referências visuais e moodboards;
- roteiro, storyboard, cenas e planos;
- geração e edição de imagens;
- geração, montagem e continuidade de vídeo;
- áudio, voz, trilha e sincronização;
- personagens, ambientes e identidade visual persistentes;
- timeline, versões, takes, assets e projetos;
- transformação de formatos e aspect ratios;
- variações, experimentos e comparação de resultados;
- colaboração e aprovação humana;
- biblioteca de ativos e memória criativa;
- exportação para campanhas, redes, anúncios e canais;
- calendário e publicação como módulos opcionais;
- implantação dedicada ou white-label mediante contrato.

## Experiência pretendida

```text
Ideia / briefing
      │
      ▼
Projeto Pyre
  ├── referências e identidade
  ├── roteiro e storyboard
  ├── geração de cenas e assets
  ├── edição e continuidade
  ├── áudio e finalização
  └── versões, aprovação e exportação
```

O objetivo é reduzir a fragmentação entre ferramentas, preservando projeto, contexto, personagens, estilo, arquivos e histórico de decisões em um único ambiente assistido por IA.

## Fronteira de responsabilidades

### Pyre contém

- canvas, projetos, cenas, timeline e biblioteca de mídia;
- módulos de imagem, vídeo, áudio e edição;
- continuidade visual e identidade de personagens;
- workflows de criação e renderização;
- adaptadores de provedores multimodais;
- interface e navegação do studio;
- exportadores, publicadores e analytics criativos;
- testes, documentação e deploy da edição.

### Ginkgo Tree contém

- autenticação, organizações, RBAC e multi-tenancy;
- billing, metering, orçamento e carteira de tokens;
- agent runtime, autonomia, approvals e auditoria;
- secrets boundary e contratos de execução;
- Laplace para memória criativa, RAG, assets e proveniência;
- white-label, temas, domínios e componentes compartilhados.

Pyre deve consumir pacotes privados versionados `@ginkgo/*`; o kernel não deve ser copiado para este repositório.

## Arquitetura de alto nível

```text
Criador / Equipe
      │
      ▼
Pyre Studio
  ├── canvas e timeline
  ├── projetos, cenas e assets
  ├── agentes criativos assistivos
  ├── provedores de imagem, vídeo e áudio
  └── render, aprovação e exportação
      │
      ├──► Ginkgo Tree
      ├──► Laplace
      ├──► filas e workers de mídia
      └──► provedores e canais autorizados
```

## Princípios

1. **Projeto antes do prompt:** contexto e assets persistem ao longo da produção.
2. **Continuidade visual:** personagens, ambientes e estilos precisam de referência versionada.
3. **IA assistiva:** o usuário dirige; agentes sugerem, montam e executam dentro de limites.
4. **Proveniência:** ativos registram modelo, prompt, versão, fontes e direitos aplicáveis.
5. **Aprovação antes da publicação:** exportação externa obedece regras de marca e autorização.
6. **Produto não duplica kernel:** capacidades reutilizáveis retornam ao Ginkgo Tree.

## Desenvolvimento

- comportamento compartilhado → `ginkgo-tree`;
- criação multimodal e studio → `ginkgo-pyre`;
- exemplo genérico sanitizado → `ai-stack`.

Nunca versione tokens de provedores, mídia privada, identidade de clientes, exports de produção ou material sem direitos compatíveis.

## Licenciamento

Versões históricas foram publicadas sob MIT e permanecem cobertas por essa concessão, preservada em `LICENSES/MIT-2025.txt`. Novas revisões proprietárias seguem `LICENSE` e `LICENSING.md`.

Produção, hospedagem, distribuição, white-label, OEM e acesso ao código dependem de autorização escrita da Ginkgo AI Systems.
