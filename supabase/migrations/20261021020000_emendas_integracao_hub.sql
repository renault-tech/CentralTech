-- Integração do módulo Emendas com o Hub: passa a ser um módulo válido em
-- acessos, solicitações e feedback, e entra na revogação/reativação em
-- cascata de `hub.definir_acesso` (mesma regra de Compras/Requerimentos:
-- tirar o módulo desativa a conta no módulo; marcar de novo reativa).
-- Emendas não entra em `hub.config_modulo`: roda dentro do próprio Hub,
-- não tem login direto para bloquear.

set local lock_timeout = '5s';

alter table hub.acessos_modulo drop constraint acessos_modulo_modulo_check;
alter table hub.acessos_modulo add constraint acessos_modulo_modulo_check
  check (modulo = any (array['compras', 'numera', 'requerimentos', 'emendas']));

alter table hub.solicitacoes_acesso drop constraint solicitacoes_acesso_modulos_validos;
alter table hub.solicitacoes_acesso add constraint solicitacoes_acesso_modulos_validos
  check (
    modulos_solicitados <@ array['compras', 'numera', 'requerimentos', 'emendas']
    and coalesce(array_length(modulos_solicitados, 1), 0) > 0
  );

insert into hub.apps_feedback (slug, nome, cor, cor_texto, ordem)
values ('emendas', 'Emendas', '#6B4FBB', '#5B3FA8', 4)
on conflict (slug) do nothing;
update hub.apps_feedback set ordem = 5 where slug = 'hub' and ordem = 4;

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
declare
  v_auth_id uuid;
  v_modulos_antigos text[];
  v_removidos text[];
  v_adicionados text[];
begin
  if not hub.eh_admin_hub() then
    raise exception 'Sem permissão para conceder acesso';
  end if;
  select id into v_auth_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_auth_id is null then
    raise exception 'Nenhuma conta encontrada com o e-mail %. A pessoa precisa já ter login em algum módulo da plataforma.', p_email;
  end if;

  select coalesce(array_agg(modulo), array[]::text[]) into v_modulos_antigos
    from hub.acessos_modulo where usuario_id = v_auth_id;

  insert into hub.usuarios (id, nome, email, admin_hub, ativo)
    values (v_auth_id, p_nome, p_email, p_admin_hub, p_ativo)
    on conflict (id) do update set nome = excluded.nome, admin_hub = excluded.admin_hub, ativo = excluded.ativo;
  delete from hub.acessos_modulo where usuario_id = v_auth_id;
  insert into hub.acessos_modulo (usuario_id, modulo)
    select v_auth_id, m from unnest(p_modulos) as m;

  select coalesce(array_agg(m), array[]::text[]) into v_removidos
    from unnest(v_modulos_antigos) as m
    where m <> all (p_modulos);
  select coalesce(array_agg(m), array[]::text[]) into v_adicionados
    from unnest(p_modulos) as m
    where m <> all (v_modulos_antigos);

  if 'compras' = any (v_removidos) then
    update public.usuarios set ativo = false where id = v_auth_id;
  end if;
  if 'requerimentos' = any (v_removidos) then
    update requerimentos.usuarios set ativo = false where id = v_auth_id;
  end if;
  if 'emendas' = any (v_removidos) then
    update emendas.usuarios set ativo = false where id = v_auth_id;
  end if;

  if 'compras' = any (v_adicionados) then
    update public.usuarios set ativo = true where id = v_auth_id;
  end if;
  if 'requerimentos' = any (v_adicionados) then
    update requerimentos.usuarios set ativo = true where id = v_auth_id;
  end if;
  if 'emendas' = any (v_adicionados) then
    update emendas.usuarios set ativo = true where id = v_auth_id;
  end if;

  return v_auth_id;
end;
$function$;
