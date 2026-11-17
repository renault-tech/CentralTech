-- Categoria (origem) do beneficiário + contatos. A categoria SUGERE o tipo de execução e o instrumento da emenda
-- (não trava: a emenda pode sobrescrever). `tipo` (entidade/órgão/pessoa física) continua valendo para validar o documento.
-- Já aplicada em produção por MCP, em comandos separados (coluna, carga, view).

alter table emendas.beneficiarios
  add column if not exists categoria text not null default 'osc'
    check (categoria in ('osc', 'saude_sus', 'consorcio', 'ente_publico', 'orgao_municipal', 'pessoa_fisica')),
  add column if not exists endereco text,
  add column if not exists email text,
  add column if not exists telefone text,
  add column if not exists representante text;

-- Carga inicial dos 97 cadastros (regra por tipo e por nome; o gestor corrige o que fugir da regra na tela).
update emendas.beneficiarios set categoria = case
  when tipo = 'pessoa_fisica' then 'pessoa_fisica'
  when tipo = 'orgao_publico' then 'orgao_municipal'
  when nome ilike '%cisum%' or nome ilike '%consórcio%' or nome ilike '%consorcio%' then 'consorcio'
  when nome ilike '%hospital%' or nome ilike '%santa casa%' then 'saude_sus'
  when nome = 'IEF' then 'ente_publico'
  else 'osc' end;

-- v_emendas ganha a categoria no fim (security_invoker mantido).
create or replace view emendas.v_emendas with (security_invoker = true) as
SELECT e.id, e.ano, e.numero, e.numero_vereador, e.objeto, e.descricao, e.valor, e.saude, e.modalidade, e.etapa, e.situacao,
  e.etapa_atualizada_em, e.criado_em, e.atualizado_em, e.funcional_programatica, e.natureza_despesa, e.dotacao_texto, e.ficha,
  e.vereador_id, v.numero AS vereador_numero, v.nome AS vereador_nome, e.beneficiario_id, b.nome AS beneficiario_nome,
  b.cnpj AS beneficiario_cnpj, e.unidade_id, u.codigo AS unidade_codigo, u.nome AS unidade_nome, u.secretaria_id,
  s.nome AS secretaria_nome, COALESCE(m.empenhado, 0::numeric) AS empenhado, COALESCE(m.liquidado, 0::numeric) AS liquidado,
  COALESCE(m.pago, 0::numeric) AS pago, m.ultimo_pagamento,
  (EXISTS (SELECT 1 FROM emendas.remanejamentos r WHERE r.emenda_id = e.id)) AS remanejada,
  (SELECT count(*) FROM emendas.impedimentos i WHERE i.emenda_id = e.id AND i.resolvido_em IS NULL) AS impedimentos_abertos,
  e.tipo_execucao, b.categoria AS beneficiario_categoria
FROM emendas.emendas e
  JOIN emendas.vereadores v ON v.id = e.vereador_id
  JOIN emendas.unidades_orcamentarias u ON u.id = e.unidade_id
  JOIN emendas.secretarias s ON s.id = u.secretaria_id
  LEFT JOIN emendas.beneficiarios b ON b.id = e.beneficiario_id
  LEFT JOIN LATERAL (
    SELECT sum(mf.valor) FILTER (WHERE mf.tipo = 'empenho') - COALESCE(sum(mf.valor) FILTER (WHERE mf.tipo = 'anulacao'), 0::numeric) AS empenhado,
      sum(mf.valor) FILTER (WHERE mf.tipo = 'liquidacao') AS liquidado,
      sum(mf.valor) FILTER (WHERE mf.tipo = 'pagamento') AS pago,
      max(mf.data) FILTER (WHERE mf.tipo = 'pagamento') AS ultimo_pagamento
    FROM emendas.movimentos_financeiros mf WHERE mf.emenda_id = e.id) m ON true;
