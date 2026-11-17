-- Instrumento da parceria por emenda: termo de fomento/colaboração (MROSC, Lei 13.019/2014) ou
-- convênio (ex.: contrato de rateio com consórcio público, Lei 11.107/2005). O instrumento decide
-- quais documentos são exigidos, quais fases se aplicam e qual fundamento legal aparece nas pendências.
-- Já aplicada em produção por MCP (coluna e constraint em comandos separados, por causa do tempo limite).

alter table emendas.execucao
  add column if not exists instrumento text not null default 'termo_fomento'
  check (instrumento in ('termo_fomento', 'convenio'));

-- Novo tipo de documento ligado do Drive: o próprio convênio / contrato de rateio.
alter table emendas.documentos_drive
  drop constraint documentos_drive_tipo_check,
  add constraint documentos_drive_tipo_check
  check (tipo in ('termo', 'plano_trabalho', 'extrato', 'anuencia_sus', 'relatorio_gestao', 'jornal_edicao', 'convenio'));

-- Cisum (emendas 93, 126 e 162 de 2026): consórcio público, instrumento é o contrato de rateio, não termo de fomento.
insert into emendas.execucao (id, instrumento)
select e.id, 'convenio' from emendas.emendas e where e.ano = 2026 and e.numero in (93, 126, 162)
on conflict (id) do update set instrumento = 'convenio';
