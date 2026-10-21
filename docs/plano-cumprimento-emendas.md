# Plano: readequar o módulo Emendas à planilha nova ("CUMPRIMENTO EMENDAS 2026 - ATUALIZADA")

## Contexto

O dono informou que a planilha usada antes estava errada e desatualizada e enviou
a nova como fonte correta. O sistema hoje tem as 215 emendas da planilha antiga
(R$ 5.157.490,05), importadas em produção. A planilha nova é outra coisa: um
controle de **cumprimento/execução**, com mais dados por emenda e três abas.

## O que a análise mostrou (somente leitura, já feita)

**Aba "EMENDAS IMPOSITVAS 2026" — 87 emendas, R$ 2.245.496,02**
- Os 87 números existem no sistema; os 15 autores batem com os 15 vereadores;
  valores iguais em 86 (exceção: nº 197, R$ 9.000 → R$ 20.000).
- Campos que o sistema **não tem**: nº do termo de parceria, processo
  licitatório, data de envio para pagamento, cronograma de execução, data de
  publicação do extrato, conta bancária da OSC, gestor da parceria na OSC e
  gestor da parceria na Prefeitura.
- **Empenhos**: 30 diferem — 21 o sistema não tinha; 9 tinham número errado
  (ex.: "32828" no lugar de 9440/2026, vindos do texto da planilha antiga).
- **Pagamentos**: 6 novos (nº 5, 57, 68, 97, 182, 193); 9 com data diferente;
  18 marcados como pagos no sistema sem pagamento na planilha nova (nº 16, 30,
  40, 41, 73, 82, 88, 90, 91, 95, 113, 118, 133, 137, 159, 168, 177, 214).
- **Beneficiário**: 29 diferenças — nos repasses a OSC a planilha nova traz a
  razão social oficial (ex.: "Projeto Ricardinho" → Associação Monsenhor
  Antônio Xavier; "APAE" → Associação de Pais e Amigos dos Excepcionais); nas
  compras diretas ela só repete a secretaria (o sistema tem o local: Posto
  Haidee, CEO…).
- **Remanejamento contraditório**: nº 102 é, pela planilha nova, repasse ao
  Esporte Clube Taquara Preta (termo 005/2026, pago R$ 23.500) — o sistema a
  tinha como remanejada para a Secretaria de Cultura.
- Órgão responsável: nenhuma divergência.
- **128 emendas do sistema não aparecem** na planilha nova; duas delas (nº 167
  e 191) estavam como pagas — o empenho 3933 que estava na 191 é, pela planilha
  nova, da 193.

**Aba "SUBVENÇÕES OSC "** — 25 repasses com recurso próprio (ex.: Carnaval),
sem vereador. **Aba "Planilha3" (Emendas parlamentares)** — 3 emendas de
deputados (ex.: Newton Cardoso Jr. → APAE, R$ 100.000), com resolução, plano de
trabalho e relatório de gestão.

## Decisões (recomendadas; a confirmar na aprovação)

1. **128 ausentes**: permanecem no sistema como "Indicada" (a planilha nova lista
   só o que já andou; a soma por vereador continua fechando a cota).
2. **Pagas não confirmadas (20)**: seguir a planilha nova — voltam para a fase
   que ela indica (com empenho → Empenhada; com termo/processo → fase anterior ao
   empenho; nada → Indicada); pagamentos antigos são estornados com registro.
3. **Nº 197**: fica em R$ 9.000 e entra na lista de divergências para o dono
   indicar qual emenda do vereador foi reduzida (R$ 20.000 estoura a cota em
   R$ 11.000 — o banco bloqueia).
4. **Outras abas**: o módulo passa a ter **tipo de repasse** — emenda
   impositiva, subvenção e emenda parlamentar; subvenções e parlamentares ficam
   fora da cota dos vereadores e da regra dos 50% na Saúde.

## Implementação

1. **Banco** (migration `20261023000000_emendas_cumprimento.sql`, em partes;
   funções grandes pelo SQL Editor do dono, como antes):
   - `emendas.emendas`: `tipo` ('impositiva' default, 'subvencao',
     'parlamentar'), `numero_termo`, `processo_licitatorio`,
     `data_envio_pagamento`, `cronograma_inicio`, `cronograma_fim`,
     `data_publicacao_extrato`, `conta_bancaria`, `gestor_osc`, `gestor_pmc`,
     `origem_recurso`, `parcelas`, `resolucao`, `autor_externo` (deputado);
     `vereador_id` passa a nulo só quando `tipo <> 'impositiva'` (CHECK);
     gatilho de cota ignora tipos que não são impositiva; `v_emendas` expõe os
     campos novos. Numeração única por (ano, tipo, numero).
   - RPC `emendas.reconciliar(p_ano, p_linhas jsonb)` (security definer, só
     gestor/admin, uma transação): atualiza campos, empenhos, pagamentos,
     beneficiário (só repasses a OSC), etapa; estorna pagamento não confirmado
     com andamento "Correção pela planilha de cumprimento"; desfaz o
     remanejamento da nº 102; tudo auditado.
2. **Leitor da planilha nova** (`src/lib/emendas/importacao/cumprimento.ts` +
   testes com as grafias reais: "3030/26", datas seriais do Excel, "20/03/026",
   "25/03/202+", "NÃO GEROU", "PROCESSO EM ANDAD.", "137/2027"): gera a prévia
   com a lista de divergências por emenda (campo, antes, depois) e as linhas
   não interpretáveis para revisão.
3. **Tela de importação** (Configurações → Importar): passa a aceitar a planilha
   de cumprimento — prévia das mudanças agrupadas (empenhos, pagamentos,
   estornos, beneficiários, campos novos, divergências que exigem decisão como a
   nº 197) → confirmar → `reconciliar`. Subvenções e parlamentares entram como
   novos registros (reimportar não duplica).
4. **Telas**: detalhe da emenda ganha o bloco "Parceria" (termo, processo,
   cronograma, extrato, conta, gestores, envio para pagamento); lista/painel
   ganham filtro por tipo; cota e 50% Saúde só sobre impositivas; formulário de
   cadastro/edição com os campos novos; exportação Excel com as colunas novas.
5. Novidades + CLAUDE.md; PR e merge ao final (fluxo já combinado).

## Verificação

- Testes do leitor com as 87 + 25 + 3 linhas reais; prévia conferida contra
  esta análise (30 empenhos, 6+9 pagamentos, 20 estornos, 29 beneficiários,
  nº 197, nº 102).
- `reconciliar` testada em transação desfeita antes de valer: contagens,
  totais por vereador ≤ cota, nenhum dado fora das 87 alterado (exceto 167/191).
- RLS/permissões dos campos novos por perfil; `get_advisors`.
- `tsc`, `eslint`, `vitest`, `next build`; telas em 1280 px e 390 px.
- A gravação real é feita pelo dono na tela (prévia → confirmar), como na
  primeira importação.
