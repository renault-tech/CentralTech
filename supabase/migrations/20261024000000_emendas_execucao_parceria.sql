-- Emendas: dados de parceria/execução vindos da planilha de cumprimento e
-- duas fases novas no fluxo.
--
-- 1. Fases novas (a planilha de cumprimento acompanha os dois marcos):
--    - "Termo de parceria" (só repasse): celebração do termo com a OSC, entre
--      o plano de trabalho e o empenho.
--    - "Enviada para pagamento" (os dois fluxos): processo enviado à
--      Fazenda, entre a liquidação e o pagamento.
--    Ficam editáveis em Configurações → Fases do fluxo como as demais.
-- 2. emendas.execucao (1:1 com a emenda): nº do termo, processo licitatório,
--    data de envio para pagamento, vigência (cronograma de execução),
--    publicação do extrato, conta bancária e gestores da parceria. Escreve
--    quem registra a execução da emenda (pode_editar_emenda) — não só o
--    gestor, como os campos centrais da emenda.

-- ------------------------------------------------------------------ fases

insert into emendas.etapas (chave, nome, cor, grupo, fixa) values
  ('termo_parceria', 'Termo de parceria', '#C9B8F0', 1, false),
  ('envio_pagamento', 'Enviada para pagamento', '#6849B5', 2, false)
on conflict (chave) do nothing;

insert into emendas.fluxo_etapas (modalidade, chave, ordem, ativa) values
  ('repasse', 'termo_parceria', 35, true),
  ('repasse', 'envio_pagamento', 55, true),
  ('direta', 'envio_pagamento', 55, true)
on conflict do nothing;

-- -------------------------------------------------------------- execução

-- A chave se chama `id` (= id da emenda) para a auditoria genérica, que lê
-- `id` da linha, registrar o histórico no mesmo id da emenda.
create table if not exists emendas.execucao (
  id uuid primary key references emendas.emendas(id) on delete cascade,
  numero_termo text check (numero_termo is null or length(numero_termo) <= 40),
  processo_licitatorio text check (processo_licitatorio is null or length(processo_licitatorio) <= 200),
  data_envio_pagamento date,
  vigencia_inicio date,
  vigencia_fim date,
  data_publicacao_extrato date,
  conta_bancaria text check (conta_bancaria is null or length(conta_bancaria) <= 200),
  gestor_osc text check (gestor_osc is null or length(gestor_osc) <= 200),
  gestor_pmc text check (gestor_pmc is null or length(gestor_pmc) <= 200),
  observacao text check (observacao is null or length(observacao) <= 2000),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  constraint vigencia_ordenada check (vigencia_inicio is null or vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

alter table emendas.execucao enable row level security;

create policy le_execucao on emendas.execucao for select to authenticated
  using (emendas.pode_ver_emenda(id));
create policy registra_execucao on emendas.execucao for insert to authenticated
  with check (emendas.pode_editar_emenda(id));
create policy edita_execucao on emendas.execucao for update to authenticated
  using (emendas.pode_editar_emenda(id)) with check (emendas.pode_editar_emenda(id));
create policy gestor_apaga_execucao on emendas.execucao for delete to authenticated
  using (emendas.eh_gestor());

grant select, insert, update, delete on emendas.execucao to authenticated;
grant all on emendas.execucao to service_role;

create trigger auditoria after insert or update or delete on emendas.execucao
  for each row execute function emendas.registrar_auditoria();
