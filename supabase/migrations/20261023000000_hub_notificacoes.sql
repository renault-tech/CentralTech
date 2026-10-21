-- Notificações da plataforma (sino da Central, selos nos cards, sino do
-- Requerimentos), entregues ao vivo pelo Supabase Realtime.
--
-- Uma tabela só para os módulos do projeto compartilhado que não tinham
-- avisos (Requerimentos, Emendas, Central). O Compras já tem a sua
-- (`public.notificacoes`) e continua nela; a Central só CONTA os avisos dele
-- a partir do corte gravado em `hub.config_notificacoes` (decisão do dono: o
-- acumulado antigo — até 494 não lidos por pessoa — não entra no selo).
-- Numera (projeto separado) fica para uma segunda etapa.
--
-- Quem gera:
--   * Requerimentos — gatilho em `eventos_timeline`: ciência, resposta e
--     pedido de prorrogação → Gabinete e Admin; distribuição → pessoas da
--     secretaria de destino; devolução à Câmara e novo documento → pessoas
--     das secretarias envolvidas; rotina diária (pg_cron) avisa prazo a 3
--     dias e no dia do vencimento → secretarias pendentes e Gabinete.
--   * Emendas — andamento, impedimento e empenho/pagamento avulso → gestores
--     do módulo e admins do Hub (a importação da planilha não gera aviso).
--   * Central — nova solicitação de acesso → admins do Hub.
-- Quem age nunca recebe aviso da própria ação. Uma falha ao notificar nunca
-- desfaz a ação de origem (os gatilhos engolem o erro com WARNING).
--
-- Arquivo reexecutável. Aplicar em partes pelo MCP; se travar, SQL Editor.

-- =============================================================== PARTE A

create table if not exists hub.notificacoes (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references auth.users (id) on delete cascade,
  app text not null check (app in ('requerimentos', 'emendas', 'hub', 'compras', 'numera')),
  tipo text not null check (length(tipo) <= 60),
  titulo text not null check (length(titulo) <= 200),
  mensagem text check (mensagem is null or length(mensagem) <= 1000),
  -- Caminho DENTRO do app (sempre começa com "/"); a Central monta o link.
  link text check (link is null or (link ~ '^/' and length(link) <= 500)),
  referencia_id uuid,
  -- Evita aviso repetido (ex.: prazo do mesmo requerimento no mesmo dia).
  chave_unica text check (chave_unica is null or length(chave_unica) <= 200),
  criado_em timestamptz not null default now(),
  lida_em timestamptz
);
create index if not exists notificacoes_destinatario_idx on hub.notificacoes (destinatario_id, criado_em desc);
create index if not exists notificacoes_nao_lidas_idx on hub.notificacoes (destinatario_id, app) where lida_em is null;
create unique index if not exists notificacoes_chave_unica_idx on hub.notificacoes (destinatario_id, chave_unica) where chave_unica is not null;

alter table hub.notificacoes enable row level security;
drop policy if exists le_proprias_notificacoes on hub.notificacoes;
create policy le_proprias_notificacoes on hub.notificacoes
  for select to authenticated using (destinatario_id = (select auth.uid()));
revoke all on hub.notificacoes from public, anon, authenticated;
grant select on hub.notificacoes to authenticated;
grant all on hub.notificacoes to service_role;

create table if not exists hub.config_notificacoes (
  id smallint primary key default 1 check (id = 1),
  corte_compras timestamptz not null default now()
);
insert into hub.config_notificacoes (id) values (1) on conflict (id) do nothing;
alter table hub.config_notificacoes enable row level security;
revoke all on hub.config_notificacoes from public, anon, authenticated;
grant all on hub.config_notificacoes to service_role;

-- Entrega ao vivo (a RLS acima vale também para o Realtime).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'hub' and tablename = 'notificacoes') then
    alter publication supabase_realtime add table hub.notificacoes;
  end if;
end $$;

-- =============================================================== PARTE B

-- Só gatilhos/rotinas (security definer) chamam; ninguém de fora insere.
create or replace function hub.notificar(
  p_destinatarios uuid[],
  p_app text,
  p_tipo text,
  p_titulo text,
  p_mensagem text,
  p_link text,
  p_referencia uuid,
  p_autor uuid,
  p_chave text default null
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_n integer;
begin
  insert into hub.notificacoes (destinatario_id, app, tipo, titulo, mensagem, link, referencia_id, chave_unica)
  select distinct d, p_app, p_tipo, left(p_titulo, 200), left(p_mensagem, 1000), p_link, p_referencia, p_chave
  from unnest(coalesce(p_destinatarios, array[]::uuid[])) as d
  where d is not null and d is distinct from p_autor
    and exists (select 1 from auth.users u where u.id = d)
  on conflict (destinatario_id, chave_unica) where chave_unica is not null do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

create or replace function hub.marcar_notificacoes_lidas(p_ids uuid[] default null, p_app text default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_n integer;
begin
  update hub.notificacoes set lida_em = now()
  where destinatario_id = (select auth.uid()) and lida_em is null
    and (p_ids is null or id = any (p_ids))
    and (p_app is null or app = p_app);
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

-- Não lidas por módulo para a pessoa logada (selos dos cards e do sino).
-- Compras: conta da tabela dele, só a partir do corte.
create or replace function hub.resumo_notificacoes()
returns table (app text, nao_lidas integer)
language sql
stable
security definer
set search_path to ''
as $function$
  select n.app, count(*)::integer
  from hub.notificacoes n
  where n.destinatario_id = (select auth.uid()) and n.lida_em is null
  group by n.app
  union all
  select 'compras', count(*)::integer
  from public.notificacoes c
  where c.destinatario_id = (select auth.uid()) and not c.lida
    and c.criado_em >= (select corte_compras from hub.config_notificacoes where id = 1)
  having count(*) > 0
$function$;

revoke execute on function hub.notificar(uuid[], text, text, text, text, text, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function hub.marcar_notificacoes_lidas(uuid[], text) from public, anon;
revoke execute on function hub.resumo_notificacoes() from public, anon;
grant execute on function hub.marcar_notificacoes_lidas(uuid[], text), hub.resumo_notificacoes() to authenticated;

-- =============================================================== PARTE C
-- Requerimentos.

-- Quem "é o Gabinete" para fins de aviso: perfis gabinete/admin e quem tem a
-- permissão `atua_como_gabinete` (pedido do dono: Gabinete e Admin).
create or replace function requerimentos.destinatarios_gabinete()
returns uuid[]
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(array_agg(distinct u.id), array[]::uuid[])
  from requerimentos.usuarios u
  where u.ativo and (
    u.perfil in ('gabinete', 'admin')
    or exists (select 1 from requerimentos.permissoes p where p.usuario_id = u.id and p.chave = 'atua_como_gabinete' and p.valor)
  )
$function$;

create or replace function requerimentos.destinatarios_secretarias(p_secretarias uuid[])
returns uuid[]
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(array_agg(distinct u.id), array[]::uuid[])
  from requerimentos.usuarios u
  where u.ativo and u.perfil = 'secretaria' and u.secretaria_id = any (coalesce(p_secretarias, array[]::uuid[]))
$function$;

create or replace function requerimentos.notificar_evento()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_req requerimentos.requerimentos;
  v_dest uuid[];
  v_titulo text;
  v_sec text;
  v_vinculadas uuid[];
  v_link text;
begin
  select * into v_req from requerimentos.requerimentos where id = new.requerimento_id;
  if not found then
    return null;
  end if;
  v_link := '/dashboard?req=' || v_req.id;
  select coalesce(array_agg(secretaria_id), array[]::uuid[]) into v_vinculadas
    from requerimentos.requerimentos_secretarias where requerimento_id = v_req.id;

  if new.tipo in ('secretaria_deu_ciencia', 'secretaria_respondeu') then
    select nome into v_sec from requerimentos.secretarias where id = (new.detalhe ->> 'secretaria')::uuid;
    v_dest := requerimentos.destinatarios_gabinete();
    v_titulo := 'Requerimento ' || v_req.numero || ': ' || coalesce(v_sec, 'secretaria')
      || case new.tipo when 'secretaria_deu_ciencia' then ' deu ciência' else ' respondeu' end;
  elsif new.tipo = 'prorrogacao_solicitada' then
    select s.nome into v_sec from requerimentos.usuarios u join requerimentos.secretarias s on s.id = u.secretaria_id where u.id = new.autor_id;
    v_dest := requerimentos.destinatarios_gabinete();
    v_titulo := 'Requerimento ' || v_req.numero || ': prorrogação de ' || coalesce(new.detalhe ->> 'dias', '?') || ' dias'
      || coalesce(' (' || v_sec || ')', '');
  elsif new.tipo = 'distribuido' then
    v_dest := requerimentos.destinatarios_secretarias(array(select jsonb_array_elements_text(coalesce(new.detalhe -> 'secretarias', '[]'::jsonb))::uuid));
    v_titulo := 'Novo requerimento ' || v_req.numero || ' para a sua secretaria';
  elsif new.tipo = 'devolvido' then
    v_dest := requerimentos.destinatarios_secretarias(v_vinculadas);
    v_titulo := 'Requerimento ' || v_req.numero || ' devolvido à Câmara' || coalesce(' (protocolo ' || (new.detalhe ->> 'protocolo') || ')', '');
  elsif new.tipo = 'documento_anexado' then
    v_dest := requerimentos.destinatarios_secretarias(v_vinculadas);
    v_titulo := 'Novo documento no requerimento ' || v_req.numero;
  else
    return null;
  end if;

  perform hub.notificar(v_dest, 'requerimentos', new.tipo, v_titulo, v_req.vereador || ' · ' || v_req.assunto,
                        v_link, v_req.id, new.autor_id);
  return null;
exception when others then
  raise warning '[requerimentos.notificar_evento] %', sqlerrm;
  return null;
end;
$function$;

drop trigger if exists notificar_evento on requerimentos.eventos_timeline;
create trigger notificar_evento
  after insert on requerimentos.eventos_timeline
  for each row execute function requerimentos.notificar_evento();

-- Prazo: a 3 dias e no dia do vencimento, para cada requerimento distribuído,
-- não devolvido nem anulado, com secretaria ainda sem resposta. Mesmo cálculo
-- de `calcularDiasRestantes` (recebido_em + dias_total, dia de Brasília).
create or replace function requerimentos.avisar_prazos()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r record;
  v_total integer := 0;
  v_pendentes uuid[];
  v_titulo text;
begin
  for r in
    select q.*, (q.recebido_em + q.dias_total) - v_hoje as restantes
    from requerimentos.requerimentos q
    where q.distribuido_em is not null and q.devolvido_em is null and q.anulado_em is null
      and (q.recebido_em + q.dias_total) - v_hoje in (3, 0)
  loop
    select coalesce(array_agg(secretaria_id), array[]::uuid[]) into v_pendentes
      from requerimentos.requerimentos_secretarias where requerimento_id = r.id and respondida_em is null;
    continue when cardinality(v_pendentes) = 0;
    v_titulo := 'Requerimento ' || r.numero || case when r.restantes = 0 then ': prazo vence hoje' else ': prazo vence em 3 dias' end;
    v_total := v_total + hub.notificar(
      requerimentos.destinatarios_secretarias(v_pendentes) || requerimentos.destinatarios_gabinete(),
      'requerimentos', 'prazo', v_titulo, r.vereador || ' · ' || r.assunto,
      '/dashboard?req=' || r.id, r.id, null, 'prazo:' || r.id || ':' || v_hoje);
  end loop;
  return v_total;
end;
$function$;

revoke execute on function requerimentos.notificar_evento(), requerimentos.avisar_prazos(),
  requerimentos.destinatarios_gabinete(), requerimentos.destinatarios_secretarias(uuid[]) from public, anon, authenticated;

-- Todo dia às 8h de Brasília (11h UTC).
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'requerimentos-avisar-prazos') then
    perform cron.schedule('requerimentos-avisar-prazos', '0 11 * * *', 'select requerimentos.avisar_prazos()');
  end if;
end $$;

-- =============================================================== PARTE D
-- Emendas e Central.

create or replace function emendas.notificar_execucao()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_e emendas.emendas;
  v_sec text;
  v_quem text;
  v_titulo text;
  v_dest uuid[];
begin
  -- A importação da planilha grava centenas de linhas de uma vez: sem aviso.
  if current_query() ilike '%importar%' then
    return null;
  end if;
  select * into v_e from emendas.emendas where id = new.emenda_id;
  if not found then
    return null;
  end if;
  select s.nome into v_sec from emendas.unidades_orcamentarias u join emendas.secretarias s on s.id = u.secretaria_id where u.id = v_e.unidade_id;
  select nome into v_quem from hub.usuarios where id = (select auth.uid());

  if tg_table_name = 'andamentos' then
    v_titulo := 'Emenda nº ' || v_e.numero || ': ' || coalesce((select nome from emendas.etapas where chave = new.etapa), new.etapa);
  elsif tg_table_name = 'impedimentos' then
    v_titulo := 'Emenda nº ' || v_e.numero || ': impedimento registrado';
  elsif tg_table_name = 'movimentos_financeiros' then
    -- Empenho/pagamento lançado junto com o andamento já foi avisado acima.
    if new.tipo not in ('empenho', 'pagamento')
       or exists (select 1 from emendas.andamentos a where a.emenda_id = new.emenda_id and a.criado_em = now()) then
      return null;
    end if;
    v_titulo := 'Emenda nº ' || v_e.numero || ': ' || case new.tipo when 'empenho' then 'empenho' else 'pagamento' end || ' registrado';
  else
    return null;
  end if;

  select coalesce(array_agg(distinct x), array[]::uuid[]) into v_dest from (
    select u.id as x from emendas.usuarios u join hub.usuarios h on h.id = u.id where u.ativo and h.ativo and u.perfil = 'gestor'
    union
    select h.id from hub.usuarios h where h.ativo and h.admin_hub
  ) d;

  perform hub.notificar(v_dest, 'emendas', tg_table_name, v_titulo,
                        coalesce(v_sec || ' · ', '') || v_e.objeto || coalesce(' · por ' || v_quem, ''),
                        '/emendas/' || v_e.id, v_e.id, (select auth.uid()));
  return null;
exception when others then
  raise warning '[emendas.notificar_execucao] %', sqlerrm;
  return null;
end;
$function$;

drop trigger if exists notificar_execucao on emendas.andamentos;
create trigger notificar_execucao after insert on emendas.andamentos
  for each row execute function emendas.notificar_execucao();
drop trigger if exists notificar_execucao on emendas.impedimentos;
create trigger notificar_execucao after insert on emendas.impedimentos
  for each row execute function emendas.notificar_execucao();
drop trigger if exists notificar_execucao on emendas.movimentos_financeiros;
create trigger notificar_execucao after insert on emendas.movimentos_financeiros
  for each row execute function emendas.notificar_execucao();

create or replace function hub.notificar_solicitacao_acesso()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform hub.notificar(
    (select coalesce(array_agg(id), array[]::uuid[]) from hub.usuarios where ativo and admin_hub),
    'hub', 'solicitacao_acesso',
    'Pedido de acesso: ' || new.nome,
    array_to_string(new.modulos_solicitados, ', ') || ' · ' || new.email,
    '/configuracoes/solicitacoes', new.id, (select auth.uid()));
  return null;
exception when others then
  raise warning '[hub.notificar_solicitacao_acesso] %', sqlerrm;
  return null;
end;
$function$;

drop trigger if exists notificar_solicitacao_acesso on hub.solicitacoes_acesso;
create trigger notificar_solicitacao_acesso after insert on hub.solicitacoes_acesso
  for each row execute function hub.notificar_solicitacao_acesso();

revoke execute on function emendas.notificar_execucao(), hub.notificar_solicitacao_acesso() from public, anon, authenticated;
