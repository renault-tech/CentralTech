-- Conciliação com o IPM (orientação do Controle Interno, 18/11/2026): o valor contábil (empenhado e pago) fica SEMPRE exato, sem
-- arredondamento. A diferença é registrada aqui: saldo não executado da emenda, anulação do saldo do empenho a fazer no IPM e, se o
-- executado passou do valor da emenda, a fonte de recurso que cobriu o excesso. Uma linha por emenda (id = id da emenda), criada só
-- quando há o que registrar. Já aplicada em produção por MCP (tabela, política e gatilho em comandos separados).

create table if not exists emendas.conciliacoes (
  id uuid primary key references emendas.emendas(id) on delete cascade,
  -- Saldo da emenda que não foi executado (valor da emenda − empenhado), registrado após conferir com o IPM.
  saldo_registrado_em date,
  saldo_valor numeric(14,2),
  saldo_observacao text check (saldo_observacao is null or length(saldo_observacao) <= 1000),
  -- Anulação do saldo do empenho (empenhado − pago) a fazer pela Contabilidade no IPM.
  anulacao_solicitada_em date,
  anulacao_documento text check (anulacao_documento is null or length(anulacao_documento) <= 200),
  anulacao_valor numeric(14,2),
  -- Excesso: executado acima do valor da emenda e a fonte de recurso que o cobriu.
  excesso_valor numeric(14,2),
  excesso_fonte text check (excesso_fonte is null or length(excesso_fonte) <= 300),
  excesso_documento text check (excesso_documento is null or length(excesso_documento) <= 200),
  conciliado_ipm_em date,
  observacao text check (observacao is null or length(observacao) <= 2000),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

alter table emendas.conciliacoes enable row level security;
create policy le_conciliacoes on emendas.conciliacoes for select to authenticated using (emendas.pode_ver_emenda(id));
create policy gestor_insere_conciliacoes on emendas.conciliacoes for insert to authenticated with check (emendas.eh_gestor());
create policy gestor_edita_conciliacoes on emendas.conciliacoes for update to authenticated using (emendas.eh_gestor()) with check (emendas.eh_gestor());
create policy gestor_apaga_conciliacoes on emendas.conciliacoes for delete to authenticated using (emendas.eh_gestor());
grant select, insert, update, delete on emendas.conciliacoes to authenticated;
grant all on emendas.conciliacoes to service_role;

create trigger auditoria after insert or update or delete on emendas.conciliacoes
  for each row execute function emendas.registrar_auditoria();

-- O banco passa a aceitar empenhado acima do valor da emenda SÓ quando a fonte do excesso está registrada em `conciliacoes`
-- (antes era barrado sempre). Rodar no SQL Editor se o MCP expirar em `create or replace function`.
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
  v_fonte text;
begin
  perform pg_advisory_xact_lock(hashtext('emendas.mov:' || new.emenda_id));
  select valor into v_valor from emendas.emendas where id = new.emenda_id;
  select nullif(btrim(excesso_fonte), '') into v_fonte from emendas.conciliacoes where id = new.emenda_id;
  select
    coalesce(sum(valor) filter (where tipo = 'empenho'), 0) - coalesce(sum(valor) filter (where tipo = 'anulacao'), 0),
    coalesce(sum(valor) filter (where tipo = 'liquidacao'), 0),
    coalesce(sum(valor) filter (where tipo = 'pagamento'), 0)
    into v_empenhado, v_liquidado, v_pago
    from emendas.movimentos_financeiros where emenda_id = new.emenda_id;
  if v_empenhado > v_valor + 0.005 and v_fonte is null then
    raise exception 'O empenhado (R$ %) passaria o valor da emenda (R$ %). Para registrar excesso, informe antes a fonte de recurso que o cobriu (Financeiro > Conciliação com o IPM).',
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
