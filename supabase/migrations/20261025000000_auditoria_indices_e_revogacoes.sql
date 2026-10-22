-- Achados da auditoria (24/10/2026).
--
-- 1. Índices nas chaves estrangeiras de emendas que a RLS e os joins usam
--    (o índice existente em emendas é (ano, vereador_id): não serve para
--    procurar só por vereador_id, p.ex. na checagem de FK ao apagar).
-- 2. Tirar a execução de `anon` das funções SECURITY DEFINER do Compras que
--    só fazem sentido logado (todas já usam auth.uid() por dentro; isto fecha
--    a exposição via /rest/v1/rpc). `authenticated` e `service_role` seguem
--    com o grant explícito de sempre.

create index if not exists emendas_vereador_id_idx on emendas.emendas (vereador_id);
create index if not exists emendas_beneficiario_id_idx on emendas.emendas (beneficiario_id);
create index if not exists permissoes_secretaria_id_idx on emendas.permissoes (secretaria_id);

revoke execute on function public.devolver_ao_setor_anterior(uuid, text) from anon;
revoke execute on function public.devolver_ao_setor_compras(uuid, text) from anon;
revoke execute on function public.editar_mensagem_chat(text, uuid, text) from public, anon;
revoke execute on function public.excluir_mensagem_chat(text, uuid) from public, anon;
revoke execute on function public.listar_usuarios_chat() from public, anon;
revoke execute on function public.marcar_leitura_chat(text, uuid, timestamptz) from public, anon;
revoke execute on function public.parecer_cancelar(uuid) from public, anon;
revoke execute on function public.parecer_emitir(uuid, text, boolean) from public, anon;
revoke execute on function public.pode_ver_chat_processo(uuid) from public, anon;
revoke execute on function public.resumo_conversas_chat() from public, anon;
revoke execute on function public.retomar_processo(uuid, text) from public, anon;
revoke execute on function public.suspender_processo(uuid, text) from public, anon;
