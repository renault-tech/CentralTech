-- Situação de encerramento da emenda (19/11/2026): cumprida, cumprida com economia (ou devolução de saldo, no repasse),
-- não cumprida ou inscrita em restos a pagar. Uma linha por emenda (id = id da emenda), só existe quando o gestor marcou.
-- A devolução de saldo do repasse (valor e data) fica aqui. Documentos comprobatórios: nota fiscal (execução direta) e prestação
-- de contas (repasse) ficam ligados na Documentação (documentos_drive), por isso o CHECK de tipo ganhou dois valores.

alter table emendas.documentos_drive drop constraint documentos_drive_tipo_check,
  add constraint documentos_drive_tipo_check check (tipo = any (array['termo','plano_trabalho','extrato','anuencia_sus','relatorio_gestao','jornal_edicao','convenio','nota_fiscal','prestacao_contas']));

create table if not exists emendas.encerramentos (
  id uuid primary key references emendas.emendas(id) on delete cascade,
  situacao text not null check (situacao in ('cumprida','cumprida_economia','nao_cumprida','restos_a_pagar')),
  definida_em date not null default current_date,
  observacao text check (observacao is null or length(observacao) <= 2000),
  devolucao_valor numeric(14,2) check (devolucao_valor is null or devolucao_valor > 0),
  devolucao_data date,
  devolucao_documento text check (devolucao_documento is null or length(devolucao_documento) <= 200),
  definida_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  check ((devolucao_valor is null) = (devolucao_data is null))
);

alter table emendas.encerramentos enable row level security;
create policy le_encerramentos on emendas.encerramentos for select to authenticated using (emendas.pode_ver_emenda(id));
create policy gestor_insere_encerramentos on emendas.encerramentos for insert to authenticated with check (emendas.eh_gestor());
create policy gestor_edita_encerramentos on emendas.encerramentos for update to authenticated using (emendas.eh_gestor()) with check (emendas.eh_gestor());
create policy gestor_apaga_encerramentos on emendas.encerramentos for delete to authenticated using (emendas.eh_gestor());
grant select, insert, update, delete on emendas.encerramentos to authenticated;
grant all on emendas.encerramentos to service_role;

create trigger auditoria after insert or update or delete on emendas.encerramentos
  for each row execute function emendas.registrar_auditoria();
