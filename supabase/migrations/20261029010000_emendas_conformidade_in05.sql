-- Conformidade com a IN TCE-MG 05/2025 (art. 7º) e a Recomendação MPC-MG 01/2025.
-- Só acrescenta colunas; já aplicada em produção por MCP (reexecutável).

alter table emendas.execucao
  add column if not exists localidade text check (localidade is null or length(localidade) <= 200),
  add column if not exists inicio_previsto date,
  add column if not exists termino_previsto date,
  add column if not exists plano_metas text check (plano_metas is null or length(plano_metas) <= 4000),
  add column if not exists plano_outras_fontes numeric(14,2) check (plano_outras_fontes is null or plano_outras_fontes >= 0),
  add column if not exists plano_despesa_corrente numeric(14,2) check (plano_despesa_corrente is null or plano_despesa_corrente >= 0),
  add column if not exists plano_despesa_capital numeric(14,2) check (plano_despesa_capital is null or plano_despesa_capital >= 0),
  add column if not exists anuencia_sus text check (anuencia_sus is null or anuencia_sus in ('sim','nao','nao_se_aplica')),
  add column if not exists anuencia_sus_data date,
  add column if not exists identificador_contabil text check (identificador_contabil is null or length(identificador_contabil) <= 120),
  add column if not exists fonte_recurso text check (fonte_recurso is null or length(fonte_recurso) <= 120);

alter table emendas.exercicios
  add column if not exists municipio_nome text check (municipio_nome is null or length(municipio_nome) <= 200),
  add column if not exists municipio_cnpj text check (municipio_cnpj is null or length(municipio_cnpj) <= 20),
  add column if not exists unidade_parlamentar text check (unidade_parlamentar is null or length(unidade_parlamentar) <= 200);

alter table emendas.documentos
  add column if not exists competencia integer check (competencia is null or (competencia between 2000 and 2100));

alter table emendas.documentos drop constraint if exists documentos_tipo_check;
alter table emendas.documentos add constraint documentos_tipo_check check (tipo = any (array[
  'plano_trabalho','certidoes','termo','pedido','processo_compra','nota_empenho','nota_fiscal',
  'comprovante_pagamento','prestacao_contas','relatorio_gestao','anuencia_sus','outro']));
