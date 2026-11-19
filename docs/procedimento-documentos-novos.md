# Procedimento: documentos novos → plataforma (Emendas)

Decidido com o dono em 19/11/2026. Repetir sempre que houver arquivos na pasta **Documentos novos** do Drive
(`1ZFytYfK-YeoSYemj-MrW26ehJizjmrnf`).

## Regras

1. **Original** → depois de tratado, move para **"Já adicionados a plataforma"** (`10asLbIs4Ku6oh_aM4LACckPGBW6BKVOv`),
   na subpasta da secretaria: Saúde `1GEdY1FyaS4gD5iTe5jmmHn9eyP2omcIv`, Desenvolvimento Social `1on0tuINbxIAd52EDH19tVxvLMVkFK1N-`,
   Meio Ambiente `1MWFzlpsAToF0CQwvc3IUyJqqblCT4zIM`, Educação `1jp7scCR2q0oiaC67LI_rXs5fAQtY0I5m`, Esporte `1bTW6lHDZ6TXGMKRm47-e_uCQ6JQPuym3`.
2. **A plataforma só aponta para a cópia da pasta PUBLICIDADE** (`15q9Cr9x2MyjmoXR6hmRvkr_zJLxhqAdE`), nunca para o original:
   - TERMO `1VPmRQk1MtTbwzsF4931Q-wgUccGteBi-` → `E{NNN} - TERMO - {NNN}-2026 (versao publica).pdf` (tarjado)
   - PLANO `1R9-iEMo2CeOPMiQUxzjOipyfqc95F9CX` → `E{NNN} - PLANO - plano (versao publica).pdf` (tarjado)
   - EXTRATO `1HirJFFDzE_0dT4iFR9JJDe3YbUNFC1pE` → `E{NNN} - EXTRATO - termo {NNN}-2026.pdf` (extrato não leva tarja)
   - `NNN` sempre com 3 dígitos (E020, termo 070-2026).
3. **Tarja** (termo, plano e outros anexos públicos): CPF, RG e telefone/endereço de pessoa física. Fica: CNPJ, nome do
   dirigente, conta bancária do termo (decisão do dono: banco/conta completos são publicados).
4. Nunca ligar pasta (só arquivo). Nunca sobrescrever campo do cadastro já preenchido; só preencher vazio, a partir do documento.
5. **Não tratar sem decisão**: contrato de rateio do Cisum (aguarda Jurídico), plano de trabalho que não bate com a emenda,
   pasta "Projeto Superação" (parada por ordem do dono). Em caso de dúvida (emenda não identificada, valor que não bate), perguntar.

## Passos

1. `search_files` na pasta; para cada arquivo, `read_file_content` e identificar **nº do termo, valor, entidade, nº da emenda**
   (o termo cita "Emenda Impositiva número NNN/2026"). Conferir no banco:
   `emendas.emendas` (numero, valor, beneficiário) e `emendas.documentos_drive` (já existe? evitar duplicar).
2. `download_file_content` → o PDF é salvo em arquivo local (caminho vem na resposta). Copiar para o scratchpad.
3. Tarja real com PyMuPDF (`python3 -I`): `search_for` + `add_redact_annot` + `apply_redactions`, para os padrões
   `\d{3}\.\d{3}\.\d{3}-\d{2}`, CPF/RG sem pontuação (`\d{9}-\d{2}`, `\d{11}`, `RG nº …`) e RGs com espaço no meio (ex.: `MG- 7.520.510`).
   **Conferir**: `pdftotext` sem nenhum CPF/RG restante, CNPJs e conta preservados, e olhar a página 1 renderizada.
   O CPF do Prefeito, do presidente da entidade, do secretário-gestor e do gestor da entidade aparecem em todo termo.
4. Subir com `create_file` (`base64Content` = `sha256:<hash>:<caminho absoluto>`, `contentMimeType=application/pdf`,
   `disableConversionToGoogleType=true`, `parentId` = subpasta da PUBLICIDADE, nome padrão acima).
   Extrato sem tarja: `copy_file` com o nome padrão.
5. Ligar no banco, igual às linhas existentes:
   `insert into emendas.documentos_drive (emenda_id, tipo, titulo, drive_file_id, drive_versao, publico, ficha, conferido_em)`
   com `publico = true`, `ficha = '{}'`, `drive_file_id` = id do arquivo da PUBLICIDADE.
   Tipos públicos: termo, plano_trabalho, extrato, anuencia_sus, relatorio_gestao, convenio.
6. Conferir `emendas.execucao` (nº do termo, vigência, conta, gestores): preencher só o que estiver vazio.
7. Mover o original com `update_file` (`parentId` = subpasta da secretaria).
8. Reportar: o que foi ligado, o que ficou de fora e por quê. Atualizar `docs/pendencias-emendas-2026-11-18.md` se mudar a contagem de "documentos faltando".

## Histórico

- 19/11/2026: Termo 70/2026 → E020 e Termo 71/2026 → E176 (EC São José). Tarjados, subidos na PUBLICIDADE/TERMO e ligados.
  Ficaram em "Documentos novos": *Extrato termo 125* (recorte misto; o E169 já tem extrato próprio e o do E168 vem incompleto) e
  *Extratos do termo 157* (termo 157/2026, TIBUM, R$ 40.206,83: nenhuma emenda tem esse termo/valor; aguarda o dono dizer a emenda).
