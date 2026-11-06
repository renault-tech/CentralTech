-- Imóveis e Consumo: avisos no sino da Central (hub.notificacoes), gerados todo dia às 8h de Brasília.
--
-- O Setor de Imóveis (perfil `gestor`) faz quase tudo no módulo, então aviso por "ação de outra pessoa" quase nunca
-- chegaria. O sino cobre o que ninguém está olhando: contrato perto do fim ou vencido, imóvel entregue com a conta
-- ainda chegando, chaves entregues sem desligamento, conta sem lançamento no mês, conta em atraso e consumo fora
-- do padrão. Cada aviso tem `chave_unica` (a mesma situação nunca é avisada duas vezes; piorar gera um aviso novo).
-- Limites: os de `imoveis.parametros` (os mesmos das telas). Só roda pelo agendador (sem EXECUTE para ninguém).

create function imoveis.avisar_pendencias() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  p imoveis.parametros%rowtype;
  v_dest uuid[];
  v_total integer := 0;
  r record;
  v_dias integer;
  v_nivel text;
begin
  select * into p from imoveis.parametros where id = 1;
  select coalesce(array_agg(u.id), array[]::uuid[]) into v_dest
    from imoveis.usuarios u
    join hub.usuarios h on h.id = u.id
    where u.perfil = 'gestor' and h.ativo
      and exists (select 1 from hub.acessos_modulo a where a.usuario_id = u.id and a.modulo = 'imoveis');
  if cardinality(v_dest) = 0 then
    return 0;
  end if;

  -- 1. Contrato perto do fim (crítico a 30 dias ou menos) ou vencido.
  begin
    for r in select i.id, i.nome, i.vigencia_fim from imoveis.imoveis i
             where i.situacao <> 'entregue' and i.vigencia_fim is not null and i.vigencia_fim - v_hoje <= p.dias_fim_contrato
    loop
      v_dias := r.vigencia_fim - v_hoje;
      v_nivel := case when v_dias < 0 then 'vencido' when v_dias <= 30 then 'critico' else 'atencao' end;
      v_total := v_total + hub.notificar(
        v_dest, 'imoveis', 'contrato',
        r.nome || ': ' || case when v_dias < 0 then 'contrato vencido há ' || (-v_dias) || ' dias' else 'contrato vence em ' || v_dias || ' dias' end,
        'Renovar o contrato ou iniciar a entrega do imóvel.',
        '/imoveis/imoveis/' || r.id, r.id, null, 'contrato:' || r.id || ':' || v_nivel);
    end loop;
  exception when others then
    raise warning 'imoveis.avisar_pendencias (contrato): %', sqlerrm;
  end;

  -- 2. Imóvel com chaves entregues e a conta de água/luz continua chegando.
  begin
    for r in
      select distinct on (u.id) u.id as unidade_id, u.tipo, u.numero, i.id as imovel_id, i.nome, c.referencia, c.valor
      from imoveis.entregas e
      join imoveis.imoveis i on i.id = e.id
      join imoveis.unidades u on u.imovel_id = i.id
      join imoveis.contas c on c.unidade_id = u.id
      where e.chaves_entregues_em is not null
        and c.referencia > date_trunc('month', e.chaves_entregues_em)::date
        and c.valor > 0
      order by u.id, c.referencia desc
    loop
      v_total := v_total + hub.notificar(
        v_dest, 'imoveis', 'ligacao_ativa',
        r.nome || ': ' || case r.tipo when 'agua' then 'água' else 'luz' end || ' ainda ligada após a entrega',
        'A conta de ' || to_char(r.referencia, 'MM/YYYY') || ' (R$ ' || to_char(r.valor, 'FM999G990D00') || ') continua chegando em ' || r.numero || '.',
        '/imoveis/imoveis/' || r.imovel_id || '?aba=entrega', r.imovel_id, null, 'ligacao:' || r.unidade_id || ':' || r.referencia);
    end loop;
  exception when others then
    raise warning 'imoveis.avisar_pendencias (ligacao): %', sqlerrm;
  end;

  -- 3. Chaves entregues sem desligamento confirmado.
  begin
    for r in select i.id, i.nome, e.agua_desligada_em, e.luz_desligada_em from imoveis.entregas e join imoveis.imoveis i on i.id = e.id
             where e.chaves_entregues_em is not null and e.encerrado_em is null and (e.agua_desligada_em is null or e.luz_desligada_em is null)
    loop
      v_total := v_total + hub.notificar(
        v_dest, 'imoveis', 'desligamento',
        r.nome || ': chaves entregues sem desligamento confirmado',
        'Falta confirmar o desligamento de ' || case when r.agua_desligada_em is null and r.luz_desligada_em is null then 'água e luz' when r.agua_desligada_em is null then 'água' else 'luz' end || '.',
        '/imoveis/imoveis/' || r.id || '?aba=entrega', r.id, null,
        'desligamento:' || r.id || ':' || (r.agua_desligada_em is null)::text || (r.luz_desligada_em is null)::text);
    end loop;
  exception when others then
    raise warning 'imoveis.avisar_pendencias (desligamento): %', sqlerrm;
  end;

  -- 4. Conta do mês sem lançamento (a partir do dia configurado), só imóvel em uso.
  begin
    if extract(day from v_hoje) >= p.dia_lancamento then
      for r in select u.id as unidade_id, u.tipo, u.numero, i.id as imovel_id, i.nome
               from imoveis.unidades u join imoveis.imoveis i on i.id = u.imovel_id
               where u.ativa and i.situacao = 'ativo'
                 and not exists (select 1 from imoveis.contas c where c.unidade_id = u.id and c.referencia >= v_mes)
      loop
        v_total := v_total + hub.notificar(
          v_dest, 'imoveis', 'sem_conta',
          r.nome || ': conta de ' || case r.tipo when 'agua' then 'água' else 'luz' end || ' do mês sem lançamento',
          'Nenhuma conta de ' || to_char(v_mes, 'MM/YYYY') || ' lançada para ' || r.numero || '.',
          '/imoveis/' || r.tipo, r.imovel_id, null, 'semconta:' || r.unidade_id || ':' || v_mes);
      end loop;
    end if;
  exception when others then
    raise warning 'imoveis.avisar_pendencias (sem_conta): %', sqlerrm;
  end;

  -- 5. Conta em atraso (além da tolerância).
  begin
    for r in select c.id, c.referencia, c.vencimento, c.valor, u.tipo, u.numero, i.id as imovel_id, i.nome
             from imoveis.contas c join imoveis.unidades u on u.id = c.unidade_id join imoveis.imoveis i on i.id = u.imovel_id
             where c.pago_em is null and c.vencimento is not null and v_hoje - c.vencimento > p.dias_atraso
    loop
      v_total := v_total + hub.notificar(
        v_dest, 'imoveis', 'atraso',
        r.nome || ': conta de ' || case r.tipo when 'agua' then 'água' else 'luz' end || ' em atraso',
        to_char(r.referencia, 'MM/YYYY') || ' (R$ ' || to_char(r.valor, 'FM999G990D00') || ') venceu em ' || to_char(r.vencimento, 'DD/MM/YYYY') || '.',
        '/imoveis/vencimentos', r.imovel_id, null, 'atraso:' || r.id);
    end loop;
  exception when others then
    raise warning 'imoveis.avisar_pendencias (atraso): %', sqlerrm;
  end;

  -- 6. Consumo acima do padrão na conta mais recente de cada unidade de imóvel em uso.
  begin
    for r in
      select ult.unidade_id, ult.referencia, ult.consumo, u.tipo, u.numero, i.id as imovel_id, i.nome, m.media
      from (select distinct on (c.unidade_id) c.unidade_id, c.referencia, c.consumo
              from imoveis.contas c where c.referencia <= v_mes and c.consumo is not null
              order by c.unidade_id, c.referencia desc) ult
      join imoveis.unidades u on u.id = ult.unidade_id and u.ativa
      join imoveis.imoveis i on i.id = u.imovel_id and i.situacao = 'ativo'
      cross join lateral (
        select avg(x.consumo) as media, count(*) as n
          from (select c2.consumo from imoveis.contas c2
                 where c2.unidade_id = ult.unidade_id and c2.referencia < ult.referencia and c2.consumo > 0
                 order by c2.referencia desc limit p.meses_media) x
      ) m
      where m.n >= 3 and ult.consumo > m.media * (1 + p.pct_acima / 100)
    loop
      v_total := v_total + hub.notificar(
        v_dest, 'imoveis', 'consumo',
        r.nome || ': consumo de ' || case r.tipo when 'agua' then 'água' else 'luz' end || ' acima do padrão',
        to_char(r.referencia, 'MM/YYYY') || ': +' || round((r.consumo / r.media - 1) * 100) || '% sobre a média dos meses anteriores.',
        '/imoveis/imoveis/' || r.imovel_id || '?aba=contas', r.imovel_id, null, 'consumo:' || r.unidade_id || ':' || r.referencia);
    end loop;
  exception when others then
    raise warning 'imoveis.avisar_pendencias (consumo): %', sqlerrm;
  end;

  return v_total;
end
$$;

revoke execute on function imoveis.avisar_pendencias() from public, anon, authenticated;

-- Agendamento (pg_cron, 11h05 UTC = 8h05 em Brasília). Para desligar: select cron.unschedule('imoveis-avisar-pendencias');
-- select cron.schedule('imoveis-avisar-pendencias', '5 11 * * *', 'select imoveis.avisar_pendencias()');
