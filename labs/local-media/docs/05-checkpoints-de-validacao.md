# Checkpoints de validação e reversão

## Checkpoint A — antes de gastar créditos

Confirme todos os itens antes da primeira execução:

- [ ] Um checkpoint SDXL compatível está visível na conta Comfy Cloud.
- [ ] O nome escolhido foi registrado no JSON manual e no `.env` local, se diferente do padrão.
- [ ] O prompt descreve uma pessoa fictícia adulta e não usa semelhança de pessoa real sem autorização.
- [ ] O teste local `python tests\validate_workflows.py` passou.
- [ ] O dry-run da API passou sem chaves expostas.

**Reversão:** se qualquer item falhar, não execute o workflow. Reimporte `v01` e corrija somente o item bloqueador.

## Checkpoint B — depois de cinco imagens

Registre para cada imagem: data, plataforma, checkpoint, versão do workflow, prompt, seed, duração aproximada e decisão. Escolha apenas uma candidata se ela cumprir os critérios abaixo:

- rosto coerente e claramente adulto;
- sem texto, marca-d’água ou deformação evidente;
- aparência apropriada para o posicionamento editorial planejado;
- reexecução com os mesmos valores preserva a candidata de forma satisfatória.

**Reversão:** se nenhuma imagem for aprovada, mantenha a ficha de personagem v01 e mude somente a seed em uma nova rodada. Não compense a incerteza instalando LoRA ou custom nodes.

## Checkpoint C — antes de expandir a operação

Só avance para lifestyle, lote ou vídeo quando houver uma candidata aprovada e a produção manual estiver documentada. Antes de modelos adicionais, LoRA, Pod ou Serverless, criar uma proposta que informe origem, licença, tamanho, VRAM, custo estimado, versão e plano de reversão.

**Reversão:** o baseline `portrait_consistent_*_v01.json` continua como referência e nunca deve ser editado silenciosamente.
