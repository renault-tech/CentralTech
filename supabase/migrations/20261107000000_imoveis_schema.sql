-- Módulo Imóveis e Consumo (6º módulo da Central, roda DENTRO do Hub como Emendas e Frotas).
-- Aluguéis de imóveis da Prefeitura, contas de água e luz (por imóvel e consolidadas), entrega do
-- imóvel (desligamento, chaves, vistoria, troca de titularidade) e alertas de consumo/valor/prazo.
--
-- Decisões de desenho:
--  * Acesso = admin do Hub OU (linha em imoveis.usuarios + módulo 'imoveis' em hub.acessos_modulo).
--    Sem `ativo` próprio nem cascata em hub.definir_acesso (função grande, o MCP trava ao recriá-la):
--    tirar o módulo na Central corta o acesso na hora e marcar de novo devolve.
--  * Perfis: gestor (Setor de Imóveis, tudo), consulta (só lê) e secretaria (lê SÓ os imóveis da
--    própria secretaria e as pendências deles; `secretaria_id` obrigatório nesse perfil).
--  * Regras no BANCO, não só na tela: datas da entrega em ordem, encerramento só com água/luz
--    desligadas e titularidade trocada, uma conta por unidade e mês, uma UC por número.
--  * Limites dos alertas ficam em imoveis.parametros (1 linha, editável pelo gestor).
--  * Arquivo reexecutável; aplicar em partes pelo MCP (limite de 60 s).

-- ============================================================ 1. tabelas
create schema if not exists imoveis;
grant usage on schema imoveis to authenticated, service_role;

create table if not exists imoveis.secretarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists secretarias_nome_unico on imoveis.secretarias (lower(btrim(nome)));

create table if not exists imoveis.usuarios (
  id uuid primary key references hub.usuarios (id) on delete cascade,
  perfil text not null check (perfil in ('gestor', 'consulta', 'secretaria')),
  secretaria_id uuid references imoveis.secretarias (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint secretaria_so_no_perfil_secretaria check ((perfil = 'secretaria') = (secretaria_id is not null))
);

create table if not exists imoveis.imobiliarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 2 and 160),
  cnpj text check (cnpj is null or length(cnpj) <= 18),
  telefone text check (telefone is null or length(telefone) <= 40),
  email text check (email is null or length(email) <= 160),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists imobiliarias_nome_unico on imoveis.imobiliarias (lower(btrim(nome)));

create table if not exists imoveis.imoveis (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 2 and 160),
  endereco text not null check (length(btrim(endereco)) between 2 and 240),
  secretaria_id uuid not null references imoveis.secretarias (id),
  setor text check (setor is null or length(setor) <= 120),
  finalidade text check (finalidade is null or length(finalidade) <= 160),
  situacao text not null default 'ativo' check (situacao in ('ativo', 'em_entrega', 'entregue')),
  -- contrato
  contrato_numero text check (contrato_numero is null or length(contrato_numero) <= 40),
  vigencia_inicio date,
  vigencia_fim date,
  valor_aluguel numeric(12, 2) not null default 0 check (valor_aluguel >= 0),
  dia_vencimento smallint check (dia_vencimento is null or dia_vencimento between 1 and 31),
  indice_reajuste text check (indice_reajuste is null or indice_reajuste in ('IPCA', 'IGP-M', 'INPC', 'outro')),
  proximo_reajuste date,
  -- imobiliária e proprietário
  imobiliaria_id uuid references imoveis.imobiliarias (id),
  proprietario_nome text check (proprietario_nome is null or length(proprietario_nome) <= 160),
  proprietario_documento text check (proprietario_documento is null or length(proprietario_documento) <= 20),
  proprietario_contato text check (proprietario_contato is null or length(proprietario_contato) <= 120),
  proprietario_conta text check (proprietario_conta is null or length(proprietario_conta) <= 160),
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint vigencia_em_ordem check (vigencia_inicio is null or vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);
create index if not exists imoveis_secretaria_idx on imoveis.imoveis (secretaria_id);
create index if not exists imoveis_situacao_idx on imoveis.imoveis (situacao);

-- Unidade consumidora: matrícula da água ou UC da energia, sempre de UM imóvel.
create table if not exists imoveis.unidades (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid not null references imoveis.imoveis (id) on delete cascade,
  tipo text not null check (tipo in ('agua', 'luz')),
  numero text not null check (length(btrim(numero)) between 1 and 40),
  titular text check (titular is null or length(titular) <= 160),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists unidades_numero_unico on imoveis.unidades (tipo, lower(btrim(numero)));
create index if not exists unidades_imovel_idx on imoveis.unidades (imovel_id);

create table if not exists imoveis.contas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references imoveis.unidades (id) on delete cascade,
  referencia date not null check (referencia = date_trunc('month', referencia)::date), -- sempre dia 1
  consumo numeric(12, 2) check (consumo is null or consumo >= 0), -- m³ ou kWh
  valor numeric(12, 2) not null check (valor >= 0),
  vencimento date,
  pago_em date,
  observacao text check (observacao is null or length(observacao) <= 500),
  origem text not null default 'digitada' check (origem in ('digitada', 'pdf')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint pago_depois_da_referencia check (pago_em is null or pago_em >= referencia)
);
create unique index if not exists contas_unidade_mes_unico on imoveis.contas (unidade_id, referencia);
create index if not exists contas_referencia_idx on imoveis.contas (referencia);

-- Entrega do imóvel: uma linha por imóvel (id = id do imóvel, como `emendas.execucao`).
create table if not exists imoveis.entregas (
  id uuid primary key references imoveis.imoveis (id) on delete cascade,
  aviso_saida_em date,
  agua_pedido_em date,
  agua_protocolo text check (agua_protocolo is null or length(agua_protocolo) <= 60),
  agua_desligada_em date,
  luz_pedido_em date,
  luz_protocolo text check (luz_protocolo is null or length(luz_protocolo) <= 60),
  luz_desligada_em date,
  chaves_entregues_em date,
  chaves_entregue_por text check (chaves_entregue_por is null or length(chaves_entregue_por) <= 160),
  chaves_recebida_por text check (chaves_recebida_por is null or length(chaves_recebida_por) <= 160),
  vistoria_agendada_em date,
  vistoriador text check (vistoriador is null or length(vistoriador) <= 160),
  vistoria_concluida_em date,
  vistoria_obs text check (vistoria_obs is null or length(vistoria_obs) <= 2000),
  titularidade_agua_em date,
  titularidade_luz_em date,
  encerrado_em date,
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint pedido_agua_antes_da_baixa check (agua_desligada_em is null or agua_pedido_em is null or agua_desligada_em >= agua_pedido_em),
  constraint pedido_luz_antes_da_baixa check (luz_desligada_em is null or luz_pedido_em is null or luz_desligada_em >= luz_pedido_em),
  constraint vistoria_concluida_depois_da_agenda check (vistoria_concluida_em is null or vistoria_agendada_em is null or vistoria_concluida_em >= vistoria_agendada_em),
  -- Só encerra com tudo desligado e a titularidade trocada.
  constraint encerra_so_com_tudo_resolvido check (
    encerrado_em is null
    or (agua_desligada_em is not null and luz_desligada_em is not null
        and chaves_entregues_em is not null and vistoria_concluida_em is not null
        and titularidade_agua_em is not null and titularidade_luz_em is not null)
  )
);

create table if not exists imoveis.documentos (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid not null references imoveis.imoveis (id) on delete cascade,
  tipo text not null check (tipo in ('contrato', 'vistoria', 'laudo', 'titularidade_agua', 'titularidade_luz', 'comprovante', 'outro')),
  nome_arquivo text not null check (length(nome_arquivo) between 1 and 200),
  caminho text not null,
  enviado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists documentos_imovel_idx on imoveis.documentos (imovel_id);

-- Pendência justificada deixa de contar enquanto a assinatura do dado não mudar.
create table if not exists imoveis.pendencias_justificadas (
  imovel_id uuid not null references imoveis.imoveis (id) on delete cascade,
  chave text not null check (length(chave) between 1 and 120),
  justificativa text not null check (length(btrim(justificativa)) between 3 and 500),
  assinatura text not null,
  usuario_id uuid default auth.uid(),
  em timestamptz not null default now(),
  primary key (imovel_id, chave)
);

create table if not exists imoveis.parametros (
  id smallint primary key default 1 check (id = 1),
  pct_acima numeric not null default 40 check (pct_acima between 1 and 1000),
  pct_abaixo numeric not null default 40 check (pct_abaixo between 1 and 100),
  meses_media smallint not null default 6 check (meses_media between 2 and 11),
  dias_fim_contrato smallint not null default 90 check (dias_fim_contrato between 1 and 365),
  dia_lancamento smallint not null default 20 check (dia_lancamento between 1 and 28),
  pct_valor numeric not null default 25 check (pct_valor between 1 and 1000),
  dias_atraso smallint not null default 5 check (dias_atraso between 0 and 90),
  atualizado_em timestamptz not null default now()
);
insert into imoveis.parametros (id) values (1) on conflict do nothing;

create table if not exists imoveis.preferencias_exportacao (
  usuario_id uuid primary key references hub.usuarios (id) on delete cascade,
  ocultas jsonb not null default '{}'::jsonb
);

create table if not exists imoveis.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id uuid,
  acao text not null,
  usuario_id uuid default auth.uid(),
  em timestamptz not null default now(),
  antes jsonb,
  depois jsonb
);
create index if not exists auditoria_registro_idx on imoveis.auditoria (tabela, registro_id, em desc);

insert into imoveis.secretarias (nome) values
  ('Administração'), ('Agricultura'), ('Assistência Social'), ('Cultura'), ('Educação'), ('Esporte'),
  ('Fazenda'), ('Gabinete do Prefeito'), ('Saúde'), ('Serviços Urbanos'), ('Obras')
on conflict do nothing;

-- ============================================================ 2. funções de acesso
create or replace function imoveis.meu_perfil() returns text
language sql stable security definer set search_path = '' as $$
  select case
    when hub.eh_admin_hub() then 'admin'
    else (
      select u.perfil
      from imoveis.usuarios u
      join hub.usuarios h on h.id = u.id
      where u.id = (select auth.uid())
        and h.ativo
        and exists (select 1 from hub.acessos_modulo a where a.usuario_id = u.id and a.modulo = 'imoveis')
    )
  end
$$;

create or replace function imoveis.minha_secretaria() returns uuid
language sql stable security definer set search_path = '' as $$
  select u.secretaria_id from imoveis.usuarios u where u.id = (select auth.uid()) and u.perfil = 'secretaria'
$$;

create or replace function imoveis.eh_gestor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(imoveis.meu_perfil() in ('admin', 'gestor'), false)
$$;

create or replace function imoveis.pode_ver() returns boolean
language sql stable security definer set search_path = '' as $$
  select imoveis.meu_perfil() is not null
$$;

-- Gestor, consulta e admin veem tudo; a secretaria só vê o que é da própria secretaria.
create or replace function imoveis.pode_ver_secretaria(p_secretaria uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when imoveis.meu_perfil() is null then false
    when imoveis.meu_perfil() = 'secretaria' then p_secretaria = imoveis.minha_secretaria()
    else true
  end
$$;

create or replace function imoveis.pode_ver_imovel(p_imovel uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from imoveis.imoveis i where i.id = p_imovel and imoveis.pode_ver_secretaria(i.secretaria_id)
  )
$$;

create or replace function imoveis.definir_acesso(p_usuario uuid, p_perfil text, p_secretaria uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not imoveis.eh_gestor() then
    raise exception 'Só o administrador ou o gestor define acessos ao módulo Imóveis.';
  end if;
  if p_perfil not in ('gestor', 'consulta', 'secretaria') then
    raise exception 'Perfil inválido: %', p_perfil;
  end if;
  if p_perfil = 'secretaria' and p_secretaria is null then
    raise exception 'O perfil de secretaria exige escolher a secretaria.';
  end if;
  if p_perfil <> 'secretaria' then
    p_secretaria := null;
  end if;
  if not exists (select 1 from hub.usuarios where id = p_usuario) then
    raise exception 'Usuário não encontrado na Central.';
  end if;
  insert into imoveis.usuarios (id, perfil, secretaria_id) values (p_usuario, p_perfil, p_secretaria)
    on conflict (id) do update set perfil = excluded.perfil, secretaria_id = excluded.secretaria_id;
end
$$;

-- ============================================================ 3. gatilhos
create or replace function imoveis.tocar_atualizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end
$$;

create or replace function imoveis.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  begin
    v_id := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'))::uuid;
  exception when others then
    v_id := null;
  end;
  insert into imoveis.auditoria (tabela, registro_id, acao, antes, depois)
  values (
    tg_table_name, v_id, tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end
$$;

-- Imóvel entregue/em entrega acompanha a linha de entrega: abrir a entrega muda a situação.
create or replace function imoveis.sincronizar_situacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update imoveis.imoveis
     set situacao = case when new.encerrado_em is not null then 'entregue' else 'em_entrega' end
   where id = new.id;
  return null;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array['usuarios', 'imoveis', 'unidades', 'contas', 'entregas', 'parametros'] loop
    execute format('drop trigger if exists tocar_atualizado on imoveis.%I', t);
    execute format('create trigger tocar_atualizado before update on imoveis.%I for each row execute function imoveis.tocar_atualizado()', t);
  end loop;
  foreach t in array array['usuarios', 'secretarias', 'imobiliarias', 'imoveis', 'unidades', 'contas', 'entregas', 'documentos', 'pendencias_justificadas', 'parametros'] loop
    execute format('drop trigger if exists auditoria on imoveis.%I', t);
    execute format('create trigger auditoria after insert or update or delete on imoveis.%I for each row execute function imoveis.registrar_auditoria()', t);
  end loop;
end $$;

drop trigger if exists sincronizar_situacao on imoveis.entregas;
create trigger sincronizar_situacao after insert or update on imoveis.entregas
  for each row execute function imoveis.sincronizar_situacao();

-- ============================================================ 4. RLS e privilégios
alter table imoveis.secretarias enable row level security;
alter table imoveis.usuarios enable row level security;
alter table imoveis.imobiliarias enable row level security;
alter table imoveis.imoveis enable row level security;
alter table imoveis.unidades enable row level security;
alter table imoveis.contas enable row level security;
alter table imoveis.entregas enable row level security;
alter table imoveis.documentos enable row level security;
alter table imoveis.pendencias_justificadas enable row level security;
alter table imoveis.parametros enable row level security;
alter table imoveis.preferencias_exportacao enable row level security;
alter table imoveis.auditoria enable row level security;

drop policy if exists le_usuarios on imoveis.usuarios;
create policy le_usuarios on imoveis.usuarios for select to authenticated
  using (id = (select auth.uid()) or imoveis.eh_gestor());
drop policy if exists le_auditoria on imoveis.auditoria;
create policy le_auditoria on imoveis.auditoria for select to authenticated using (imoveis.eh_gestor());

-- Catálogos: todos com acesso leem; só o gestor escreve.
do $$
declare
  t text;
begin
  foreach t in array array['secretarias', 'imobiliarias'] loop
    execute format('drop policy if exists le_%1$s on imoveis.%1$I', t);
    execute format('create policy le_%1$s on imoveis.%1$I for select to authenticated using (imoveis.pode_ver())', t);
  end loop;
  foreach t in array array['secretarias', 'imobiliarias', 'imoveis', 'unidades', 'contas', 'entregas', 'documentos', 'pendencias_justificadas'] loop
    execute format('drop policy if exists gestor_insere_%1$s on imoveis.%1$I', t);
    execute format('create policy gestor_insere_%1$s on imoveis.%1$I for insert to authenticated with check (imoveis.eh_gestor())', t);
    execute format('drop policy if exists gestor_altera_%1$s on imoveis.%1$I', t);
    execute format('create policy gestor_altera_%1$s on imoveis.%1$I for update to authenticated using (imoveis.eh_gestor()) with check (imoveis.eh_gestor())', t);
    execute format('drop policy if exists gestor_apaga_%1$s on imoveis.%1$I', t);
    execute format('create policy gestor_apaga_%1$s on imoveis.%1$I for delete to authenticated using (imoveis.eh_gestor())', t);
  end loop;
end $$;

-- Leitura por escopo de secretaria (a secretaria só enxerga o que é dela).
drop policy if exists le_imoveis on imoveis.imoveis;
create policy le_imoveis on imoveis.imoveis for select to authenticated
  using (imoveis.pode_ver_secretaria(secretaria_id));
drop policy if exists le_unidades on imoveis.unidades;
create policy le_unidades on imoveis.unidades for select to authenticated using (imoveis.pode_ver_imovel(imovel_id));
drop policy if exists le_entregas on imoveis.entregas;
create policy le_entregas on imoveis.entregas for select to authenticated using (imoveis.pode_ver_imovel(id));
drop policy if exists le_documentos on imoveis.documentos;
create policy le_documentos on imoveis.documentos for select to authenticated using (imoveis.pode_ver_imovel(imovel_id));
drop policy if exists le_pendencias_justificadas on imoveis.pendencias_justificadas;
create policy le_pendencias_justificadas on imoveis.pendencias_justificadas for select to authenticated using (imoveis.pode_ver_imovel(imovel_id));
drop policy if exists le_contas on imoveis.contas;
create policy le_contas on imoveis.contas for select to authenticated
  using (exists (select 1 from imoveis.unidades u where u.id = unidade_id and imoveis.pode_ver_imovel(u.imovel_id)));

drop policy if exists le_parametros on imoveis.parametros;
create policy le_parametros on imoveis.parametros for select to authenticated using (imoveis.pode_ver());
drop policy if exists gestor_altera_parametros on imoveis.parametros;
create policy gestor_altera_parametros on imoveis.parametros for update to authenticated
  using (imoveis.eh_gestor()) with check (imoveis.eh_gestor());

drop policy if exists propria_preferencia on imoveis.preferencias_exportacao;
create policy propria_preferencia on imoveis.preferencias_exportacao for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

revoke all on all tables in schema imoveis from public, anon, authenticated;
grant select on imoveis.usuarios, imoveis.auditoria to authenticated;
grant select, insert, update, delete on imoveis.secretarias, imoveis.imobiliarias, imoveis.imoveis,
  imoveis.unidades, imoveis.contas, imoveis.entregas, imoveis.documentos,
  imoveis.pendencias_justificadas, imoveis.preferencias_exportacao to authenticated;
grant select, update on imoveis.parametros to authenticated;
grant all on all tables in schema imoveis to service_role;

-- Funções: sem EXECUTE para o público/anon (lição do cadastro unificado).
revoke execute on all functions in schema imoveis from public, anon;
revoke execute on function imoveis.tocar_atualizado(), imoveis.registrar_auditoria(), imoveis.sincronizar_situacao() from authenticated;
grant execute on function imoveis.meu_perfil(), imoveis.minha_secretaria(), imoveis.eh_gestor(), imoveis.pode_ver(),
  imoveis.pode_ver_secretaria(uuid), imoveis.pode_ver_imovel(uuid), imoveis.definir_acesso(uuid, text, uuid)
  to authenticated, service_role;

-- ============================================================ 5. integração com a Central
alter table hub.acessos_modulo drop constraint if exists acessos_modulo_modulo_check;
alter table hub.acessos_modulo add constraint acessos_modulo_modulo_check
  check (modulo = any (array['compras', 'numera', 'requerimentos', 'emendas', 'frotas', 'imoveis']));

alter table hub.solicitacoes_acesso drop constraint if exists solicitacoes_acesso_modulos_validos;
alter table hub.solicitacoes_acesso add constraint solicitacoes_acesso_modulos_validos
  check (modulos_solicitados <@ array['compras', 'numera', 'requerimentos', 'emendas', 'frotas', 'imoveis']
         and coalesce(array_length(modulos_solicitados, 1), 0) > 0);

alter table hub.notificacoes drop constraint if exists notificacoes_app_check;
alter table hub.notificacoes add constraint notificacoes_app_check
  check (app = any (array['requerimentos', 'emendas', 'hub', 'compras', 'numera', 'frotas', 'imoveis']));

insert into hub.apps_feedback (slug, nome, cor, cor_texto, ordem)
  values ('imoveis', 'Imóveis', '#0E7490', '#0B5566', 6)
  on conflict (slug) do nothing;
update hub.apps_feedback set ordem = 7 where slug = 'hub' and ordem = 6;
