-- Links para documentos no Google Drive (nada de arquivo no banco).
-- Cada linha liga uma emenda a UM arquivo do Drive e guarda a "ficha": os dados
-- conferidos do documento. O portal público só lê tipos liberados (lista fechada no
-- código, service_role); nenhuma permissão para anon.
create table if not exists emendas.documentos_drive (
  id uuid primary key default gen_random_uuid(),
  emenda_id uuid not null references emendas.emendas(id) on delete cascade,
  tipo text not null check (tipo in ('termo','plano_trabalho','extrato','anuencia_sus','relatorio_gestao','jornal_edicao')),
  titulo text not null,
  drive_file_id text not null,
  drive_versao text,                 -- modifiedTime do Drive na conferência (avisa se o original mudar)
  publico boolean not null default false,
  ficha jsonb not null default '{}'::jsonb,   -- dados conferidos (objeto, metas, vigência…)
  conferido_em timestamptz,
  conferido_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (emenda_id, tipo, drive_file_id)
);
create index if not exists documentos_drive_emenda_idx on emendas.documentos_drive (emenda_id);
alter table emendas.documentos_drive enable row level security;
grant select, insert, update, delete on emendas.documentos_drive to authenticated, service_role;
create policy le_documentos_drive on emendas.documentos_drive for select to authenticated using (emendas.pode_ver_emenda(emenda_id));
create policy insere_documentos_drive on emendas.documentos_drive for insert to authenticated with check (emendas.eh_gestor());
create policy altera_documentos_drive on emendas.documentos_drive for update to authenticated using (emendas.eh_gestor()) with check (emendas.eh_gestor());
create policy apaga_documentos_drive on emendas.documentos_drive for delete to authenticated using (emendas.eh_gestor());
