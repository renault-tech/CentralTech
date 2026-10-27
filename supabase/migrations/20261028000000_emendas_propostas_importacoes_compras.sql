-- Emendas, Etapa 2: propostas de alteração (aprovadas pelo gestor), importações e vínculo com o Compras.
-- Tabelas/colunas/policies: aplicadas por MCP em 27/10/2026. A parte "ENFORCEMENT" (funções/gatilhos)
-- deve ser rodada no SQL Editor do painel (o MCP trava em create function neste projeto).

create table if not exists emendas.importacoes (
  id uuid primary key default gen_random_uuid(),
  formato text not null,
  arquivo_nome text,
  sha256 text not null unique,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  resumo jsonb
);

create table if not exists emendas.propostas (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid references emendas.importacoes(id) on delete cascade,
  emenda_id uuid not null references emendas.emendas(id) on delete cascade,
  alvo text not null check (alvo in ('execucao','emenda_fases','emenda_checklist','movimentos')),
  chave text,
  campo text,
  valor_atual jsonb,
  valor_proposto jsonb not null,
  origem text not null default 'secretaria' check (origem in ('secretaria','importacao')),
  status text not null default 'pendente' check (status in ('pendente','aprovada','rejeitada','conflito')),
  autor uuid,
  criado_em timestamptz not null default now(),
  decidido_por uuid,
  decidido_em timestamptz,
  motivo text
);
create index if not exists propostas_status_idx on emendas.propostas (status, emenda_id);

alter table emendas.execucao add column if not exists processo_id uuid, add column if not exists numero_contrato text;

alter table emendas.importacoes enable row level security;
alter table emendas.propostas enable row level security;
do $$ begin
  create policy le_importacoes on emendas.importacoes for select using (emendas.eh_gestor());
  create policy gestor_insere_importacoes on emendas.importacoes for insert with check (emendas.eh_gestor());
  create policy le_propostas on emendas.propostas for select using (emendas.eh_gestor() or autor = auth.uid());
  create policy insere_propostas on emendas.propostas for insert with check (emendas.pode_editar_emenda(emenda_id));
  create policy gestor_altera_propostas on emendas.propostas for update using (emendas.eh_gestor()) with check (emendas.eh_gestor());
exception when duplicate_object then null; end $$;
grant select, insert, update on emendas.importacoes, emendas.propostas to authenticated;
revoke all on emendas.importacoes, emendas.propostas from anon;

-- ENFORCEMENT (SQL Editor): hoje a regra "secretaria não troca dado preenchido" está nas server actions
-- (actions.ts: salvarExecucao/salvarFase/salvarItemChecklist/vincularProcesso). Para valer também contra
-- chamadas diretas à API, um gatilho BEFORE UPDATE em execucao / emenda_fases / emenda_checklist deveria
-- recusar, para quem não é gestor/admin, a troca de um valor não nulo por outro. Pendente de decisão do dono.
