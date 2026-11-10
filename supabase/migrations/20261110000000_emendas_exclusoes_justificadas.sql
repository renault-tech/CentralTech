-- Justificativa obrigatória para excluir lançamento financeiro ou emenda (Emendas).
-- Fica guardada mesmo depois da exclusão (sem FK para a emenda); só gestor lê e registra.
create table if not exists emendas.exclusoes_justificadas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('lancamento','emenda')),
  emenda_id uuid not null,
  emenda_numero int not null,
  ano int not null,
  detalhe jsonb not null default '{}'::jsonb,
  justificativa text not null check (char_length(btrim(justificativa)) >= 10),
  usuario_id uuid not null default auth.uid(),
  em timestamptz not null default now()
);
alter table emendas.exclusoes_justificadas enable row level security;
create policy gestor_le_exclusoes on emendas.exclusoes_justificadas for select to authenticated using ((select emendas.eh_gestor()));
create policy gestor_registra_exclusoes on emendas.exclusoes_justificadas for insert to authenticated with check ((select emendas.eh_gestor()) and usuario_id = (select auth.uid()));
grant select, insert on emendas.exclusoes_justificadas to authenticated;
grant all on emendas.exclusoes_justificadas to service_role;
