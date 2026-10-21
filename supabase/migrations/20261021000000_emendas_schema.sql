-- Módulo Emendas Impositivas (4º módulo da plataforma, o primeiro que roda
-- DENTRO do Hub — rotas /emendas neste mesmo repositório, mesma sessão).
-- Schema próprio `emendas` no projeto compartilhado.
--
-- Regras de negócio que valem no banco, não só na tela:
--   * soma das emendas de um vereador no ano ≤ cota do exercício;
--   * etapa coerente com a modalidade (repasse a entidade × aplicação direta);
--   * empenhado ≤ valor da emenda, pago ≤ empenhado;
--   * quem edita a execução é quem tem `pode_editar` na secretaria da emenda;
--     valor/vereador/dotação só mudam por gestor (ou por remanejamento, RPC).
-- A etapa atual (`emendas.etapa`) é cache mantido por trigger a partir de
-- `andamentos`; a situação (`normal`/`impedida`/`cancelada`), a partir de
-- `impedimentos` e do próprio gestor.

create schema if not exists emendas;

grant usage on schema emendas to authenticated, service_role;
alter default privileges in schema emendas revoke execute on functions from public;
alter default privileges in schema emendas revoke execute on functions from anon;

-- ---------------------------------------------------------------- catálogos

create table emendas.exercicios (
  ano int primary key check (ano between 2020 and 2100),
  cota_por_vereador numeric(14,2) not null check (cota_por_vereador > 0),
  percentual_saude_min numeric(5,2) not null default 50 check (percentual_saude_min between 0 and 100),
  rcl numeric(16,2) check (rcl is null or rcl > 0),
  percentual_rcl numeric(5,2) check (percentual_rcl is null or percentual_rcl between 0 and 100),
  situacao text not null default 'aberto' check (situacao in ('aberto', 'encerrado')),
  criado_em timestamptz not null default now()
);

create table emendas.vereadores (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique check (numero > 0),
  nome text not null check (length(nome) between 2 and 200),
  partido text check (partido is null or length(partido) <= 40),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Secretaria = unidade de PERMISSÃO (lista canônica, a mesma de
-- requerimentos.secretarias). Unidade orçamentária = como a emenda aparece
-- na LOA (02.08 Saúde e 02.09 Fundo de Saúde → ambas "Saúde").
create table emendas.secretarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(nome) between 2 and 120),
  ordem int not null default 0,
  ativo boolean not null default true
);

create table emendas.unidades_orcamentarias (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^\d{2}\.\d{2}$'),
  nome text not null check (length(nome) between 2 and 160),
  secretaria_id uuid not null references emendas.secretarias(id),
  ativo boolean not null default true
);

create table emendas.beneficiarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(nome) between 2 and 200),
  cnpj text check (cnpj is null or cnpj ~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$'),
  tipo text not null default 'entidade' check (tipo in ('entidade', 'orgao_publico')),
  criado_em timestamptz not null default now()
);
create unique index beneficiarios_nome_unico on emendas.beneficiarios (lower(nome));

-- ------------------------------------------------------------------ emendas

create table emendas.emendas (
  id uuid primary key default gen_random_uuid(),
  ano int not null references emendas.exercicios(ano),
  numero int not null check (numero > 0),
  numero_vereador int not null check (numero_vereador > 0),
  vereador_id uuid not null references emendas.vereadores(id),
  objeto text not null check (length(objeto) between 3 and 300),
  descricao text not null check (length(descricao) between 3 and 4000),
  valor numeric(14,2) not null check (valor > 0),
  beneficiario_id uuid references emendas.beneficiarios(id),
  unidade_id uuid not null references emendas.unidades_orcamentarias(id),
  saude boolean not null default false,
  funcional_programatica text check (funcional_programatica is null or length(funcional_programatica) <= 40),
  natureza_despesa text check (natureza_despesa is null or natureza_despesa ~ '^\d\.\d\.\d{2}\.\d{2}'),
  dotacao_texto text check (dotacao_texto is null or length(dotacao_texto) <= 1000),
  ficha text check (ficha is null or length(ficha) <= 300),
  modalidade text not null check (modalidade in ('repasse', 'direta')),
  etapa text not null default 'indicada' check (etapa in (
    'indicada', 'analise', 'plano_trabalho', 'processo_compra', 'empenhada',
    'liquidada', 'paga', 'prestacao_contas', 'concluida')),
  situacao text not null default 'normal' check (situacao in ('normal', 'impedida', 'cancelada')),
  etapa_atualizada_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  unique (ano, numero),
  unique (ano, vereador_id, numero_vereador),
  constraint etapa_compativel_modalidade check (
    (modalidade = 'repasse' and etapa <> 'processo_compra')
    or (modalidade = 'direta' and etapa not in ('plano_trabalho', 'prestacao_contas'))
  )
);
create index emendas_vereador_idx on emendas.emendas (ano, vereador_id);
create index emendas_unidade_idx on emendas.emendas (unidade_id);

create table emendas.andamentos (
  id uuid primary key default gen_random_uuid(),
  emenda_id uuid not null references emendas.emendas(id) on delete cascade,
  etapa text not null check (etapa in (
    'indicada', 'analise', 'plano_trabalho', 'processo_compra', 'empenhada',
    'liquidada', 'paga', 'prestacao_contas', 'concluida')),
  data date not null default current_date,
  documento text check (documento is null or length(documento) <= 100),
  observacao text check (observacao is null or length(observacao) <= 4000),
  usuario_id uuid default auth.uid(),
  usuario_nome text,
  criado_em timestamptz not null default now()
);
create index andamentos_emenda_idx on emendas.andamentos (emenda_id, data, criado_em);

create table emendas.movimentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  emenda_id uuid not null references emendas.emendas(id) on delete cascade,
  tipo text not null check (tipo in ('empenho', 'liquidacao', 'pagamento', 'anulacao')),
  numero text check (numero is null or length(numero) <= 40),
  -- Nula só para dado importado sem data (a planilha tinha "EXECUTADA" sem DP).
  data date,
  valor numeric(14,2) not null check (valor > 0),
  observacao text check (observacao is null or length(observacao) <= 1000),
  usuario_id uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index movimentos_emenda_idx on emendas.movimentos_financeiros (emenda_id);

create table emendas.impedimentos (
  id uuid primary key default gen_random_uuid(),
  emenda_id uuid not null references emendas.emendas(id) on delete cascade,
  tipo text not null check (tipo in ('tecnico', 'legal', 'documentacao')),
  justificativa text not null check (length(justificativa) between 10 and 4000),
  data date not null default current_date,
  resolvido_em date,
  resolucao text check (resolucao is null or length(resolucao) <= 2000),
  usuario_id uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index impedimentos_emenda_idx on emendas.impedimentos (emenda_id);

create table emendas.remanejamentos (
  id uuid primary key default gen_random_uuid(),
  emenda_id uuid not null references emendas.emendas(id) on delete cascade,
  data date not null default current_date,
  ato text check (ato is null or length(ato) <= 200),
  motivo text check (motivo is null or length(motivo) <= 2000),
  antes jsonb not null,
  depois jsonb not null,
  usuario_id uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index remanejamentos_emenda_idx on emendas.remanejamentos (emenda_id);

create table emendas.documentos (
  id uuid primary key default gen_random_uuid(),
  emenda_id uuid not null references emendas.emendas(id) on delete cascade,
  tipo text not null check (tipo in (
    'plano_trabalho', 'certidoes', 'termo', 'pedido', 'processo_compra',
    'nota_empenho', 'nota_fiscal', 'comprovante_pagamento', 'prestacao_contas', 'outro')),
  nome_arquivo text not null check (length(nome_arquivo) between 1 and 255),
  caminho text not null unique check (length(caminho) <= 500),
  tamanho int check (tamanho is null or tamanho between 0 and 26214400),
  usuario_id uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index documentos_emenda_idx on emendas.documentos (emenda_id);

-- ------------------------------------------------- usuários e permissões

-- FK em auth.users (não em hub.usuarios): a aprovação de acesso pelo Hub
-- grava aqui ANTES de `hub.definir_acesso` criar a linha em hub.usuarios.
create table emendas.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  perfil text not null check (perfil in ('gestor', 'admin_secretaria', 'operador', 'consulta')),
  secretaria_id uuid references emendas.secretarias(id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint secretaria_obrigatoria_perfil_secretaria check (
    perfil not in ('admin_secretaria', 'operador') or secretaria_id is not null
  )
);

create table emendas.permissoes (
  usuario_id uuid not null references emendas.usuarios(id) on delete cascade,
  secretaria_id uuid not null references emendas.secretarias(id) on delete cascade,
  pode_ver boolean not null default true,
  pode_editar boolean not null default false,
  primary key (usuario_id, secretaria_id),
  constraint editar_implica_ver check (not pode_editar or pode_ver)
);

create table emendas.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id uuid,
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id uuid default auth.uid(),
  em timestamptz not null default now(),
  antes jsonb,
  depois jsonb
);
create index auditoria_registro_idx on emendas.auditoria (registro_id);

-- --------------------------------------------- funções de permissão (RLS)

-- 'admin' (admin do Hub), o perfil do módulo, ou null (sem acesso).
create or replace function emendas.meu_perfil()
returns text
language sql
stable security definer
set search_path to ''
as $function$
  select case
    when hub.eh_admin_hub() then 'admin'
    else (
      select u.perfil
      from emendas.usuarios u
      join hub.usuarios h on h.id = u.id
      where u.id = (select auth.uid()) and u.ativo and h.ativo
    )
  end
$function$;

create or replace function emendas.eh_gestor()
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce(emendas.meu_perfil() in ('admin', 'gestor'), false)
$function$;

create or replace function emendas.minha_secretaria()
returns uuid
language sql
stable security definer
set search_path to ''
as $function$
  select secretaria_id from emendas.usuarios where id = (select auth.uid()) and ativo
$function$;

create or replace function emendas.pode_ver_secretaria(p_secretaria uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select case emendas.meu_perfil()
    when 'admin' then true
    when 'gestor' then true
    else exists (
      select 1 from emendas.permissoes
      where usuario_id = (select auth.uid()) and secretaria_id = p_secretaria and pode_ver
    )
  end
$function$;

create or replace function emendas.pode_editar_secretaria(p_secretaria uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select case
    when emendas.meu_perfil() in ('admin', 'gestor') then true
    when emendas.meu_perfil() in ('admin_secretaria', 'operador') then exists (
      select 1 from emendas.permissoes
      where usuario_id = (select auth.uid()) and secretaria_id = p_secretaria and pode_editar
    )
    else false
  end
$function$;

create or replace function emendas.secretaria_da_emenda(p_emenda uuid)
returns uuid
language sql
stable security definer
set search_path to ''
as $function$
  select u.secretaria_id
  from emendas.emendas e
  join emendas.unidades_orcamentarias u on u.id = e.unidade_id
  where e.id = p_emenda
$function$;

create or replace function emendas.pode_ver_emenda(p_emenda uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce(emendas.pode_ver_secretaria(emendas.secretaria_da_emenda(p_emenda)), false)
$function$;

create or replace function emendas.pode_editar_emenda(p_emenda uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce(emendas.pode_editar_secretaria(emendas.secretaria_da_emenda(p_emenda)), false)
$function$;

-- ------------------------------------------------------------- triggers

create or replace function emendas.modalidade_por_natureza(p_natureza text)
returns text
language sql
immutable
set search_path to ''
as $function$
  -- 3º grupo da natureza: 50 = transferência a instituição privada sem fins
  -- lucrativos (repasse a entidade); 90/91/93 = aplicação direta.
  select case split_part(p_natureza, '.', 3)
    when '50' then 'repasse'
    when '90' then 'direta'
    when '91' then 'direta'
    when '93' then 'direta'
    else null
  end
$function$;

create or replace function emendas.antes_salvar_emenda()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_cota numeric;
  v_soma numeric;
  v_modalidade text;
begin
  if new.natureza_despesa is not null then
    v_modalidade := emendas.modalidade_por_natureza(new.natureza_despesa);
    if v_modalidade is not null then
      new.modalidade := v_modalidade;
    end if;
  end if;

  if tg_op = 'INSERT' or new.valor is distinct from old.valor
     or new.vereador_id is distinct from old.vereador_id or new.ano is distinct from old.ano
     or new.situacao is distinct from old.situacao then
    perform pg_advisory_xact_lock(hashtext('emendas.cota:' || new.ano || ':' || new.vereador_id));
    select cota_por_vereador into v_cota from emendas.exercicios where ano = new.ano;
    select coalesce(sum(valor), 0) into v_soma from emendas.emendas
      where ano = new.ano and vereador_id = new.vereador_id and situacao <> 'cancelada' and id <> new.id;
    if new.situacao <> 'cancelada' and v_soma + new.valor > v_cota + 0.005 then
      raise exception 'A soma das emendas deste vereador em % (R$ %) passaria a cota de R$ %.',
        new.ano, to_char(v_soma + new.valor, 'FM999G999G990D00'), to_char(v_cota, 'FM999G999G990D00')
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.valor < old.valor then
    if new.valor + 0.005 < (
      select coalesce(sum(valor) filter (where tipo = 'empenho'), 0) - coalesce(sum(valor) filter (where tipo = 'anulacao'), 0)
      from emendas.movimentos_financeiros where emenda_id = new.id
    ) then
      raise exception 'O novo valor ficaria abaixo do que já foi empenhado. Registre uma anulação de empenho antes.'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa then
    new.etapa_atualizada_em := now();
  end if;
  new.atualizado_em := now();
  return new;
end;
$function$;

create trigger antes_salvar_emenda
  before insert or update on emendas.emendas
  for each row execute function emendas.antes_salvar_emenda();

-- Etapa atual = etapa do andamento mais recente. SECURITY DEFINER porque
-- quem registra andamento (operador da secretaria) não tem UPDATE em
-- emendas.emendas — de propósito.
create or replace function emendas.apos_andamento()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_emenda uuid := coalesce(new.emenda_id, old.emenda_id);
  v_etapa text;
begin
  select etapa into v_etapa from emendas.andamentos
    where emenda_id = v_emenda
    order by data desc, criado_em desc
    limit 1;
  update emendas.emendas set etapa = coalesce(v_etapa, 'indicada') where id = v_emenda;
  return null;
end;
$function$;

create trigger apos_andamento
  after insert or update or delete on emendas.andamentos
  for each row execute function emendas.apos_andamento();

create or replace function emendas.validar_movimento()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_valor numeric;
  v_empenhado numeric;
  v_liquidado numeric;
  v_pago numeric;
begin
  perform pg_advisory_xact_lock(hashtext('emendas.mov:' || new.emenda_id));
  select valor into v_valor from emendas.emendas where id = new.emenda_id;
  select
    coalesce(sum(valor) filter (where tipo = 'empenho'), 0) - coalesce(sum(valor) filter (where tipo = 'anulacao'), 0),
    coalesce(sum(valor) filter (where tipo = 'liquidacao'), 0),
    coalesce(sum(valor) filter (where tipo = 'pagamento'), 0)
    into v_empenhado, v_liquidado, v_pago
    from emendas.movimentos_financeiros where emenda_id = new.emenda_id;
  if v_empenhado > v_valor + 0.005 then
    raise exception 'O empenhado (R$ %) passaria o valor da emenda (R$ %).',
      to_char(v_empenhado, 'FM999G999G990D00'), to_char(v_valor, 'FM999G999G990D00') using errcode = 'check_violation';
  end if;
  if v_empenhado < -0.005 then
    raise exception 'A anulação passaria o valor empenhado.' using errcode = 'check_violation';
  end if;
  if v_pago > v_empenhado + 0.005 then
    raise exception 'O pago (R$ %) passaria o empenhado (R$ %).',
      to_char(v_pago, 'FM999G999G990D00'), to_char(v_empenhado, 'FM999G999G990D00') using errcode = 'check_violation';
  end if;
  return null;
end;
$function$;

create constraint trigger validar_movimento
  after insert or update on emendas.movimentos_financeiros
  deferrable initially deferred
  for each row execute function emendas.validar_movimento();

create or replace function emendas.apos_impedimento()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_emenda uuid := coalesce(new.emenda_id, old.emenda_id);
  v_abertos int;
begin
  select count(*) into v_abertos from emendas.impedimentos where emenda_id = v_emenda and resolvido_em is null;
  update emendas.emendas
    set situacao = case when v_abertos > 0 then 'impedida' else 'normal' end
    where id = v_emenda and situacao <> 'cancelada';
  return null;
end;
$function$;

create trigger apos_impedimento
  after insert or update or delete on emendas.impedimentos
  for each row execute function emendas.apos_impedimento();

create or replace function emendas.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
begin
  begin
    v_id := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'))::uuid;
  exception when others then
    v_id := null;
  end;
  if v_id is null and tg_table_name = 'permissoes' then
    v_id := coalesce((to_jsonb(new) ->> 'usuario_id'), (to_jsonb(old) ->> 'usuario_id'))::uuid;
  end if;
  insert into emendas.auditoria (tabela, registro_id, acao, antes, depois)
  values (
    tg_table_name, v_id, tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$function$;

create trigger auditoria after insert or update or delete on emendas.emendas
  for each row execute function emendas.registrar_auditoria();
create trigger auditoria after insert or update or delete on emendas.andamentos
  for each row execute function emendas.registrar_auditoria();
create trigger auditoria after insert or update or delete on emendas.movimentos_financeiros
  for each row execute function emendas.registrar_auditoria();
create trigger auditoria after insert or update or delete on emendas.impedimentos
  for each row execute function emendas.registrar_auditoria();
create trigger auditoria after insert or update or delete on emendas.remanejamentos
  for each row execute function emendas.registrar_auditoria();
create trigger auditoria after insert or update or delete on emendas.documentos
  for each row execute function emendas.registrar_auditoria();
create trigger auditoria after insert or update or delete on emendas.usuarios
  for each row execute function emendas.registrar_auditoria();
create trigger auditoria after insert or update or delete on emendas.permissoes
  for each row execute function emendas.registrar_auditoria();

-- ------------------------------------------------------------------- RLS

alter table emendas.exercicios enable row level security;
alter table emendas.vereadores enable row level security;
alter table emendas.secretarias enable row level security;
alter table emendas.unidades_orcamentarias enable row level security;
alter table emendas.beneficiarios enable row level security;
alter table emendas.emendas enable row level security;
alter table emendas.andamentos enable row level security;
alter table emendas.movimentos_financeiros enable row level security;
alter table emendas.impedimentos enable row level security;
alter table emendas.remanejamentos enable row level security;
alter table emendas.documentos enable row level security;
alter table emendas.usuarios enable row level security;
alter table emendas.permissoes enable row level security;
alter table emendas.auditoria enable row level security;

-- Catálogos: qualquer pessoa com acesso ao módulo lê; gestor escreve.
create policy le_exercicios on emendas.exercicios for select to authenticated using (emendas.meu_perfil() is not null);
create policy gestor_exercicios on emendas.exercicios for all to authenticated using (emendas.eh_gestor()) with check (emendas.eh_gestor());
create policy le_vereadores on emendas.vereadores for select to authenticated using (emendas.meu_perfil() is not null);
create policy gestor_vereadores on emendas.vereadores for all to authenticated using (emendas.eh_gestor()) with check (emendas.eh_gestor());
create policy le_secretarias on emendas.secretarias for select to authenticated using (emendas.meu_perfil() is not null);
create policy gestor_secretarias on emendas.secretarias for all to authenticated using (emendas.eh_gestor()) with check (emendas.eh_gestor());
create policy le_unidades on emendas.unidades_orcamentarias for select to authenticated using (emendas.meu_perfil() is not null);
create policy gestor_unidades on emendas.unidades_orcamentarias for all to authenticated using (emendas.eh_gestor()) with check (emendas.eh_gestor());
create policy le_beneficiarios on emendas.beneficiarios for select to authenticated using (emendas.meu_perfil() is not null);
create policy gestor_beneficiarios on emendas.beneficiarios for all to authenticated using (emendas.eh_gestor()) with check (emendas.eh_gestor());

-- Emendas: vê quem vê a secretaria; campos centrais, só gestor.
create policy le_emendas on emendas.emendas for select to authenticated
  using (emendas.pode_ver_secretaria((select u.secretaria_id from emendas.unidades_orcamentarias u where u.id = unidade_id)));
create policy gestor_insere_emendas on emendas.emendas for insert to authenticated with check (emendas.eh_gestor());
create policy gestor_altera_emendas on emendas.emendas for update to authenticated using (emendas.eh_gestor()) with check (emendas.eh_gestor());
create policy gestor_apaga_emendas on emendas.emendas for delete to authenticated using (emendas.eh_gestor());

-- Execução: lê quem vê a emenda; registra quem edita a secretaria dela;
-- corrigir/apagar um registro já feito, só gestor.
create policy le_andamentos on emendas.andamentos for select to authenticated using (emendas.pode_ver_emenda(emenda_id));
create policy registra_andamentos on emendas.andamentos for insert to authenticated
  with check (emendas.pode_editar_emenda(emenda_id) and usuario_id = (select auth.uid()));
create policy gestor_corrige_andamentos on emendas.andamentos for update to authenticated using (emendas.eh_gestor()) with check (emendas.eh_gestor());
create policy gestor_apaga_andamentos on emendas.andamentos for delete to authenticated using (emendas.eh_gestor());

create policy le_movimentos on emendas.movimentos_financeiros for select to authenticated using (emendas.pode_ver_emenda(emenda_id));
create policy registra_movimentos on emendas.movimentos_financeiros for insert to authenticated
  with check (emendas.pode_editar_emenda(emenda_id) and usuario_id = (select auth.uid()));
create policy gestor_corrige_movimentos on emendas.movimentos_financeiros for update to authenticated using (emendas.eh_gestor()) with check (emendas.eh_gestor());
create policy gestor_apaga_movimentos on emendas.movimentos_financeiros for delete to authenticated using (emendas.eh_gestor());

create policy le_impedimentos on emendas.impedimentos for select to authenticated using (emendas.pode_ver_emenda(emenda_id));
create policy registra_impedimentos on emendas.impedimentos for insert to authenticated
  with check (emendas.pode_editar_emenda(emenda_id) and usuario_id = (select auth.uid()));
create policy edita_impedimentos on emendas.impedimentos for update to authenticated
  using (emendas.pode_editar_emenda(emenda_id)) with check (emendas.pode_editar_emenda(emenda_id));
create policy gestor_apaga_impedimentos on emendas.impedimentos for delete to authenticated using (emendas.eh_gestor());

-- Remanejamento só pela RPC `emendas.remanejar` (grava antes/depois e
-- altera a emenda na mesma transação) — nenhuma policy de escrita.
create policy le_remanejamentos on emendas.remanejamentos for select to authenticated using (emendas.pode_ver_emenda(emenda_id));

create policy le_documentos on emendas.documentos for select to authenticated using (emendas.pode_ver_emenda(emenda_id));
create policy registra_documentos on emendas.documentos for insert to authenticated
  with check (emendas.pode_editar_emenda(emenda_id) and usuario_id = (select auth.uid()));
create policy apaga_documentos on emendas.documentos for delete to authenticated
  using (emendas.eh_gestor() or (usuario_id = (select auth.uid()) and emendas.pode_editar_emenda(emenda_id)));

-- Usuários/permissões: cada um lê o próprio; gestor/admin leem todos;
-- admin de secretaria lê a equipe da própria secretaria. Escrita só pela
-- RPC `emendas.definir_acesso`.
create policy le_usuarios on emendas.usuarios for select to authenticated
  using (
    id = (select auth.uid()) or emendas.eh_gestor()
    or (emendas.meu_perfil() = 'admin_secretaria' and secretaria_id = emendas.minha_secretaria())
  );
create policy le_permissoes on emendas.permissoes for select to authenticated
  using (
    usuario_id = (select auth.uid()) or emendas.eh_gestor()
    or (emendas.meu_perfil() = 'admin_secretaria'
        and exists (select 1 from emendas.usuarios u where u.id = usuario_id and u.secretaria_id = emendas.minha_secretaria()))
  );

create policy gestor_le_auditoria on emendas.auditoria for select to authenticated using (emendas.eh_gestor());

grant select on all tables in schema emendas to authenticated;
grant insert, update, delete on emendas.exercicios, emendas.vereadores, emendas.secretarias,
  emendas.unidades_orcamentarias, emendas.beneficiarios, emendas.emendas, emendas.andamentos,
  emendas.movimentos_financeiros, emendas.impedimentos, emendas.documentos to authenticated;
grant all on all tables in schema emendas to service_role;

-- ---------------------------------------------------------------- views

-- Fonte única das telas: uma linha por emenda, já com nomes e somas.
-- security_invoker: respeita a RLS de quem consulta.
create view emendas.v_emendas with (security_invoker = true) as
select
  e.id, e.ano, e.numero, e.numero_vereador, e.objeto, e.descricao, e.valor, e.saude,
  e.modalidade, e.etapa, e.situacao, e.etapa_atualizada_em, e.criado_em, e.atualizado_em,
  e.funcional_programatica, e.natureza_despesa, e.dotacao_texto, e.ficha,
  e.vereador_id, v.numero as vereador_numero, v.nome as vereador_nome,
  e.beneficiario_id, b.nome as beneficiario_nome, b.cnpj as beneficiario_cnpj,
  e.unidade_id, u.codigo as unidade_codigo, u.nome as unidade_nome,
  u.secretaria_id, s.nome as secretaria_nome,
  coalesce(m.empenhado, 0) as empenhado,
  coalesce(m.liquidado, 0) as liquidado,
  coalesce(m.pago, 0) as pago,
  m.ultimo_pagamento,
  exists (select 1 from emendas.remanejamentos r where r.emenda_id = e.id) as remanejada,
  (select count(*) from emendas.impedimentos i where i.emenda_id = e.id and i.resolvido_em is null) as impedimentos_abertos
from emendas.emendas e
join emendas.vereadores v on v.id = e.vereador_id
join emendas.unidades_orcamentarias u on u.id = e.unidade_id
join emendas.secretarias s on s.id = u.secretaria_id
left join emendas.beneficiarios b on b.id = e.beneficiario_id
left join lateral (
  select
    sum(valor) filter (where tipo = 'empenho') - coalesce(sum(valor) filter (where tipo = 'anulacao'), 0) as empenhado,
    sum(valor) filter (where tipo = 'liquidacao') as liquidado,
    sum(valor) filter (where tipo = 'pagamento') as pago,
    max(data) filter (where tipo = 'pagamento') as ultimo_pagamento
  from emendas.movimentos_financeiros mf where mf.emenda_id = e.id
) m on true;

grant select on emendas.v_emendas to authenticated, service_role;

-- ------------------------------------------------------------------ RPCs

-- Registra um andamento e, quando a etapa é financeira e veio valor, o
-- movimento correspondente — na mesma transação. SECURITY INVOKER: a RLS
-- de andamentos/movimentos decide quem pode.
create or replace function emendas.registrar_andamento(
  p_emenda uuid,
  p_etapa text,
  p_data date,
  p_documento text default null,
  p_observacao text default null,
  p_valor numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_id uuid;
  v_nome text;
  v_tipo text;
begin
  select nome into v_nome from hub.usuarios where id = (select auth.uid());
  insert into emendas.andamentos (emenda_id, etapa, data, documento, observacao, usuario_id, usuario_nome)
    values (p_emenda, p_etapa, coalesce(p_data, current_date), nullif(trim(p_documento), ''), nullif(trim(p_observacao), ''), (select auth.uid()), v_nome)
    returning id into v_id;

  v_tipo := case p_etapa when 'empenhada' then 'empenho' when 'liquidada' then 'liquidacao' when 'paga' then 'pagamento' end;
  if v_tipo is not null and p_valor is not null and p_valor > 0 then
    insert into emendas.movimentos_financeiros (emenda_id, tipo, numero, data, valor, usuario_id)
      values (p_emenda, v_tipo, nullif(trim(p_documento), ''), coalesce(p_data, current_date), p_valor, (select auth.uid()));
  end if;
  return v_id;
end;
$function$;

-- Remanejamento: só gestor. Guarda antes/depois dos campos alterados,
-- aplica a mudança, resolve impedimentos abertos e devolve a emenda para
-- análise técnica se ela ainda não foi empenhada.
create or replace function emendas.remanejar(
  p_emenda uuid,
  p_novo jsonb,
  p_ato text default null,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_antes emendas.emendas;
  v_depois emendas.emendas;
  v_campos text[] := array['objeto', 'descricao', 'valor', 'beneficiario_id', 'unidade_id', 'saude',
                           'funcional_programatica', 'natureza_despesa', 'dotacao_texto', 'ficha'];
  v_c text;
  v_a jsonb := '{}'::jsonb;
  v_d jsonb := '{}'::jsonb;
  v_id uuid;
begin
  if not emendas.eh_gestor() then
    raise exception 'Só gestores podem remanejar emendas.';
  end if;
  perform pg_advisory_xact_lock(hashtext('emendas.remanejar:' || p_emenda));
  select * into v_antes from emendas.emendas where id = p_emenda;
  if not found then
    raise exception 'Emenda não encontrada.';
  end if;

  update emendas.emendas set
    objeto = coalesce(p_novo ->> 'objeto', objeto),
    descricao = coalesce(p_novo ->> 'descricao', descricao),
    valor = coalesce((p_novo ->> 'valor')::numeric, valor),
    beneficiario_id = case when p_novo ? 'beneficiario_id' then (p_novo ->> 'beneficiario_id')::uuid else beneficiario_id end,
    unidade_id = coalesce((p_novo ->> 'unidade_id')::uuid, unidade_id),
    saude = coalesce((p_novo ->> 'saude')::boolean, saude),
    funcional_programatica = case when p_novo ? 'funcional_programatica' then p_novo ->> 'funcional_programatica' else funcional_programatica end,
    natureza_despesa = case when p_novo ? 'natureza_despesa' then p_novo ->> 'natureza_despesa' else natureza_despesa end,
    dotacao_texto = case when p_novo ? 'dotacao_texto' then p_novo ->> 'dotacao_texto' else dotacao_texto end,
    ficha = case when p_novo ? 'ficha' then p_novo ->> 'ficha' else ficha end,
    -- Plano de trabalho / processo de compra pertencem à trilha antiga
    -- (a modalidade pode mudar com a natureza): volta para análise já aqui,
    -- senão o CHECK de etapa × modalidade barraria a própria atualização.
    etapa = case when etapa in ('plano_trabalho', 'processo_compra') then 'analise' else etapa end
  where id = p_emenda
  returning * into v_depois;

  foreach v_c in array v_campos loop
    if (to_jsonb(v_antes) -> v_c) is distinct from (to_jsonb(v_depois) -> v_c) then
      v_a := v_a || jsonb_build_object(v_c, to_jsonb(v_antes) -> v_c);
      v_d := v_d || jsonb_build_object(v_c, to_jsonb(v_depois) -> v_c);
    end if;
  end loop;
  if v_a = '{}'::jsonb then
    raise exception 'Nada mudou: informe ao menos um campo diferente do atual.';
  end if;

  insert into emendas.remanejamentos (emenda_id, ato, motivo, antes, depois)
    values (p_emenda, nullif(trim(p_ato), ''), nullif(trim(p_motivo), ''), v_a, v_d)
    returning id into v_id;

  update emendas.impedimentos set resolvido_em = current_date, resolucao = 'Resolvido por remanejamento'
    where emenda_id = p_emenda and resolvido_em is null;

  if v_depois.etapa in ('indicada', 'plano_trabalho', 'processo_compra') then
    insert into emendas.andamentos (emenda_id, etapa, observacao, usuario_id, usuario_nome)
      values (p_emenda, 'analise', 'Retorno à análise técnica após remanejamento',
              (select auth.uid()), (select nome from hub.usuarios where id = (select auth.uid())));
  end if;
  return v_id;
end;
$function$;

-- Acesso ao módulo. Admin do Hub e gestor: qualquer pessoa, qualquer
-- perfil. Admin de secretaria: só a equipe da própria secretaria, só
-- operador/consulta, e só dentro do que ele mesmo pode ver/editar.
-- p_permissoes: [{"secretaria_id": uuid, "ver": bool, "editar": bool}].
create or replace function emendas.definir_acesso(
  p_usuario uuid,
  p_perfil text,
  p_secretaria uuid,
  p_permissoes jsonb,
  p_ativo boolean default true
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_quem text := emendas.meu_perfil();
  v_minha uuid := emendas.minha_secretaria();
  v_alvo emendas.usuarios;
  v_p jsonb;
  v_sec uuid;
  v_ver boolean;
  v_editar boolean;
begin
  if v_quem is null or v_quem in ('operador', 'consulta') then
    raise exception 'Sem permissão para definir acessos ao módulo Emendas.';
  end if;
  if p_perfil not in ('gestor', 'admin_secretaria', 'operador', 'consulta') then
    raise exception 'Perfil inválido: %', p_perfil;
  end if;
  if jsonb_typeof(coalesce(p_permissoes, '[]'::jsonb)) <> 'array' then
    raise exception 'Permissões em formato inválido.';
  end if;

  if v_quem = 'admin_secretaria' then
    select * into v_alvo from emendas.usuarios where id = p_usuario;
    if not found or v_alvo.secretaria_id is distinct from v_minha or v_alvo.perfil not in ('operador', 'consulta') then
      raise exception 'Admin de secretaria só ajusta operadores e consultas da própria secretaria.';
    end if;
    if p_perfil not in ('operador', 'consulta') or p_secretaria is distinct from v_minha then
      raise exception 'Admin de secretaria não pode mudar o perfil para % nem trocar a secretaria da pessoa.', p_perfil;
    end if;
  end if;

  insert into emendas.usuarios (id, perfil, secretaria_id, ativo)
    values (p_usuario, p_perfil, p_secretaria, p_ativo)
    on conflict (id) do update
      set perfil = excluded.perfil, secretaria_id = excluded.secretaria_id, ativo = excluded.ativo, atualizado_em = now();

  -- Substitui o conjunto inteiro: zera o que existia e regrava o que veio.
  update emendas.permissoes set pode_ver = false, pode_editar = false where usuario_id = p_usuario;
  if p_perfil in ('admin_secretaria', 'operador', 'consulta') then
    for v_p in select * from jsonb_array_elements(coalesce(p_permissoes, '[]'::jsonb)) loop
      v_sec := (v_p ->> 'secretaria_id')::uuid;
      v_ver := coalesce((v_p ->> 'ver')::boolean, false);
      v_editar := coalesce((v_p ->> 'editar')::boolean, false) and p_perfil <> 'consulta';
      if v_editar then v_ver := true; end if;
      continue when not v_ver;
      if v_quem = 'admin_secretaria' then
        if (v_editar and not emendas.pode_editar_secretaria(v_sec)) or not emendas.pode_ver_secretaria(v_sec) then
          raise exception 'Você não pode conceder acesso a uma secretaria que você mesmo não tem.';
        end if;
      end if;
      insert into emendas.permissoes (usuario_id, secretaria_id, pode_ver, pode_editar)
        values (p_usuario, v_sec, v_ver, v_editar)
        on conflict (usuario_id, secretaria_id) do update set pode_ver = excluded.pode_ver, pode_editar = excluded.pode_editar;
    end loop;
  end if;
end;
$function$;

revoke execute on all functions in schema emendas from public, anon;
grant execute on function emendas.meu_perfil(), emendas.eh_gestor(), emendas.minha_secretaria(),
  emendas.pode_ver_secretaria(uuid), emendas.pode_editar_secretaria(uuid),
  emendas.secretaria_da_emenda(uuid), emendas.pode_ver_emenda(uuid), emendas.pode_editar_emenda(uuid),
  emendas.modalidade_por_natureza(text),
  emendas.registrar_andamento(uuid, text, date, text, text, numeric),
  emendas.remanejar(uuid, jsonb, text, text),
  emendas.definir_acesso(uuid, text, uuid, jsonb, boolean)
  to authenticated, service_role;
