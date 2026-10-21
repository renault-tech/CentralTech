-- Anexos das emendas (plano de trabalho, nota de empenho, comprovantes…):
-- bucket privado, caminho `{emenda_id}/{arquivo}`. Quem vê a emenda baixa;
-- quem edita a secretaria dela envia; apagar, só o gestor ou quem enviou.
-- (Lição do feedback central: DDL em storage.objects só com apply_migration
-- e só com os `create policy` — sem alterar a tabela em si.)

insert into storage.buckets (id, name, public, file_size_limit)
values ('emendas-documentos', 'emendas-documentos', false, 26214400)
on conflict (id) do nothing;

create or replace function emendas.emenda_do_caminho(p_nome text)
returns uuid
language plpgsql
immutable
set search_path to ''
as $function$
begin
  return split_part(p_nome, '/', 1)::uuid;
exception when others then
  return null;
end;
$function$;

revoke execute on function emendas.emenda_do_caminho(text) from public, anon;
grant execute on function emendas.emenda_do_caminho(text) to authenticated, service_role;

create policy emendas_documentos_le on storage.objects for select to authenticated
  using (bucket_id = 'emendas-documentos' and emendas.pode_ver_emenda(emendas.emenda_do_caminho(name)));

create policy emendas_documentos_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'emendas-documentos' and emendas.pode_editar_emenda(emendas.emenda_do_caminho(name)));

create policy emendas_documentos_apaga on storage.objects for delete to authenticated
  using (
    bucket_id = 'emendas-documentos'
    and (emendas.eh_gestor() or (owner_id = (select auth.uid())::text and emendas.pode_editar_emenda(emendas.emenda_do_caminho(name))))
  );
