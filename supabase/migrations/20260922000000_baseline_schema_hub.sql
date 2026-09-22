-- Baseline do schema `hub`, aplicado originalmente na construção do Hub
-- (sessão anterior) direto no painel/MCP, sem versionar em git — este
-- repositório nunca teve `supabase/migrations/`. Este arquivo reconstrói o
-- estado atual do banco remoto (idempotente: `create table if not exists`,
-- `create or replace function`), só para o schema passar a viver no
-- histórico, sem alterar nada de fato. A partir daqui, toda mudança de
-- schema do Hub vira migration de verdade, como já é convenção no
-- App-Compras.

create schema if not exists hub;

create table if not exists hub.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  admin_hub boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists hub.acessos_modulo (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references hub.usuarios(id) on delete cascade,
  modulo text not null check (modulo = any (array['compras', 'numera', 'requerimentos'])),
  unique (usuario_id, modulo)
);

alter table hub.usuarios enable row level security;
alter table hub.acessos_modulo enable row level security;

grant usage on schema hub to authenticated, service_role;
grant select, insert, update, delete on hub.usuarios to authenticated, service_role;
grant select, insert, update, delete on hub.acessos_modulo to authenticated, service_role;
alter default privileges in schema hub revoke execute on functions from public;

create or replace function hub.eh_admin_hub()
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce((select admin_hub from hub.usuarios where id = (select auth.uid())), false)
$function$;

create or replace function hub.sou_usuario()
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select exists (select 1 from hub.usuarios where id = (select auth.uid()))
$function$;

revoke execute on function hub.eh_admin_hub() from public;
grant execute on function hub.eh_admin_hub() to authenticated, service_role;
revoke execute on function hub.sou_usuario() from public;
grant execute on function hub.sou_usuario() to authenticated, service_role;

drop policy if exists admin_gerencia_usuarios on hub.usuarios;
create policy admin_gerencia_usuarios on hub.usuarios
  for all using (hub.eh_admin_hub()) with check (hub.eh_admin_hub());

drop policy if exists le_proprio_usuario on hub.usuarios;
create policy le_proprio_usuario on hub.usuarios
  for select using (id = (select auth.uid()) or hub.eh_admin_hub());

drop policy if exists admin_gerencia_acessos on hub.acessos_modulo;
create policy admin_gerencia_acessos on hub.acessos_modulo
  for all using (hub.eh_admin_hub()) with check (hub.eh_admin_hub());

drop policy if exists le_proprios_acessos on hub.acessos_modulo;
create policy le_proprios_acessos on hub.acessos_modulo
  for select using (usuario_id = (select auth.uid()) or hub.eh_admin_hub());

create or replace function hub.definir_acesso(
  p_email text,
  p_nome text,
  p_admin_hub boolean,
  p_modulos text[],
  p_ativo boolean default true
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare v_auth_id uuid;
begin
  if not hub.eh_admin_hub() then
    raise exception 'Sem permissão para conceder acesso';
  end if;
  select id into v_auth_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_auth_id is null then
    raise exception 'Nenhuma conta encontrada com o e-mail %. A pessoa precisa já ter login em algum módulo da plataforma.', p_email;
  end if;
  insert into hub.usuarios (id, nome, email, admin_hub, ativo)
    values (v_auth_id, p_nome, p_email, p_admin_hub, p_ativo)
    on conflict (id) do update set nome = excluded.nome, admin_hub = excluded.admin_hub, ativo = excluded.ativo;
  delete from hub.acessos_modulo where usuario_id = v_auth_id;
  insert into hub.acessos_modulo (usuario_id, modulo)
    select v_auth_id, m from unnest(p_modulos) as m;
  return v_auth_id;
end;
$function$;

revoke execute on function hub.definir_acesso(text, text, boolean, text[], boolean) from public;
grant execute on function hub.definir_acesso(text, text, boolean, text[], boolean) to authenticated, service_role;
