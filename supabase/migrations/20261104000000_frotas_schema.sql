-- Módulo Frotas (4 → 5º módulo da Central, roda DENTRO do Hub como o Emendas).
-- Etapa 1: cadastro de veículos, NFs de combustível (quinzenais, por secretaria)
-- e manutenção (orçamento → análise → OC do IPM → NF → Contabilidade).
--
-- Decisões de desenho:
--  * Acesso = admin do Hub OU (linha em frotas.usuarios + módulo 'frotas' em
--    hub.acessos_modulo). Não há `ativo` próprio: tirar o módulo na Central já
--    corta o acesso (sem cascata em hub.definir_acesso) e marcar de novo devolve.
--  * Perfis: gestor (Setor de Frotas, tudo) e consulta (só lê).
--  * Regras no BANCO (ordem das datas, cadeia da manutenção, unicidade de OC e
--    de NF), não só na tela.
--  * Arquivo reexecutável; aplicado em partes pelo MCP (o limite de 60 s trava
--    migrations grandes).

-- ============================================================ 1. tabelas
create schema if not exists frotas;
grant usage on schema frotas to authenticated, service_role;

create table if not exists frotas.usuarios (
  id uuid primary key references hub.usuarios (id) on delete cascade,
  perfil text not null check (perfil in ('gestor', 'consulta')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists frotas.secretarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  -- A secretaria deve ter uma NF de combustível por quinzena (alimenta o painel).
  controla_combustivel boolean not null default true,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists secretarias_nome_unico on frotas.secretarias (lower(btrim(nome)));

create table if not exists frotas.fornecedores (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('posto', 'oficina', 'locadora')),
  nome text not null check (length(btrim(nome)) between 2 and 160),
  cnpj text check (cnpj is null or length(cnpj) <= 18),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists fornecedores_unico on frotas.fornecedores (tipo, lower(btrim(nome)));

create table if not exists frotas.veiculos (
  id uuid primary key default gen_random_uuid(),
  -- Placa, ou o número de frota das máquinas (ex.: "973"). Nulo = sem placa.
  placa text check (placa is null or length(btrim(placa)) between 1 and 20),
  modelo text not null check (length(btrim(modelo)) between 1 and 160),
  marca text check (marca is null or length(marca) <= 80),
  ano_fabricacao smallint check (ano_fabricacao is null or ano_fabricacao between 1900 and 2100),
  ano_modelo smallint check (ano_modelo is null or ano_modelo between 1900 and 2100),
  combustivel text check (combustivel is null or combustivel in ('gasolina', 'flex', 'diesel', 'diesel_s10')),
  classificacao text check (classificacao is null or classificacao in ('leve', 'pesado', 'maquina', 'moto')),
  patrimonio text check (patrimonio is null or length(patrimonio) <= 30),
  vinculo text not null check (vinculo in ('proprio', 'convenio', 'alugado')),
  secretaria_id uuid not null references frotas.secretarias (id),
  setor text check (setor is null or length(setor) <= 120),
  situacao text not null default 'ativo' check (situacao in ('ativo', 'em_manutencao', 'inativo', 'baixado')),
  motivo_situacao text check (motivo_situacao is null or length(motivo_situacao) <= 300),
  finalidade text check (finalidade is null or length(finalidade) <= 500),
  locadora_id uuid references frotas.fornecedores (id),
  -- Valor de referência: da tabela FIPE (ids guardados para atualizar todo mês) ou digitado.
  fipe_tipo text check (fipe_tipo is null or fipe_tipo in ('carros', 'motos', 'caminhoes')),
  fipe_marca_id text,
  fipe_modelo_id text,
  fipe_ano_id text,
  fipe_codigo text,
  fipe_referencia text,
  valor_referencia numeric(14, 2) check (valor_referencia is null or valor_referencia >= 0),
  valor_fonte text check (valor_fonte is null or valor_fonte in ('fipe', 'manual')),
  valor_referencia_em date,
  -- Avisos de revisão que a pessoa marcou como "está correto".
  revisao_ignorada text[] not null default '{}',
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  origem text check (origem is null or length(origem) <= 60),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint veiculo_alugado_tem_locadora check (vinculo <> 'alugado' or locadora_id is not null),
  constraint veiculo_valor_e_fonte check ((valor_referencia is null) = (valor_fonte is null))
);
create index if not exists veiculos_secretaria_idx on frotas.veiculos (secretaria_id);
create index if not exists veiculos_placa_idx on frotas.veiculos (upper(placa));
create index if not exists veiculos_patrimonio_idx on frotas.veiculos (patrimonio);

create table if not exists frotas.parametros (
  id smallint primary key default 1 check (id = 1),
  dias_atencao smallint not null default 10 check (dias_atencao between 1 and 365),
  dias_critico smallint not null default 15 check (dias_critico between 1 and 365),
  pct_atencao smallint not null default 50 check (pct_atencao between 1 and 1000),
  pct_critico smallint not null default 100 check (pct_critico between 1 and 1000),
  reincidencia_qtd smallint not null default 3 check (reincidencia_qtd between 2 and 50),
  reincidencia_meses smallint not null default 6 check (reincidencia_meses between 1 and 60),
  orcamento_acima_pct smallint not null default 15 check (orcamento_acima_pct between 1 and 500),
  combustivel_acima_pct smallint not null default 20 check (combustivel_acima_pct between 1 and 500),
  inativo_dias smallint not null default 90 check (inativo_dias between 1 and 730),
  atualizado_em timestamptz not null default now(),
  constraint parametros_dias_ordem check (dias_critico >= dias_atencao),
  constraint parametros_pct_ordem check (pct_critico >= pct_atencao)
);
insert into frotas.parametros (id) values (1) on conflict do nothing;

create table if not exists frotas.notas_combustivel (
  id uuid primary key default gen_random_uuid(),
  secretaria_id uuid not null references frotas.secretarias (id),
  fornecedor_id uuid references frotas.fornecedores (id),
  numero_nf text not null check (length(btrim(numero_nf)) between 1 and 40),
  -- Quinzena a que a NF se refere (1–15 ou 16–fim do mês).
  periodo_inicio date not null,
  periodo_fim date not null,
  data_emissao date not null,
  valor numeric(14, 2) not null check (valor > 0),
  enviada_secretaria_em date,
  retornou_em date,
  enviada_contabilidade_em date,
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint nf_periodo_ok check (periodo_fim >= periodo_inicio and periodo_fim - periodo_inicio <= 16),
  constraint nf_ordem_datas check (
    (enviada_secretaria_em is null or enviada_secretaria_em >= data_emissao)
    and (retornou_em is null or (enviada_secretaria_em is not null and retornou_em >= enviada_secretaria_em))
    and (enviada_contabilidade_em is null or (retornou_em is not null and enviada_contabilidade_em >= retornou_em))
  )
);
-- O mesmo número de NF, para a mesma secretaria e o mesmo posto, não entra duas vezes.
create unique index if not exists nf_numero_unico on frotas.notas_combustivel (
  secretaria_id, lower(btrim(numero_nf)), coalesce(fornecedor_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
create index if not exists nf_secretaria_idx on frotas.notas_combustivel (secretaria_id, periodo_inicio);

create table if not exists frotas.manutencoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references frotas.veiculos (id),
  -- Secretaria no momento do pedido (o veículo pode mudar de secretaria depois).
  secretaria_id uuid not null references frotas.secretarias (id),
  fornecedor_id uuid references frotas.fornecedores (id),
  servico text not null check (length(btrim(servico)) between 2 and 80),
  descricao text check (descricao is null or length(descricao) <= 1000),
  orcamento_valor numeric(14, 2) not null check (orcamento_valor > 0),
  orcamento_recebido_em date not null,
  status_analise text not null default 'a_analisar'
    check (status_analise in ('a_analisar', 'liberado', 'recusado', 'novo_orcamento')),
  analisado_em date,
  analise_obs text check (analise_obs is null or length(analise_obs) <= 1000),
  -- OC emitida no IPM: aqui só se registra o número.
  oc_numero text check (oc_numero is null or length(btrim(oc_numero)) between 1 and 40),
  oc_valor numeric(14, 2) check (oc_valor is null or oc_valor > 0),
  oc_emitida_em date,
  oc_enviada_em date,
  nf_numero text check (nf_numero is null or length(btrim(nf_numero)) between 1 and 40),
  nf_emissao date,
  nf_valor numeric(14, 2) check (nf_valor is null or nf_valor > 0),
  docs_retornaram_em date,
  enviada_contabilidade_em date,
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint man_analise_datada check ((status_analise = 'a_analisar') = (analisado_em is null)),
  constraint man_oc_exige_liberacao check (oc_numero is null or status_analise = 'liberado'),
  constraint man_nf_completa check (
    (nf_numero is null) = (nf_emissao is null) and (nf_numero is null) = (nf_valor is null)
  ),
  constraint man_cadeia check (
    (oc_emitida_em is null or oc_numero is not null)
    and (oc_valor is null or oc_numero is not null)
    and (oc_enviada_em is null or oc_numero is not null)
    and (nf_numero is null or oc_enviada_em is not null)
    and (docs_retornaram_em is null or (nf_numero is not null and oc_enviada_em is not null))
    and (enviada_contabilidade_em is null or docs_retornaram_em is not null)
  ),
  constraint man_ordem_datas check (
    (analisado_em is null or analisado_em >= orcamento_recebido_em)
    and (oc_emitida_em is null or oc_emitida_em >= coalesce(analisado_em, orcamento_recebido_em))
    and (oc_enviada_em is null or oc_enviada_em >= coalesce(oc_emitida_em, analisado_em, orcamento_recebido_em))
    and (nf_emissao is null or nf_emissao >= oc_enviada_em)
    and (docs_retornaram_em is null or docs_retornaram_em >= oc_enviada_em)
    and (enviada_contabilidade_em is null or enviada_contabilidade_em >= docs_retornaram_em)
  )
);
create unique index if not exists man_oc_unica on frotas.manutencoes (lower(btrim(oc_numero))) where oc_numero is not null;
create index if not exists man_veiculo_idx on frotas.manutencoes (veiculo_id);
create index if not exists man_secretaria_idx on frotas.manutencoes (secretaria_id);
create index if not exists man_status_idx on frotas.manutencoes (status_analise);

create table if not exists frotas.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id uuid,
  acao text not null,
  usuario_id uuid default auth.uid(),
  em timestamptz not null default now(),
  antes jsonb,
  depois jsonb
);
create index if not exists auditoria_registro_idx on frotas.auditoria (tabela, registro_id, em desc);

-- Secretarias que aparecem na planilha de veículos (o importador cria as que faltarem).
insert into frotas.secretarias (nome) values
  ('Administração'), ('Agricultura'), ('Assistência Social'), ('Cultura'), ('Educação'), ('Esporte'),
  ('Fazenda'), ('Gabinete'), ('Saúde'), ('Serviços Urbanos'), ('Catrans'), ('Obras')
on conflict do nothing;

-- ============================================================ 2. funções de acesso
create or replace function frotas.meu_perfil() returns text
language sql stable security definer set search_path = '' as $$
  select case
    when hub.eh_admin_hub() then 'admin'
    else (
      select u.perfil
      from frotas.usuarios u
      join hub.usuarios h on h.id = u.id
      where u.id = (select auth.uid())
        and h.ativo
        and exists (select 1 from hub.acessos_modulo a where a.usuario_id = u.id and a.modulo = 'frotas')
    )
  end
$$;

create or replace function frotas.eh_gestor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(frotas.meu_perfil() in ('admin', 'gestor'), false)
$$;

create or replace function frotas.pode_ver() returns boolean
language sql stable security definer set search_path = '' as $$
  select frotas.meu_perfil() is not null
$$;

create or replace function frotas.definir_acesso(p_usuario uuid, p_perfil text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not frotas.eh_gestor() then
    raise exception 'Só o administrador ou o gestor define acessos ao módulo Frotas.';
  end if;
  if p_perfil not in ('gestor', 'consulta') then
    raise exception 'Perfil inválido: %', p_perfil;
  end if;
  if not exists (select 1 from hub.usuarios where id = p_usuario) then
    raise exception 'Usuário não encontrado na Central.';
  end if;
  insert into frotas.usuarios (id, perfil) values (p_usuario, p_perfil)
    on conflict (id) do update set perfil = excluded.perfil;
end
$$;

-- ============================================================ 3. gatilhos
create or replace function frotas.tocar_atualizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end
$$;

create or replace function frotas.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  begin
    v_id := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'))::uuid;
  exception when others then
    v_id := null;
  end;
  insert into frotas.auditoria (tabela, registro_id, acao, antes, depois)
  values (
    tg_table_name, v_id, tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array['usuarios', 'veiculos', 'notas_combustivel', 'manutencoes', 'parametros'] loop
    execute format('drop trigger if exists tocar_atualizado on frotas.%I', t);
    execute format('create trigger tocar_atualizado before update on frotas.%I for each row execute function frotas.tocar_atualizado()', t);
  end loop;
  foreach t in array array['usuarios', 'secretarias', 'fornecedores', 'veiculos', 'notas_combustivel', 'manutencoes', 'parametros'] loop
    execute format('drop trigger if exists auditoria on frotas.%I', t);
    execute format('create trigger auditoria after insert or update or delete on frotas.%I for each row execute function frotas.registrar_auditoria()', t);
  end loop;
end $$;

-- ============================================================ 4. RLS e privilégios
alter table frotas.usuarios enable row level security;
alter table frotas.secretarias enable row level security;
alter table frotas.fornecedores enable row level security;
alter table frotas.veiculos enable row level security;
alter table frotas.parametros enable row level security;
alter table frotas.notas_combustivel enable row level security;
alter table frotas.manutencoes enable row level security;
alter table frotas.auditoria enable row level security;

drop policy if exists le_usuarios on frotas.usuarios;
create policy le_usuarios on frotas.usuarios for select to authenticated
  using (id = (select auth.uid()) or frotas.eh_gestor());

drop policy if exists le_auditoria on frotas.auditoria;
create policy le_auditoria on frotas.auditoria for select to authenticated using (frotas.eh_gestor());

do $$
declare
  t text;
begin
  foreach t in array array['secretarias', 'fornecedores', 'veiculos', 'notas_combustivel', 'manutencoes'] loop
    execute format('drop policy if exists le_%1$s on frotas.%1$I', t);
    execute format('create policy le_%1$s on frotas.%1$I for select to authenticated using (frotas.pode_ver())', t);
    execute format('drop policy if exists gestor_insere_%1$s on frotas.%1$I', t);
    execute format('create policy gestor_insere_%1$s on frotas.%1$I for insert to authenticated with check (frotas.eh_gestor())', t);
    execute format('drop policy if exists gestor_altera_%1$s on frotas.%1$I', t);
    execute format('create policy gestor_altera_%1$s on frotas.%1$I for update to authenticated using (frotas.eh_gestor()) with check (frotas.eh_gestor())', t);
    execute format('drop policy if exists gestor_apaga_%1$s on frotas.%1$I', t);
    execute format('create policy gestor_apaga_%1$s on frotas.%1$I for delete to authenticated using (frotas.eh_gestor())', t);
  end loop;
end $$;

drop policy if exists le_parametros on frotas.parametros;
create policy le_parametros on frotas.parametros for select to authenticated using (frotas.pode_ver());
drop policy if exists gestor_altera_parametros on frotas.parametros;
create policy gestor_altera_parametros on frotas.parametros for update to authenticated
  using (frotas.eh_gestor()) with check (frotas.eh_gestor());

revoke all on all tables in schema frotas from public, anon, authenticated;
grant select on frotas.usuarios, frotas.auditoria to authenticated;
grant select, insert, update, delete on frotas.secretarias, frotas.fornecedores, frotas.veiculos,
  frotas.notas_combustivel, frotas.manutencoes to authenticated;
grant select, update on frotas.parametros to authenticated;
grant all on all tables in schema frotas to service_role;

-- Funções: sem EXECUTE para o público/anon (lição do cadastro unificado: um
-- revoke só de `public` não basta).
revoke execute on all functions in schema frotas from public, anon;
revoke execute on function frotas.tocar_atualizado(), frotas.registrar_auditoria() from authenticated;
grant execute on function frotas.meu_perfil(), frotas.eh_gestor(), frotas.pode_ver(),
  frotas.definir_acesso(uuid, text) to authenticated, service_role;

-- ============================================================ 5. integração com a Central
alter table hub.acessos_modulo drop constraint if exists acessos_modulo_modulo_check;
alter table hub.acessos_modulo add constraint acessos_modulo_modulo_check
  check (modulo = any (array['compras', 'numera', 'requerimentos', 'emendas', 'frotas']));

alter table hub.solicitacoes_acesso drop constraint if exists solicitacoes_acesso_modulos_validos;
alter table hub.solicitacoes_acesso add constraint solicitacoes_acesso_modulos_validos
  check (modulos_solicitados <@ array['compras', 'numera', 'requerimentos', 'emendas', 'frotas']
         and coalesce(array_length(modulos_solicitados, 1), 0) > 0);

alter table hub.notificacoes drop constraint if exists notificacoes_app_check;
alter table hub.notificacoes add constraint notificacoes_app_check
  check (app = any (array['requerimentos', 'emendas', 'hub', 'compras', 'numera', 'frotas']));

insert into hub.apps_feedback (slug, nome, cor, cor_texto, ordem)
  values ('frotas', 'Frotas', '#5C7A1F', '#3F5A12', 5)
  on conflict (slug) do nothing;
update hub.apps_feedback set ordem = 6 where slug = 'hub' and ordem = 5;
