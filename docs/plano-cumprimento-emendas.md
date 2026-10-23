# Emendas: atualização pela planilha de cumprimento 2026 (executada em 24/10/2026)

Planilha: "PLANILHA CUMPRIMENTO EMENDAS 2026 - ATUALIZADA - AGORA.xlsx".
Decisão do dono: as emendas são as que já estão na plataforma (importadas da
planilha anterior); a planilha de cumprimento **atualiza** o que está lá.

## Regra aplicada

- Só a aba **EMENDAS IMPOSITVAS 2026** (87 emendas, R$ 2.245.496,02). As abas
  "SUBVENÇÕES OSC" (25 repasses com recurso próprio) e "Planilha3" (3 emendas
  parlamentares de deputados) não são emendas impositivas dos vereadores e
  ficaram de fora.
- Célula preenchida na planilha prevalece; célula vazia **não apaga** nada da
  plataforma. Fase só avança, nunca recua.
- As 128 emendas da plataforma que não aparecem na planilha não foram tocadas.

## O que mudou no banco

- Migration `20261024000000_emendas_execucao_parceria.sql`: fases novas
  **Termo de parceria** (repasse, antes do empenho) e **Enviada para
  pagamento** (os dois fluxos, entre liquidada e paga); tabela
  `emendas.execucao` (termo, processo licitatório, envio para pagamento,
  vigência, extrato, conta, gestores, observação), escrita por quem registra a
  execução da emenda.
- Carga (feita direto no banco, sem avisos): 87 linhas em `emendas.execucao`;
  11 números de empenho corrigidos (os "328xx" da planilha antiga e o 6366
  repetido na nº 144); 19 empenhos novos; 9 datas de pagamento corrigidas; 6
  pagamentos novos (nº 5, 57, 68, 97, 182, 193); 27 emendas avançaram de fase
  (6 para Paga, 14 para Empenhada, 7 para Processo de compra).
- Beneficiários renomeados para o nome da entidade que recebe (o da planilha e
  do objeto): Projeto Ricardinho → Associação Monsenhor Antônio Xavier
  Rodrigues; APAE → Associação de Pais e Amigos dos Excepcionais; Lar São
  Vicente → Obra Unida Lar São Vicente de Paulo; "Conselho de X" → Conselho de
  Desenvolvimento Comunitário do Distrito de X (5); caixas escolares com o
  nome do caixa e a escola entre parênteses (6).
- Nº 102 volta a ser repasse ao Esporte Clube Taquara Preta (termo 005/2026,
  pago em 12/02), desfazendo o remanejamento para a Cultura que vinha da
  planilha antiga.
- Resultado 2026: 68 pagas, 14 empenhadas, 7 em processo de compra, 126
  indicadas; empenhado R$ 2.108.196,02; pago R$ 1.841.196,02; nenhum vereador
  acima da cota; nenhuma emenda com pago > empenhado ou empenhado > valor.

## Divergências que ficaram para o dono decidir

- **Nº 197**: planilha diz R$ 20.000, plataforma R$ 9.000. R$ 20.000 passa a
  cota do vereador em R$ 11.000 — ficou R$ 9.000.
- **Nº 94**: a planilha diz Conselho do Glória, mas a dotação dela própria diz
  "REPASSE CONSELHO DE SERENO" e o gestor/conta são os do Sereno — ficou
  Sereno. O empenho 7207 e a data de pagamento dela repetem os da nº 83.
- **Empenho 3933**: a planilha põe na nº 193 (Hospital, R$ 100.000); a
  plataforma tinha na nº 191 (Projeto Superação, R$ 12.200), que não está na
  planilha. Ficou nas duas.
- **Pagas na plataforma sem pagamento na planilha** (mantidas como pagas): nº
  16, 30, 40, 41, 73, 82, 88, 90, 91, 95, 113, 118, 133, 137, 159, 168, 177 e
  214 (esta com "NÃO GEROU" no empenho).
- Termo **111/2026** aparece em duas emendas (nº 94 e 101).

## Colunas da planilha avaliadas como fase

| Coluna | Uso na plataforma |
|---|---|
| Nº termo de parceria | fase **Termo de parceria** (repasse) + campo |
| Processo licitatório | já existia a fase Processo de compra (direta) + campo |
| Data do envio para pagamento | fase **Enviada para pagamento** + campo |
| Empenho / data de pagamento | fases Empenhada / Paga (já existiam) |
| Cronograma de execução | vigência (início/fim) + alerta "vigência termina em N dias" / "encerrada — acompanhar a prestação de contas" |
| Publicação do extrato | campo + alerta "extrato sem data de publicação" (não virou fase: na planilha ele sai antes e depois do pagamento) |
| Conta bancária, gestores | campos |
