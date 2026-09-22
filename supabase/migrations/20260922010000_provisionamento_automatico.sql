-- Provisionamento automático de acesso ao Hub, a partir de um app que
-- compartilha o mesmo projeto Supabase (hoje só o Compras — mesmo
-- auth.users). `definir_acesso` (só admin, substitui TODOS os módulos do
-- usuário a cada chamada) não serve para "a própria pessoa se autoconceder
-- o módulo que já usa" — por isso esta função nova, aditiva, chamável pelo
-- próprio usuário autenticado.
--
-- Primeira leitura cross-schema deste projeto (hub.* lendo public.usuarios)
-- — mesmo banco físico, só schemas diferentes, sem acoplamento externo.
create or replace function hub.provisionar_acesso_modulo(p_modulo text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_nome text;
  v_email text;
begin
  if v_uid is null then
    raise exception 'É preciso estar autenticado.';
  end if;
  if p_modulo not in ('compras', 'numera', 'requerimentos') then
    raise exception 'Módulo inválido: %', p_modulo;
  end if;

  if p_modulo = 'compras' then
    select u.nome, u.email into v_nome, v_email
    from public.usuarios u
    where u.id = v_uid and u.ativo = true;
    if v_nome is null then
      raise exception 'Nenhuma conta ativa do Compras encontrada para este usuário.';
    end if;
  else
    -- Reservado para quando outro módulo passar a compartilhar este
    -- projeto Supabase; hoje só 'compras' tem os dados na mesma base.
    raise exception 'Provisionamento automático ainda não suportado para o módulo %.', p_modulo;
  end if;

  insert into hub.usuarios (id, nome, email, ativo)
    values (v_uid, v_nome, v_email, true)
    on conflict (id) do update set nome = excluded.nome, email = excluded.email, ativo = true;

  insert into hub.acessos_modulo (usuario_id, modulo)
    values (v_uid, p_modulo)
    on conflict (usuario_id, modulo) do nothing;
end;
$function$;

revoke execute on function hub.provisionar_acesso_modulo(text) from public;
grant execute on function hub.provisionar_acesso_modulo(text) to authenticated, service_role;

-- Backfill: todo usuário ativo do Compras já nasce com acesso ao Hub +
-- módulo Compras, sem depender de alguém clicar no aviso primeiro.
insert into hub.usuarios (id, nome, email, ativo)
select u.id, u.nome, u.email, true
from public.usuarios u
where u.ativo = true
on conflict (id) do nothing;

insert into hub.acessos_modulo (usuario_id, modulo)
select u.id, 'compras'
from public.usuarios u
where u.ativo = true
on conflict (usuario_id, modulo) do nothing;
