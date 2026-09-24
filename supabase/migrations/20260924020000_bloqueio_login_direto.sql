-- Cadastro unificado pelo Hub (parte 3): interruptor por app para bloquear
-- o login direto (fora do Hub) — desligado por padrão em todos os 3.
-- `esta_bloqueado_login_direto` precisa ser legível ANTES do login, na
-- própria tela de login de cada app (por isso `anon` também tem EXECUTE).

create table if not exists hub.config_modulo (
  modulo text primary key check (modulo = any (array['compras', 'numera', 'requerimentos'])),
  login_direto_bloqueado boolean not null default false
);

insert into hub.config_modulo (modulo) values ('compras'), ('numera'), ('requerimentos')
  on conflict (modulo) do nothing;

alter table hub.config_modulo enable row level security;

drop policy if exists todo_mundo_le_config_modulo on hub.config_modulo;
create policy todo_mundo_le_config_modulo on hub.config_modulo
  for select using (true);

drop policy if exists admin_atualiza_config_modulo on hub.config_modulo;
create policy admin_atualiza_config_modulo on hub.config_modulo
  for update using (hub.eh_admin_hub()) with check (hub.eh_admin_hub());

grant select on hub.config_modulo to anon, authenticated, service_role;
grant update on hub.config_modulo to authenticated, service_role;

create or replace function hub.esta_bloqueado_login_direto(p_modulo text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((select login_direto_bloqueado from hub.config_modulo where modulo = p_modulo), false)
$function$;

revoke execute on function hub.esta_bloqueado_login_direto(text) from public;
grant execute on function hub.esta_bloqueado_login_direto(text) to anon, authenticated, service_role;

create or replace function hub.definir_bloqueio_login_direto(p_modulo text, p_bloqueado boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not hub.eh_admin_hub() then
    raise exception 'Sem permissão para alterar o bloqueio de login direto';
  end if;

  update hub.config_modulo set login_direto_bloqueado = p_bloqueado where modulo = p_modulo;

  if not found then
    raise exception 'Módulo inválido: %', p_modulo;
  end if;
end;
$function$;

revoke execute on function hub.definir_bloqueio_login_direto(text, boolean) from public;
grant execute on function hub.definir_bloqueio_login_direto(text, boolean) to authenticated, service_role;
