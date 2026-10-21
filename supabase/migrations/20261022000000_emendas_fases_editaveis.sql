-- Fases do fluxo das emendas editáveis (Configurações do módulo → Fases).
--
-- Antes: a lista de etapas morava em dois CHECKs (emendas.etapa e
-- andamentos.etapa) e em `etapa_compativel_modalidade`. Agora:
--   * emendas.etapas        — a fase em si (nome, cor, grupo, fixa);
--   * emendas.fluxo_etapas  — quais fases cada modalidade usa, em que ordem
--                             e se estão ativas (dois fluxos separados:
--                             repasse a entidade × aplicação direta).
-- Fixas (não saem, só renomeiam/recolorem): indicada, empenhada, liquidada,
-- paga, concluida — alimentam os totais empenhado/pago. Retirar uma fase =
-- desativar (some das novas opções; o histórico fica). Só uma fase que nunca
-- foi usada pode ser excluída de vez.
-- Quem edita: admin do Hub e gestor (RPC emendas.salvar_fluxo).
--
-- Arquivo reexecutável (idempotente). As partes A e B e as funções auxiliares
-- da C já foram aplicadas por MCP; `salvar_fluxo`, `remanejar` e
-- `definir_acesso` precisam ser rodadas no SQL Editor do painel (o MCP trava
-- nesses CREATE/DROP de função) — rode o arquivo inteiro, sem risco.

-- =============================================================== PARTE A

create table if not exists emendas.etapas (
  chave text primary key check (chave ~ '^[a-z][a-z0-9_]{1,40}$'),
  nome text not null check (length(trim(nome)) between 2 and 60),
  cor text not null check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  -- 0 sem andamento · 1 em andamento · 2 empenhada/liquidada · 3 paga ou adiante
  grupo smallint not null check (grupo between 0 and 3),
  fixa boolean not null default false
);

create table if not exists emendas.fluxo_etapas (
  modalidade text not null check (modalidade in ('repasse', 'direta')),
  chave text not null references emendas.etapas (chave),
  ordem int not null,
  ativa boolean not null default true,
  primary key (modalidade, chave)
);

insert into emendas.etapas (chave, nome, cor, grupo, fixa) values
  ('indicada', 'Indicada', '#CBD5E1', 0, true),
  ('analise', 'Análise técnica', '#DDD6F7', 1, false),
  ('plano_trabalho', 'Plano de trabalho', '#BBAAEE', 1, false),
  ('processo_compra', 'Processo de compra', '#BBAAEE', 1, false),
  ('empenhada', 'Empenhada', '#9479DD', 2, true),
  ('liquidada', 'Liquidada', '#7556C7', 2, true),
  ('paga', 'Paga', '#563A9E', 3, true),
  ('prestacao_contas', 'Prestação de contas', '#43307E', 3, false),
  ('concluida', 'Concluída', '#2A1C55', 3, true)
on conflict (chave) do nothing;

insert into emendas.fluxo_etapas (modalidade, chave, ordem) values
  ('repasse', 'indicada', 10), ('repasse', 'analise', 20), ('repasse', 'plano_trabalho', 30),
  ('repasse', 'empenhada', 40), ('repasse', 'liquidada', 50), ('repasse', 'paga', 60),
  ('repasse', 'prestacao_contas', 70), ('repasse', 'concluida', 80),
  ('direta', 'indicada', 10), ('direta', 'analise', 20), ('direta', 'processo_compra', 30),
  ('direta', 'empenhada', 40), ('direta', 'liquidada', 50), ('direta', 'paga', 60),
  ('direta', 'concluida', 70)
on conflict (modalidade, chave) do nothing;

alter table emendas.etapas enable row level security;
alter table emendas.fluxo_etapas enable row level security;

drop policy if exists le_etapas on emendas.etapas;
drop policy if exists le_fluxo_etapas on emendas.fluxo_etapas;
create policy le_etapas on emendas.etapas for select to authenticated using (emendas.meu_perfil() is not null);
create policy le_fluxo_etapas on emendas.fluxo_etapas for select to authenticated using (emendas.meu_perfil() is not null);

revoke all on emendas.etapas, emendas.fluxo_etapas from public, anon, authenticated;
grant select on emendas.etapas, emendas.fluxo_etapas to authenticated;
grant all on emendas.etapas, emendas.fluxo_etapas to service_role;

-- =============================================================== PARTE B
-- Os CHECKs de lista fixa dão lugar a chave estrangeira (a fase pode ser
-- desativada, mas nunca some enquanto houver histórico).

alter table emendas.emendas drop constraint if exists emendas_etapa_check;
alter table emendas.emendas drop constraint if exists etapa_compativel_modalidade;
alter table emendas.andamentos drop constraint if exists andamentos_etapa_check;

alter table emendas.emendas drop constraint if exists emendas_etapa_fkey;
alter table emendas.andamentos drop constraint if exists andamentos_etapa_fkey;
alter table emendas.emendas
  add constraint emendas_etapa_fkey foreign key (etapa) references emendas.etapas (chave);
alter table emendas.andamentos
  add constraint andamentos_etapa_fkey foreign key (etapa) references emendas.etapas (chave);

-- =============================================================== PARTE C

-- Fase para onde a emenda volta quando é remanejada antes do empenho: a
-- primeira fase ativa depois de "Indicada" no fluxo (hoje, a análise técnica).
create or replace function emendas.etapa_de_retorno(p_modalidade text)
returns text
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce(
    (select f.chave from emendas.fluxo_etapas f
       where f.modalidade = p_modalidade and f.ativa and f.chave <> 'indicada'
         and f.ordem < (select e.ordem from emendas.fluxo_etapas e where e.modalidade = p_modalidade and e.chave = 'empenhada')
       order by f.ordem limit 1),
    'indicada')
$function$;

-- Um andamento só pode usar uma fase ATIVA do fluxo da modalidade da emenda.
create or replace function emendas.validar_etapa_andamento()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_modalidade text;
begin
  if tg_op = 'UPDATE' and new.etapa is not distinct from old.etapa then
    return new;
  end if;
  select modalidade into v_modalidade from emendas.emendas where id = new.emenda_id;
  if not exists (
    select 1 from emendas.fluxo_etapas
    where modalidade = v_modalidade and chave = new.etapa and ativa
  ) then
    raise exception 'A fase “%” não faz parte do fluxo ativo desta emenda (%).', new.etapa,
      case v_modalidade when 'repasse' then 'repasse a entidade' else 'aplicação direta' end
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

drop trigger if exists validar_etapa_andamento on emendas.andamentos;
create trigger validar_etapa_andamento
  before insert or update on emendas.andamentos
  for each row execute function emendas.validar_etapa_andamento();

-- Se a modalidade da emenda muda (a natureza da despesa foi alterada) e a
-- fase atual não existe no fluxo novo, volta para a fase de retorno. Roda
-- depois de `antes_salvar_emenda` (que recalcula a modalidade) — os gatilhos
-- BEFORE disparam em ordem alfabética.
create or replace function emendas.ajustar_etapa_modalidade()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE' and new.modalidade is distinct from old.modalidade
     and not exists (select 1 from emendas.fluxo_etapas where modalidade = new.modalidade and chave = new.etapa) then
    new.etapa := emendas.etapa_de_retorno(new.modalidade);
    new.etapa_atualizada_em := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists zz_ajustar_etapa_modalidade on emendas.emendas;
create trigger zz_ajustar_etapa_modalidade
  before update on emendas.emendas
  for each row execute function emendas.ajustar_etapa_modalidade();

-- Salva o fluxo de uma modalidade. p_itens (na ordem desejada):
--   [{"chave": "analise" | null (fase nova), "nome": "...", "cor": "#RRGGBB",
--     "ativa": true, "remover": false}]
-- Regras: fixas presentes, ativas e na ordem indicada < empenhada < liquidada
-- < paga < concluida, com "indicada" primeiro e "concluida" por último; nomes
-- sem repetição entre as ativas; "remover" só para fase sem nenhum uso.
create or replace function emendas.salvar_fluxo(p_modalidade text, p_itens jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_fixas text[] := array['indicada', 'empenhada', 'liquidada', 'paga', 'concluida'];
  v_item jsonb;
  v_i int := 0;
  v_n int;
  v_chave text;
  v_nome text;
  v_cor text;
  v_ativa boolean;
  v_grupo smallint;
  v_pos_emp int;
  v_pos_paga int;
  v_chaves text[] := array[]::text[];
  v_ativos text[] := array[]::text[];
  v_nomes text[] := array[]::text[];
  v_antes int;
  v_f text;
  v_ultima_pos int := 0;
  v_pos int;
begin
  if not emendas.eh_gestor() then
    raise exception 'Só o administrador ou o gestor pode editar as fases do fluxo.';
  end if;
  if p_modalidade not in ('repasse', 'direta') then
    raise exception 'Modalidade inválida.';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe ao menos uma fase.';
  end if;
  perform pg_advisory_xact_lock(hashtext('emendas.salvar_fluxo'));
  v_n := jsonb_array_length(p_itens);

  -- Passo 1: chaves (gera as das fases novas) e remoções.
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_i := v_i + 1;
    v_chave := nullif(trim(v_item ->> 'chave'), '');
    v_nome := trim(coalesce(v_item ->> 'nome', ''));
    if length(v_nome) < 2 or length(v_nome) > 60 then
      raise exception 'O nome de cada fase precisa ter de 2 a 60 caracteres.';
    end if;
    if v_chave is null then
      v_chave := 'f_' || substr(regexp_replace(
                   translate(lower(v_nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
                   '[^a-z0-9]+', '_', 'g'), 1, 24)
                 || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
      v_chave := regexp_replace(v_chave, '_+', '_', 'g');
    elsif not exists (select 1 from emendas.etapas where chave = v_chave) then
      raise exception 'Fase desconhecida: %.', v_chave;
    end if;

    if coalesce((v_item ->> 'remover')::boolean, false) then
      if v_chave = any (v_fixas) then
        raise exception 'A fase “%” é fixa e não pode ser removida.', v_nome;
      end if;
      if exists (
        select 1 from emendas.andamentos a join emendas.emendas e on e.id = a.emenda_id
        where a.etapa = v_chave and e.modalidade = p_modalidade
      ) or exists (select 1 from emendas.emendas e where e.etapa = v_chave and e.modalidade = p_modalidade) then
        raise exception 'A fase “%” já foi usada neste fluxo: desative-a em vez de excluir.', v_nome;
      end if;
      delete from emendas.fluxo_etapas where modalidade = p_modalidade and chave = v_chave;
      if not exists (select 1 from emendas.fluxo_etapas where chave = v_chave)
         and not exists (select 1 from emendas.andamentos where etapa = v_chave)
         and not exists (select 1 from emendas.emendas where etapa = v_chave) then
        delete from emendas.etapas where chave = v_chave;
      end if;
      continue;
    end if;

    v_ativa := coalesce((v_item ->> 'ativa')::boolean, true);
    if v_chave = any (v_fixas) and not v_ativa then
      raise exception 'A fase “%” é fixa e não pode ser desativada.', v_nome;
    end if;
    if v_chave = any (v_chaves) then
      raise exception 'A fase “%” aparece duas vezes.', v_nome;
    end if;
    v_chaves := v_chaves || v_chave;
    if v_ativa then
      if lower(v_nome) = any (v_nomes) then
        raise exception 'Duas fases ativas com o mesmo nome (“%”).', v_nome;
      end if;
      v_nomes := v_nomes || lower(v_nome);
      v_ativos := v_ativos || v_chave;
    end if;
  end loop;

  -- Passo 2: fixas presentes e na ordem certa; indicada primeiro, concluída por último.
  foreach v_f in array v_fixas loop
    v_pos := array_position(v_chaves, v_f);
    if v_pos is null then
      raise exception 'A fase fixa “%” precisa continuar no fluxo.', v_f;
    end if;
    if v_pos <= v_ultima_pos then
      raise exception 'As fases fixas precisam seguir a ordem: Indicada, Empenhada, Liquidada, Paga, Concluída.';
    end if;
    v_ultima_pos := v_pos;
  end loop;
  if v_chaves[1] <> 'indicada' then
    raise exception 'A primeira fase precisa ser “Indicada”.';
  end if;
  if v_chaves[array_length(v_chaves, 1)] <> 'concluida' then
    raise exception 'A última fase precisa ser “Concluída”.';
  end if;

  -- Passo 3: nenhuma fase do fluxo atual pode ter ficado de fora da lista.
  if exists (
    select 1 from emendas.fluxo_etapas f
    where f.modalidade = p_modalidade and f.chave <> all (v_chaves)
  ) then
    raise exception 'A lista enviada está incompleta: reabra a tela e tente de novo.';
  end if;

  v_pos_emp := array_position(v_chaves, 'empenhada');
  v_pos_paga := array_position(v_chaves, 'paga');
  v_i := 0;
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_chave := nullif(trim(v_item ->> 'chave'), '');
    if coalesce((v_item ->> 'remover')::boolean, false) then
      continue;
    end if;
    v_i := v_i + 1;
    -- fases novas: a chave gerada no passo 1 é a i-ésima de v_chaves
    v_chave := v_chaves[v_i];
    v_nome := trim(v_item ->> 'nome');
    v_cor := coalesce(nullif(trim(v_item ->> 'cor'), ''), '#BBAAEE');
    if v_cor !~ '^#[0-9A-Fa-f]{6}$' then
      raise exception 'Cor inválida: %.', v_cor;
    end if;
    v_ativa := coalesce((v_item ->> 'ativa')::boolean, true);
    v_grupo := case
      when v_i = 1 then 0
      when v_i < v_pos_emp then 1
      when v_i < v_pos_paga then 2
      else 3
    end;
    insert into emendas.etapas (chave, nome, cor, grupo, fixa)
      values (v_chave, v_nome, v_cor, v_grupo, v_chave = any (v_fixas))
      on conflict (chave) do update set nome = excluded.nome, cor = excluded.cor, grupo = excluded.grupo;
    insert into emendas.fluxo_etapas (modalidade, chave, ordem, ativa)
      values (p_modalidade, v_chave, v_i * 10, v_ativa)
      on conflict (modalidade, chave) do update set ordem = excluded.ordem, ativa = excluded.ativa;
  end loop;
end;
$function$;

-- Remanejamento: igual ao anterior, mas sem fases fixas no código. A volta
-- para a fase de retorno (análise técnica, hoje) acontece quando a emenda
-- ainda não foi empenhada ou quando a mudança de natureza a tirou do fluxo.
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
  v_volta text;
  v_antes_do_empenho boolean;
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
    ficha = case when p_novo ? 'ficha' then p_novo ->> 'ficha' else ficha end
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

  v_volta := emendas.etapa_de_retorno(v_depois.modalidade);
  v_antes_do_empenho := coalesce((
    select f.ordem < (select e.ordem from emendas.fluxo_etapas e where e.modalidade = v_depois.modalidade and e.chave = 'empenhada')
    from emendas.fluxo_etapas f where f.modalidade = v_depois.modalidade and f.chave = v_depois.etapa
  ), true);
  if v_depois.etapa is distinct from v_antes.etapa or (v_antes_do_empenho and v_depois.etapa <> v_volta) then
    insert into emendas.andamentos (emenda_id, etapa, observacao, usuario_id, usuario_nome)
      values (p_emenda, v_volta, 'Retorno à fase inicial após remanejamento',
              (select auth.uid()), (select nome from hub.usuarios where id = (select auth.uid())));
  end if;
  return v_id;
end;
$function$;

-- Permissões por secretaria: só o administrador do Hub e o gestor definem
-- (decisão do dono — todo acesso passa por eles; o admin de secretaria deixa
-- de ajustar a própria equipe).
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
  v_p jsonb;
  v_sec uuid;
  v_ver boolean;
  v_editar boolean;
begin
  if not emendas.eh_gestor() then
    raise exception 'Só o administrador ou o gestor define acessos ao módulo Emendas.';
  end if;
  if p_perfil not in ('gestor', 'admin_secretaria', 'operador', 'consulta') then
    raise exception 'Perfil inválido: %', p_perfil;
  end if;
  if jsonb_typeof(coalesce(p_permissoes, '[]'::jsonb)) <> 'array' then
    raise exception 'Permissões em formato inválido.';
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
      insert into emendas.permissoes (usuario_id, secretaria_id, pode_ver, pode_editar)
        values (p_usuario, v_sec, v_ver, v_editar)
        on conflict (usuario_id, secretaria_id) do update set pode_ver = excluded.pode_ver, pode_editar = excluded.pode_editar;
    end loop;
  end if;
end;
$function$;

revoke execute on function
  emendas.etapa_de_retorno(text), emendas.validar_etapa_andamento(), emendas.ajustar_etapa_modalidade(),
  emendas.salvar_fluxo(text, jsonb), emendas.remanejar(uuid, jsonb, text, text),
  emendas.definir_acesso(uuid, text, uuid, jsonb, boolean)
  from public, anon;
grant execute on function emendas.salvar_fluxo(text, jsonb), emendas.remanejar(uuid, jsonb, text, text),
  emendas.definir_acesso(uuid, text, uuid, jsonb, boolean), emendas.etapa_de_retorno(text) to authenticated;

-- Limpeza de funções de teste/auxiliares criadas durante a implantação.
drop function if exists emendas._teste_hang();
drop function if exists emendas._teste_tam();
drop function if exists hub._cascata_emendas(uuid, text[], text[]);
