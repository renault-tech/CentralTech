-- Tela de boas-vindas ao novo design: aparece uma única vez por pessoa (vale em Hub, Compras e Requerimentos,
-- mesmo projeto Supabase). Aditivo: só uma coluna nula e uma RPC que a preenche.
alter table hub.preferencias_usuario add column if not exists boas_vindas_design_em timestamptz;

create or replace function hub.marcar_boas_vindas_design()
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sem sessão'; end if;
  insert into hub.preferencias_usuario (usuario_id, boas_vindas_design_em)
  values (v_uid, now())
  on conflict (usuario_id) do update
    set boas_vindas_design_em = coalesce(hub.preferencias_usuario.boas_vindas_design_em, now());
end $$;
revoke execute on function hub.marcar_boas_vindas_design() from public, anon;
grant execute on function hub.marcar_boas_vindas_design() to authenticated, service_role;
