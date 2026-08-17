# Checklist da primeira geração real

Este guia prepara uma única geração manual no Comfy Cloud. Segui-lo até a etapa de revisão não cria recursos automaticamente. A execução descrita na etapa 7 consome créditos; faça isso somente depois de confirmar todos os itens do Checkpoint A em `docs/05-checkpoints-de-validacao.md`.

## Antes de começar

- [ ] Você está usando uma conta própria e autorizada do Comfy Cloud.
- [ ] Há saldo ou créditos suficientes para uma única imagem.
- [ ] O workflow foi validado localmente com `python tests\validate_workflows.py`.
- [ ] A personagem é fictícia, adulta e não usa a identidade de uma pessoa real.
- [ ] Você decidiu executar somente uma imagem, sem lote e sem repetir o botão.

Se algum item estiver pendente, pare aqui. Nenhum Pod, modelo, custom node ou LoRA deve ser criado para contornar a pendência.

## 1. Abrir o Comfy Cloud

1. Abra o navegador e acesse [https://cloud.comfy.org](https://cloud.comfy.org).
2. Entre na conta autorizada para o projeto.
3. Confirme que está no ambiente do Comfy Cloud antes de importar qualquer arquivo.

**Como verificar:** a interface deve mostrar um canvas de workflow e os controles da conta Cloud. Se a tela pedir criação de Pod ou instalação local, você não está seguindo o caminho desta fase.

## 2. Importar o workflow manual

1. Na interface, localize a opção de abrir ou importar workflow. O nome do menu pode variar conforme a versão da interface.
2. Selecione o arquivo local:

   ```text
   workflows/identity/portrait_consistent_manual_v01.json
   ```

3. Aguarde o canvas terminar de carregar antes de clicar em qualquer botão de execução.

**Resultado esperado:** o canvas mostra um grafo com sete nodes conectados.

## 3. Confirmar os sete nodes

Confira os nodes pelo nome e pela função:

| Número | Node | Função |
| --- | --- | --- |
| 1 | `CheckpointLoaderSimple` | Carrega modelo, CLIP e VAE. |
| 2 | `CLIPTextEncode` | Interpreta o prompt positivo. |
| 3 | `CLIPTextEncode` | Interpreta o prompt negativo. |
| 4 | `EmptyLatentImage` | Define uma imagem 1024×1024 e lote 1. |
| 5 | `KSampler` | Executa a amostragem com seed fixa. |
| 6 | `VAEDecode` | Converte o resultado latente em imagem. |
| 7 | `SaveImage` | Mostra e salva a saída no ambiente Cloud. |

Além dos nomes, confira visualmente se existem linhas ligando as caixas. O `KSampler` deve receber modelo, prompt positivo, prompt negativo e imagem latente.

## 4. Identificar nodes ausentes ou inválidos

Um node pode estar inválido quando aparece vermelho, com borda de erro, com o texto `Unknown`, sem seus controles ou com uma ligação interrompida. Mensagens como “node type not found”, “missing input” ou “invalid workflow” também indicam problema.

Se isso acontecer:

1. Não execute o workflow.
2. Anote o nome ou número do node e a mensagem exibida.
3. Feche o workflow sem salvar alterações sobre o arquivo v01.
4. Importe novamente o JSON original.
5. Se o erro persistir, registre a versão do Comfy Cloud e interrompa a etapa para diagnóstico.

Não instale custom nodes: todos os sete nodes deste workflow devem existir no ComfyUI core.

## 5. Verificar o checkpoint disponível

1. Abra o seletor do node 1, `CheckpointLoaderSimple`.
2. Procure exatamente por `sd_xl_base_1.0.safetensors`.
3. Se ele aparecer, selecione-o e registre o nome exatamente como exibido.
4. Confirme que o node não mostra erro de arquivo ou modelo ausente.

## 6. Se `sd_xl_base_1.0.safetensors` não existir

Não baixe nem importe um modelo nesta etapa.

1. Abra a lista de checkpoints disponíveis na própria conta.
2. Procure um checkpoint SDXL compatível já disponibilizado pelo Comfy Cloud.
3. Registre o nome exato do candidato, mas não suponha compatibilidade apenas pelo nome.
4. Confirme origem, licença e compatibilidade antes de usá-lo.
5. Para o teste manual aprovado, selecione o checkpoint confirmado somente na interface e registre a troca no log.

Se não houver checkpoint SDXL compatível, pare. Não avance para RunPod, LoRA ou custom nodes sem nova aprovação.

## 7. Executar somente uma imagem

Antes de executar, confira:

- `EmptyLatentImage`: largura 1024, altura 1024 e lote 1;
- `KSampler`: seed `2407202601`, 28 steps, CFG 6, sampler Euler, scheduler normal e denoise 1;
- prompts positivo e negativo inalterados;
- checkpoint confirmado e registrado.

Clique uma única vez no botão de executar ou enfileirar prompt. Não clique novamente enquanto o job estiver pendente ou em andamento.

**Resultado esperado:** um único job e uma única imagem. Se houver erro, registre a mensagem e não repita automaticamente.

## 8. Localizar a imagem

Quando o job terminar, procure primeiro a prévia no node 7, `SaveImage`. A saída também pode aparecer no histórico ou na área de arquivos/outputs do Comfy Cloud, conforme a versão da interface.

O cliente Python atual não baixa essa imagem para `outputs/`. Qualquer cópia local nesta fase precisa ser uma ação manual e consciente, usando um nome que não exponha informações pessoais. Arquivos em `outputs/generated/` não são versionados.

## 9. Registrar a geração

Copie `outputs/generation_log.example.json` para um arquivo local de trabalho fora do Git ou use a tabela abaixo. Não substitua o arquivo de exemplo com dados reais.

| Campo | Valor a registrar |
| --- | --- |
| Data | Data e hora com fuso, por exemplo no padrão ISO 8601. |
| Modelo | Nome exato do checkpoint selecionado. |
| Seed | `2407202601`, salvo se uma mudança tiver sido aprovada. |
| Prompt | Texto positivo completo usado na execução. |
| Resolução | Largura × altura; esperado: 1024×1024. |
| Duração | Tempo entre início e conclusão, em segundos. |
| Avaliação | Notas de 0 a 5 e observações objetivas. |

Registre também a versão `portrait_consistent_manual_v01`, o provedor `comfy_cloud`, o nome do arquivo e qualquer mensagem de erro.

## 10. Avaliar a imagem de 0 a 5

Use a mesma escala para todos os critérios:

- **0:** falha total ou impossível de avaliar;
- **1:** problema grave;
- **2:** abaixo do aceitável;
- **3:** aceitável, mas precisa melhorar;
- **4:** bom e utilizável;
- **5:** excelente para o objetivo atual.

| Critério | O que observar |
| --- | --- |
| Identidade | Correspondência com os traços âncora da ficha `virtual_creator_v01`. |
| Naturalidade | Pele, expressão, cabelo e roupa parecem naturais, sem aparência excessivamente artificial. |
| Anatomia | Rosto, olhos, mãos e proporções não apresentam deformações. |
| Iluminação | Luz coerente, agradável e sem áreas estouradas ou sombras incoerentes. |
| Qualidade fotográfica | Nitidez, textura, enquadramento e ausência de ruído ou artefatos. |
| Adequação para redes sociais | Imagem atraente, segura, coerente com o posicionamento e aproveitável no formato planejado. |

Não aprove uma identidade apenas pela média. Uma nota 0 ou 1 em anatomia, identidade ou adequação deve bloquear a imagem. Registre a decisão como `aprovada`, `rejeitada` ou `requer revisão`, com uma justificativa curta.

## Encerramento seguro

- [ ] Exatamente uma imagem foi executada.
- [ ] Modelo, seed, prompt, resolução, duração e avaliação foram registrados.
- [ ] Nenhum segredo foi copiado para o log.
- [ ] Nenhuma mídia gerada foi adicionada ao Git.
- [ ] Nenhuma segunda execução foi iniciada sem nova decisão consciente.

**Como desfazer:** cancele o job no Comfy Cloud se ele ainda estiver pendente. Para mudanças feitas apenas no canvas, feche sem sobrescrever o JSON v01 e importe o arquivo original novamente. A geração já concluída pode consumir créditos e não pode ser desfeita; sua mídia deve ser removida manualmente do armazenamento Cloud se a operação decidir descartá-la.
