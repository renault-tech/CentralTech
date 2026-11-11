-- Publicar ou retirar o portal público é decisão do administrador da Central.
-- A tela e a action já checam `admin_hub`; este gatilho garante também no banco (um gestor do módulo
-- não consegue mudar `portal_publicado_*` nem por chamada direta à API). SQL Editor e service_role
-- (auth.uid() nulo) continuam podendo.
create function emendas.so_admin_publica_portal() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (new.portal_publicado_em is distinct from old.portal_publicado_em
      or new.portal_publicado_por is distinct from old.portal_publicado_por
      or new.portal_ciencia is distinct from old.portal_ciencia)
     and auth.uid() is not null
     and not coalesce(hub.eh_admin_hub(), false) then
    raise exception 'Só o administrador da Central publica ou retira o portal.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function emendas.so_admin_publica_portal() from public, anon;
create trigger trg_so_admin_publica_portal before update on emendas.exercicios for each row execute function emendas.so_admin_publica_portal();
