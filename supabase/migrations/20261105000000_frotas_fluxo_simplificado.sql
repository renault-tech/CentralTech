-- Frotas: fluxo de manutenção simplificado.
-- Sai "OC enviada à secretaria" (a OC já nasce enviada) e "documentos de volta ao Frotas"
-- (a NF já valida o serviço). Fluxo: orçamento → análise → OC → NF → Contabilidade.
-- As colunas oc_enviada_em e docs_retornaram_em ficam no banco (histórico), mas o app não as usa mais.

update frotas.manutencoes set oc_enviada_em = null, docs_retornaram_em = null
  where oc_enviada_em is not null or docs_retornaram_em is not null;

alter table frotas.manutencoes drop constraint if exists man_cadeia;
alter table frotas.manutencoes drop constraint if exists man_ordem_datas;

alter table frotas.manutencoes add constraint man_cadeia check (
  (oc_emitida_em is null or oc_numero is not null)
  and (oc_valor is null or oc_numero is not null)
  and (nf_numero is null or oc_numero is not null)
  and (enviada_contabilidade_em is null or nf_numero is not null)
);
alter table frotas.manutencoes add constraint man_ordem_datas check (
  (analisado_em is null or analisado_em >= orcamento_recebido_em)
  and (oc_emitida_em is null or oc_emitida_em >= coalesce(analisado_em, orcamento_recebido_em))
  and (nf_emissao is null or oc_emitida_em is null or nf_emissao >= oc_emitida_em)
  and (enviada_contabilidade_em is null or nf_emissao is null or enviada_contabilidade_em >= nf_emissao)
);

-- Aviso do sino com as etapas novas (a função continua sem EXECUTE para ninguém, só o agendador).
create or replace function frotas.avisar_pendencias() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  p frotas.parametros%rowtype;
  v_dest uuid[];
  v_total integer := 0;
  r record;
  v_dias integer;
  v_nivel text;
  v_inicio date;
  v_fim date;
  v_nomes text;
begin
  select * into p from frotas.parametros where id = 1;
  select coalesce(array_agg(u.id), array[]::uuid[]) into v_dest
    from frotas.usuarios u
    join hub.usuarios h on h.id = u.id
    where u.perfil = 'gestor' and h.ativo
      and exists (select 1 from hub.acessos_modulo a where a.usuario_id = u.id and a.modulo = 'frotas');
  if cardinality(v_dest) = 0 then
    return 0;
  end if;

  -- 1. NF de combustível com a secretaria sem voltar, e NF assinada esperando ir à Contabilidade.
  begin
    for r in
      select n.id, n.numero_nf, s.nome as secretaria,
             case when n.retornou_em is null then n.enviada_secretaria_em else n.retornou_em end as desde,
             (n.retornou_em is null) as com_secretaria
      from frotas.notas_combustivel n
      join frotas.secretarias s on s.id = n.secretaria_id
      where n.enviada_contabilidade_em is null and n.enviada_secretaria_em is not null
    loop
      v_dias := v_hoje - r.desde;
      v_nivel := case when v_dias >= p.dias_critico then 'critico' when v_dias >= p.dias_atencao then 'atencao' end;
      continue when v_nivel is null;
      v_total := v_total + hub.notificar(
        v_dest, 'frotas', case when r.com_secretaria then 'nf_parada' else 'nf_contabilidade' end,
        'NF ' || r.numero_nf || ' (' || r.secretaria || '): ' || v_dias || ' dias ' ||
          case when r.com_secretaria then 'sem a assinatura da secretaria' else 'no Frotas, a enviar à Contabilidade' end,
        case v_nivel when 'critico' then 'Prazo crítico (' || p.dias_critico || ' dias) ultrapassado.' else 'Passou de ' || p.dias_atencao || ' dias na mesma etapa.' end,
        '/frotas/combustivel?editar=' || r.id, r.id, null,
        'nf:' || r.id || ':' || case when r.com_secretaria then 's' else 'c' end || ':' || v_nivel);
    end loop;
  exception when others then
    raise warning 'frotas.avisar_pendencias (NFs): %', sqlerrm;
  end;

  -- 2. Manutenção parada numa etapa e orçamento esperando análise.
  begin
    for r in
      select m.id, s.nome as secretaria, coalesce(v.placa, v.modelo) as veiculo, m.servico,
        case
          when m.status_analise = 'a_analisar' then 'a_analisar'
          when m.status_analise <> 'liberado' then null
          when m.enviada_contabilidade_em is not null then null
          when m.nf_numero is not null then 'contabilidade'
          when m.oc_numero is not null then 'nf'
          else 'oc'
        end as etapa,
        case
          when m.status_analise = 'a_analisar' then m.orcamento_recebido_em
          when m.nf_numero is not null then m.nf_emissao
          when m.oc_numero is not null then coalesce(m.oc_emitida_em, m.analisado_em)
          else coalesce(m.analisado_em, m.orcamento_recebido_em)
        end as desde
      from frotas.manutencoes m
      join frotas.secretarias s on s.id = m.secretaria_id
      join frotas.veiculos v on v.id = m.veiculo_id
    loop
      continue when r.etapa is null;
      v_dias := v_hoje - r.desde;
      v_nivel := case when v_dias >= p.dias_critico then 'critico' when v_dias >= p.dias_atencao then 'atencao' end;
      continue when v_nivel is null;
      v_total := v_total + hub.notificar(
        v_dest, 'frotas', 'manutencao_parada',
        case r.etapa
          when 'a_analisar' then 'Orçamento de ' || r.veiculo || ' (' || r.secretaria || ') espera análise há ' || v_dias || ' dias'
          when 'oc' then r.veiculo || ' (' || r.secretaria || '): serviço liberado há ' || v_dias || ' dias, sem OC'
          when 'nf' then r.veiculo || ' (' || r.secretaria || '): ' || v_dias || ' dias sem a NF da oficina'
          else r.veiculo || ' (' || r.secretaria || '): NF emitida há ' || v_dias || ' dias, a enviar à Contabilidade'
        end,
        r.servico || case v_nivel when 'critico' then ' · prazo crítico ultrapassado.' else ' · passou do prazo de atenção.' end,
        '/frotas/manutencao?id=' || r.id, r.id, null,
        'man:' || r.id || ':' || r.etapa || ':' || v_nivel);
    end loop;
  exception when others then
    raise warning 'frotas.avisar_pendencias (manutenções): %', sqlerrm;
  end;

  -- 3. Quinzena fechada sem NF de alguma secretaria (avisa uma vez, 5 dias depois de a quinzena acabar).
  begin
    if extract(day from v_hoje) <= 15 then
      v_inicio := (date_trunc('month', v_hoje) - interval '1 month')::date + 15;
      v_fim := date_trunc('month', v_hoje)::date - 1;
    else
      v_inicio := date_trunc('month', v_hoje)::date;
      v_fim := v_inicio + 14;
    end if;
    if v_hoje >= v_fim + 5 then
      select string_agg(s.nome, ', ' order by s.nome) into v_nomes
        from frotas.secretarias s
        where s.ativa and s.controla_combustivel
          and not exists (select 1 from frotas.notas_combustivel n where n.secretaria_id = s.id and n.periodo_inicio = v_inicio);
      if v_nomes is not null then
        v_total := v_total + hub.notificar(
          v_dest, 'frotas', 'quinzena_sem_nf',
          'Sem NF de combustível na quinzena de ' || to_char(v_inicio, 'DD/MM') || ' a ' || to_char(v_fim, 'DD/MM'),
          'Secretarias que ainda não mandaram: ' || v_nomes || '.',
          '/frotas/combustivel', null, null, 'quinzena:' || v_inicio);
      end if;
    end if;
  exception when others then
    raise warning 'frotas.avisar_pendencias (quinzena): %', sqlerrm;
  end;

  -- 4. Veículo que passou do limite de custo (manutenção dos últimos 12 meses ÷ valor de referência).
  begin
    for r in
      select v.id, coalesce(v.placa, v.modelo) as veiculo, s.nome as secretaria, c.total, v.valor_referencia,
             c.total / v.valor_referencia * 100 as pct
      from (
        select m.veiculo_id, sum(coalesce(m.nf_valor, m.oc_valor, m.orcamento_valor)) as total
        from frotas.manutencoes m
        where m.status_analise = 'liberado'
          and coalesce(m.nf_emissao, m.oc_emitida_em, m.analisado_em, m.orcamento_recebido_em) >= (v_hoje - interval '12 months')::date
        group by m.veiculo_id
      ) c
      join frotas.veiculos v on v.id = c.veiculo_id
      join frotas.secretarias s on s.id = v.secretaria_id
      where v.vinculo <> 'alugado' and v.valor_referencia > 0
    loop
      v_nivel := case when r.pct >= p.pct_critico then 'critico' when r.pct >= p.pct_atencao then 'atencao' end;
      continue when v_nivel is null;
      v_total := v_total + hub.notificar(
        v_dest, 'frotas', 'custo_veiculo',
        r.veiculo || ' (' || r.secretaria || '): manutenção em ' || round(r.pct) || '% do valor do veículo',
        case v_nivel when 'critico' then 'Passou de ' || p.pct_critico || '%: avaliar baixa ou troca.' else 'Passou de ' || p.pct_atencao || '%: em atenção.' end,
        '/frotas/analise', r.id, null, 'custo:' || r.id || ':' || v_nivel);
    end loop;
  exception when others then
    raise warning 'frotas.avisar_pendencias (custo): %', sqlerrm;
  end;

  return v_total;
end;
$$;

revoke execute on function frotas.avisar_pendencias() from public, anon, authenticated;
