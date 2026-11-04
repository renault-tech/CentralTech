-- Frotas: colunas escondidas nas exportações, guardadas por usuário (padrão = tudo visível).
create table if not exists frotas.preferencias_exportacao (
  usuario_id uuid primary key,
  ocultas jsonb not null default '{}'::jsonb check (jsonb_typeof(ocultas) = 'object' and length(ocultas::text) <= 8000),
  atualizado_em timestamptz not null default now()
);
alter table frotas.preferencias_exportacao enable row level security;
create policy pref_exp_ler on frotas.preferencias_exportacao for select to authenticated using (usuario_id = auth.uid() and frotas.pode_ver());
create policy pref_exp_inserir on frotas.preferencias_exportacao for insert to authenticated with check (usuario_id = auth.uid() and frotas.pode_ver());
create policy pref_exp_atualizar on frotas.preferencias_exportacao for update to authenticated using (usuario_id = auth.uid() and frotas.pode_ver()) with check (usuario_id = auth.uid() and frotas.pode_ver());
grant select, insert, update on frotas.preferencias_exportacao to authenticated;
grant all on frotas.preferencias_exportacao to service_role;
revoke all on frotas.preferencias_exportacao from anon;
