-- Parâmetro nulo = manter o valor atual (cada app só envia o que ele controla).
create or replace function hub.salvar_preferencias(p_tema text, p_estilo text, p_detalhe text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sem sessão'; end if;
  insert into hub.preferencias_usuario (usuario_id, tema, estilo, detalhe_processo)
  values (v_uid, coalesce(p_tema,'auto'), coalesce(p_estilo,'apple'), coalesce(p_detalhe,'folha'))
  on conflict (usuario_id) do update
    set tema = coalesce(p_tema, hub.preferencias_usuario.tema),
        estilo = coalesce(p_estilo, hub.preferencias_usuario.estilo),
        detalhe_processo = coalesce(p_detalhe, hub.preferencias_usuario.detalhe_processo),
        atualizado_em = now();
end $$;
