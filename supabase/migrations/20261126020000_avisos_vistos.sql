-- Avisos de novidade mostrados uma única vez por pessoa (vale em Hub, Compras e Requerimentos, mesmo projeto Supabase).
-- Aditivo: uma coluna com default vazio e uma RPC que acrescenta a chave do aviso (sem repetir).
alter table hub.preferencias_usuario add column if not exists avisos_vistos text[] not null default '{}';

create or replace function hub.marcar_aviso_visto(p_chave text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sem sessão'; end if;
  if p_chave is null or length(p_chave) = 0 or length(p_chave) > 80 then raise exception 'Chave inválida'; end if;
  insert into hub.preferencias_usuario (usuario_id, avisos_vistos)
  values (v_uid, array[p_chave])
  on conflict (usuario_id) do update
    set avisos_vistos = case when p_chave = any (hub.preferencias_usuario.avisos_vistos)
                             then hub.preferencias_usuario.avisos_vistos
                             else array_append(hub.preferencias_usuario.avisos_vistos, p_chave) end;
end $$;
revoke execute on function hub.marcar_aviso_visto(text) from public, anon;
grant execute on function hub.marcar_aviso_visto(text) to authenticated, service_role;
