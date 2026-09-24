-- Achado da varredura pós-entrega do cadastro unificado: a migration
-- anterior (20260924010000) desativa a conta no app quando um módulo é
-- REMOVIDO pelo Hub, mas marcar o módulo de novo não reativava — o admin
-- via a caixa marcada de novo e achava que tinha resolvido, mas a pessoa
-- continuava sem conseguir entrar (precisava de um segundo passo manual
-- direto no Compras/Requerimentos). Corrigido de forma simétrica: um
-- módulo ADICIONADO nesta chamada (não estava na lista antiga, passa a
-- estar) também reativa a conta correspondente. Só reativa quando o
-- módulo está sendo ADICIONADO — se já estava marcado e continua marcado
-- (resubmissão da mesma lista, sem mudança real), não mexe, preservando
-- uma desativação feita diretamente no app por outro motivo (ex.: pessoa
-- afastada, sem relação com o Hub).
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

  if 'compras' = any (v_adicionados) then
    update public.usuarios set ativo = true where id = v_auth_id;
  end if;
  if 'requerimentos' = any (v_adicionados) then
    update requerimentos.usuarios set ativo = true where id = v_auth_id;
  end if;

  return v_auth_id;
end;
$function$;
