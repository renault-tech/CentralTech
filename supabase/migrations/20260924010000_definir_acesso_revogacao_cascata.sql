-- Cadastro unificado pelo Hub (parte 2): revogar um módulo no Hub também
-- desativa a conta correspondente no app (antes só tirava o "cartão" do
-- Hub — a pessoa continuava conseguindo entrar direto no app de origem).
--
-- 'numera' fica de fora deste create or replace: projeto Supabase separado,
-- sem como este banco alcançar a conta de lá diretamente — a revogação de
-- Numera é feita à parte, pelo server action do Hub, via cliente admin do
-- projeto Numera (NUMERA_SUPABASE_SERVICE_ROLE_KEY).
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

  if 'compras' = any (v_removidos) then
    update public.usuarios set ativo = false where id = v_auth_id;
  end if;
  if 'requerimentos' = any (v_removidos) then
    update requerimentos.usuarios set ativo = false where id = v_auth_id;
  end if;

  return v_auth_id;
end;
$function$;
