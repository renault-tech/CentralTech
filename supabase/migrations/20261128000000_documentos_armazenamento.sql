-- Documentos no Drive (etapa 1): conexão com o armazenamento, permissões configuráveis e fila de envios.
-- Tudo configurável por instituição: nenhuma pasta ou conta fica fixa no código.

-- ------------------------------------------------ conexão com o armazenamento (só service_role)
create table if not exists hub.armazenamento_config (
  id text primary key default 'principal' check (id = 'principal'),
  provedor text not null default 'google_drive',
  conta_email text,
  token_cifrado text,
  pasta_raiz_id text,
  pasta_raiz_nome text,
  pasta_originais_id text,
  pasta_publicada_id text,
  pasta_internos_id text,
  conectado_em timestamptz,
  conectado_por uuid,
  ultimo_erro text,
  atualizado_em timestamptz not null default now()
);
alter table hub.armazenamento_config enable row level security;
revoke all on hub.armazenamento_config from anon, authenticated;
grant select, insert, update, delete on hub.armazenamento_config to service_role;

-- ------------------------------------------------ permissões avulsas sobre documentos (só service_role)
-- null = vale o padrão do perfil (admin e gestor enviam e analisam; secretaria só envia).
create table if not exists hub.permissoes_documentos (
  usuario_id uuid primary key references hub.usuarios (id) on delete cascade,
  pode_enviar boolean,
  pode_analisar boolean,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table hub.permissoes_documentos enable row level security;
revoke all on hub.permissoes_documentos from anon, authenticated;
grant select, insert, update, delete on hub.permissoes_documentos to service_role;

-- ------------------------------------------------ envios de documentos do Emendas
create table if not exists emendas.documentos_enviados (
  id uuid primary key default gen_random_uuid(),
  emenda_id uuid not null references emendas.emendas (id) on delete cascade,
  tipo text not null check (tipo in ('termo', 'plano_trabalho', 'extrato', 'anuencia_sus', 'relatorio_gestao', 'jornal_edicao', 'convenio', 'nota_fiscal', 'atesto', 'prestacao_contas')),
  nome text not null,
  drive_file_id text not null,
  pasta text not null check (pasta in ('originais', 'internos')),
  tamanho bigint,
  status text not null default 'aguardando' check (status in ('aguardando', 'aprovado', 'devolvido')),
  enviado_por uuid not null default auth.uid(),
  enviado_em timestamptz not null default now(),
  decidido_por uuid,
  decidido_em timestamptz,
  motivo text
);
create index if not exists documentos_enviados_emenda_idx on emendas.documentos_enviados (emenda_id);
create index if not exists documentos_enviados_status_idx on emendas.documentos_enviados (status);
alter table emendas.documentos_enviados enable row level security;
grant select, insert, update on emendas.documentos_enviados to authenticated;
grant select, insert, update, delete on emendas.documentos_enviados to service_role;

create policy le_documentos_enviados on emendas.documentos_enviados for select to authenticated
  using ((select emendas.eh_gestor()) or enviado_por = (select auth.uid()));
create policy envia_documentos on emendas.documentos_enviados for insert to authenticated
  with check (enviado_por = (select auth.uid()) and (select emendas.pode_editar_emenda(emenda_id)));
create policy decide_documentos on emendas.documentos_enviados for update to authenticated
  using ((select emendas.eh_gestor())) with check ((select emendas.eh_gestor()));

-- ------------------------------------------------ aviso aos gestores quando a secretaria envia
create or replace function emendas.notificar_documento_enviado()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_e emendas.emendas;
  v_quem text;
  v_dest uuid[];
begin
  if new.pasta = 'internos' and exists (select 1 from emendas.usuarios u where u.id = new.enviado_por and u.perfil = 'gestor') then
    return null;
  end if;
  select * into v_e from emendas.emendas where id = new.emenda_id;
  select nome into v_quem from hub.usuarios where id = new.enviado_por;
  select coalesce(array_agg(distinct x), array[]::uuid[]) into v_dest from (
    select u.id as x from emendas.usuarios u join hub.usuarios h on h.id = u.id where u.ativo and h.ativo and u.perfil = 'gestor'
    union
    select h.id from hub.usuarios h where h.ativo and h.admin_hub
  ) d;
  perform hub.notificar(v_dest, 'emendas', 'documento_enviado', 'Documento enviado para análise: emenda nº ' || v_e.numero,
                        new.nome || coalesce(' · por ' || v_quem, ''), '/emendas/aprovacoes', v_e.id, new.enviado_por, 'doc:' || new.id);
  return null;
exception when others then
  raise warning '[emendas.notificar_documento_enviado] %', sqlerrm;
  return null;
end;
$function$;

create or replace trigger notificar_documento_enviado
  after insert on emendas.documentos_enviados
  for each row execute function emendas.notificar_documento_enviado();

revoke execute on function emendas.notificar_documento_enviado() from public, anon, authenticated;

-- ------------------------------------------------ aviso à secretaria quando o envio é decidido
create or replace function emendas.notificar_documento_decidido()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_e emendas.emendas;
begin
  if old.status <> 'aguardando' or new.status = 'aguardando' then
    return null;
  end if;
  select * into v_e from emendas.emendas where id = new.emenda_id;
  perform hub.notificar(array[new.enviado_por], 'emendas', 'documento_decidido',
                        case new.status when 'aprovado' then 'Documento aprovado: emenda nº ' else 'Documento devolvido: emenda nº ' end || v_e.numero,
                        new.nome || coalesce(' · ' || new.motivo, ''), '/emendas/' || v_e.id, v_e.id, new.decidido_por, 'doc-decisao:' || new.id);
  return null;
exception when others then
  raise warning '[emendas.notificar_documento_decidido] %', sqlerrm;
  return null;
end;
$function$;

create or replace trigger notificar_documento_decidido
  after update of status on emendas.documentos_enviados
  for each row execute function emendas.notificar_documento_decidido();

revoke execute on function emendas.notificar_documento_decidido() from public, anon, authenticated;
