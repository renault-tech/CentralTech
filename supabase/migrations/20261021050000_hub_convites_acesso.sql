-- Link de primeiro acesso persistente. O link nativo do Supabase (recovery) é
-- de uso único e expira em cerca de 1 hora; aqui fica um token próprio da
-- Central que permanece válido até a pessoa definir a senha de fato. Cada
-- clique gera, na hora, um token novo do Supabase (ver /primeiro-acesso).
-- Só o admin do Hub lê; quem grava é o servidor (service_role).

create table if not exists hub.convites_acesso (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique,
  criado_em timestamptz not null default now(),
  usado_em timestamptz
);

alter table hub.convites_acesso enable row level security;

drop policy if exists admin_le_convites on hub.convites_acesso;
create policy admin_le_convites on hub.convites_acesso
  for select to authenticated
  using (hub.eh_admin_hub());

revoke all on hub.convites_acesso from public, anon, authenticated;
grant select on hub.convites_acesso to authenticated;
grant all on hub.convites_acesso to service_role;
