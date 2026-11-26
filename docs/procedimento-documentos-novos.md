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
- 23/11/2026: **Planos** E091 (termo 098) e E209 (termo 063) e **extratos** E139 (060), E144 (061), E148 (101), E206 (062), E209 (063). Planos eram escaneados e de cabeça para baixo: giraram, OCR (tesseract) para achar CPF/identidade/telefone/e-mail/endereço de contato, tarja desenhada na imagem e PDF refeito (a tarja é gravada na imagem, não é camada). Extratos vinham como página inteira do jornal (várias publicações): recorte só do extrato, com legenda "Fonte: Jornal Cataguases, data, página". Originais movidos para "Já adicionados a plataforma / Educação".
  Ficaram: PT 114 (35 MB) e PT 206 (13 MB), maiores que o limite de 10 MB do conector (pedir cópia menor); PT 110 (arquivo é uma folha em branco); pasta "termo anuência sus" (ofícios SMS/DIRA-JUR 0949 a 0963 e 0656-0660, Superação e Cisum; **0981 é pedido de compra de medicamento, não é de emenda**), aguardando decisão por serem do Superação (parado) e do Cisum (Jurídico).
- 23/11/2026 (anuências): ofícios SMS/DIRA-JUR **0656 (E93), 0658 (E126), 0660 (E162)**, do Cisum, conferidos (emenda, valor, vereador e destinatário batem com o cadastro), copiados para PUBLICIDADE/"4 - Anuencias do SUS" como `E093 - ANUENCIA-SUS - oficio 0656-2026.pdf` etc., ligados e `execucao.anuencia_sus = 'sim'`. **Esses ofícios não têm data nem assinatura digital** (assinatura manuscrita "p/" do coordenador executivo Ricardo Mattos, matrícula 505529, pela Secretária Fernanda Rocha Guedes): `anuencia_sus_data` ficou vazia. Originais movidos para Saúde. Os 15 ofícios do Superação (0949-0963) foram lidos mas **não ligados** (Superação parado); o 0953 cita "Emenda nº 053", mas valor e autor (R$ 10.000, Marco da Costa Garcia) são da **E59**. As 18 anuências já publicadas trazem o CPF da Secretária no carimbo da assinatura digital (conferir a tarja).
- 23/11/2026 (tarde): planos **E114**, **E168** (Projeto Ricardinho, 10 páginas) e **E206** recebidos em versão menor, tarjados (CPF, identidade e telefones; a tarja é gravada na imagem), ligados e originais movidos. As versões originais de E114 e E206 estavam ligadas pela própria tela, apontando para os arquivos sem tarja da pasta Documentos novos: trocadas. **Termos com dado pessoal em texto**: E006 (RG da gestora da entidade) e E151/E160 (CPF escrito com vírgula, `641.633.266,34`, que a tarja anterior não pegou) refeitos e religados; antigos na lixeira. **Gestores da entidade** lidos nos termos (cláusula "gestor pela entidade") e gravados onde estava vazio: E6 Suely de Fatima Ribeiro Abranches; E48 e E179 Angelina da Silva Pinheiro; E66, E158 e E186 Márcio Lúcio de Oliveira; E151 e E160 Maria Celeste Henriques Leonardo. E137 (APAE): o termo não designa gestor da entidade (só a Presidente, Marlene Rodrigues Lima): não preenchido.
- 25/11/2026 (varredura): na pasta, TF/PT/extratos dos termos 073 (E106), 082 (E83), 105 (E104), 120 (E88), 121 (E94), PT E110 "ATUAL", PT E2 (Esporte Clube Cataguases) e o jornal de 06/09 já estavam ligados na plataforma pela versão pública da PUBLICIDADE (feito antes, no mesmo dia). Novo: **plano E165** (AESCA/Casaca, 12.000,00; `1790971498246-plano-de-trabalho.pdf`) estava ligado pela tela ao ORIGINAL sem tarja; refeito (tarja de CPF, e-mail e telefone gravada na imagem), subido em PUBLICIDADE/PLANO e religado; `processo_licitatorio` = 165/2026. Os originais seguem em "Documentos novos" (o conector não move arquivos de outras contas). Continuam parados: extrato 125, extratos 157, contrato de rateio do Cisum, Superação, pasta de anuências.
- 25/11/2026 (mover originais): o conector do Drive **recusa mover** estes arquivos ("OAuth scopes do not allow moving"; `canMoveItemWithinDrive = false`, pertencem a outras contas), então a regra 1 não pode ser cumprida por aqui. Passo fixo a partir de agora: ao terminar, **listar ao dono os originais já com versão pública ligada**, por subpasta de destino, para ele mover (ou fazer isso no Drive pela conta dona). Lista de 25/11:
  - **Meio Ambiente**: TF 073, PT do termo 073, Extrato termo 073 (E106); TF 082, PT do termo 082, Extrato termo 082 (E83); TF 105, PT termo 105, Extrato 105 via jornal (E104); TF 120, PT do termo 120, Extrato do termo 120 (E88); Extrato do termo 121 (E94).
  - **Educação**: PT Emenda 110_2026 ATUAL (E110).
  - **Esporte**: pt esporte clube Cataguases (E2); 1790971498246-plano-de-trabalho (E165).
  - **Não mover** (sem versão pública ligada ou misto): jornais de 06/09 e 04/10 (várias publicações), Extrato termo 125, Extratos do termo 157, Cisum, Projeto Superação, pasta de anuências.
- 25/11/2026 (extratos 125 e 157): *Extrato termo 125.pdf* é recorte do jornal de 30/08/2026 com 3 extratos: termo 110 (**E168**, completo — a nota de 19/11 de "incompleto" estava errada), termo 125 (E169, já tinha extrato) e um terceiro cortado (R$ 5.000, Conselho de Vista Alegre, vigência 20/08 a 20/11/2026; sem cabeçalho, precisa da página inteira do jornal). Recortado o bloco do termo 110 com legenda de fonte, subido como `E168 - EXTRATO - termo 110-2026.pdf` e ligado à E168. *Extratos do termo 157*: Termo 157/2026, Associação Ibraim Mendonça e Iracema (Projeto TIBUM, R$ 40.206,83), recurso da **Resolução 037/2026 do CMDCA** (não é emenda impositiva): **não ligar a nenhuma emenda**.
- 26/11/2026 (distribuição): o dono criou a pasta **"originais"** dentro de Documentos novos (`1-nYc7jO7dmo9aQ_qWcWroznpNvdlJrRR`) e moveu para lá os originais já tratados. **O conector recusa `update_file` com `parentId` mesmo nessa pasta** (a restrição é do escopo OAuth do conector, que só move arquivos que ele mesmo criou, não do dono do arquivo). Solução fixa: **`copy_file` com `title` igual ao original e `parentId` = subpasta da secretaria** (a cópia é criada pelo conector, então fica de fato na pasta certa), e o dono apaga depois os arquivos da pasta "originais". Distribuídos em 26/11: Meio Ambiente (TF/PT/extratos dos termos 073, 082, 120; TF e PT 105; extrato 121), Educação (PT Emenda 110 ATUAL), Esporte (PT Esporte Clube Cataguases; plano E165), Desenvolvimento Social (plano E168 original). Ficaram em "originais" sem copiar: jornal de 06/09 (vários extratos) e Extratos do termo 157 (CMDCA, não é emenda).
- 26/11/2026 (anuências): ofícios reemitidos e datados (23/11/2026) do Cisum (0656, 0658, 0660) e do Superação (0949–0957, 0959–0963) copiados com `copy_file` para PUBLICIDADE/"4 - Anuencias do SUS" como `E{NNN} - ANUENCIA-SUS - oficio NNNN-2026.pdf`, ligados (`tipo = anuencia_sus`) e `execucao.anuencia_sus = 'sim'`, `anuencia_sus_data = 2026-11-23`. Superação liberado pelo dono. Falta o ofício 0958 (provável E117). Conferir sempre o número da emenda no texto contra valor e autor (0953 cita 053; é a E59).
