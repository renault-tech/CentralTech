-- Importação de planilha (Configurações do módulo → Importar). Tudo numa
-- transação só: ou a planilha inteira entra, ou nada entra — as regras de
-- cota, modalidade × etapa e empenhado/pago (triggers) valem aqui também.
-- Emenda com o mesmo (ano, número) já cadastrada é IGNORADA (reimportar a
-- mesma planilha não duplica nada).
--
-- p_emendas: [{numero, numero_vereador, vereador_numero, objeto, descricao,
--   valor, beneficiario, unidade_codigo, saude, funcional, natureza,
--   dotacao_texto, ficha, status_original, etapa ('paga'|'empenhada'|null),
--   empenho, data_pagamento, remanejamento: {antes, depois} | null}]

create or replace function emendas.importar(p_ano int, p_emendas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_e jsonb;
  v_vereador uuid;
  v_unidade uuid;
  v_benef uuid;
  v_id uuid;
  v_nome_benef text;
  v_natureza text;
  v_etapa text;
  v_valor numeric;
  v_nome_usuario text;
  v_criadas int := 0;
  v_ignoradas int := 0;
  v_rem int := 0;
  v_mov int := 0;
begin
  if not emendas.eh_gestor() then
    raise exception 'Só gestores podem importar planilhas.';
  end if;
  if not exists (select 1 from emendas.exercicios where ano = p_ano) then
    raise exception 'Exercício % não cadastrado. Cadastre o exercício (cota por vereador) antes de importar.', p_ano;
  end if;
  if jsonb_typeof(p_emendas) <> 'array' then
    raise exception 'Formato inválido.';
  end if;
  select nome into v_nome_usuario from hub.usuarios where id = (select auth.uid());

  for v_e in select * from jsonb_array_elements(p_emendas) loop
    if exists (select 1 from emendas.emendas where ano = p_ano and numero = (v_e ->> 'numero')::int) then
      v_ignoradas := v_ignoradas + 1;
      continue;
    end if;

    select id into v_vereador from emendas.vereadores where numero = (v_e ->> 'vereador_numero')::int;
    if v_vereador is null then
      raise exception 'Emenda %: vereador nº % não cadastrado.', v_e ->> 'numero', v_e ->> 'vereador_numero';
    end if;
    select id into v_unidade from emendas.unidades_orcamentarias where codigo = v_e ->> 'unidade_codigo';
    if v_unidade is null then
      raise exception 'Emenda %: unidade orçamentária % não cadastrada.', v_e ->> 'numero', v_e ->> 'unidade_codigo';
    end if;

    v_benef := null;
    v_nome_benef := nullif(trim(v_e ->> 'beneficiario'), '');
    if v_nome_benef is not null then
      select id into v_benef from emendas.beneficiarios where lower(nome) = lower(v_nome_benef);
      if v_benef is null then
        insert into emendas.beneficiarios (nome, tipo)
          values (v_nome_benef, case when v_nome_benef ilike 'secretaria%' then 'orgao_publico' else 'entidade' end)
          returning id into v_benef;
      end if;
    end if;

    v_natureza := nullif(v_e ->> 'natureza', '');
    v_valor := (v_e ->> 'valor')::numeric;
    insert into emendas.emendas (
      ano, numero, numero_vereador, vereador_id, objeto, descricao, valor, beneficiario_id, unidade_id, saude,
      funcional_programatica, natureza_despesa, dotacao_texto, ficha, modalidade
    ) values (
      p_ano, (v_e ->> 'numero')::int, (v_e ->> 'numero_vereador')::int, v_vereador,
      v_e ->> 'objeto', v_e ->> 'descricao', v_valor, v_benef, v_unidade,
      coalesce((v_e ->> 'saude')::boolean, false),
      nullif(v_e ->> 'funcional', ''), v_natureza, nullif(v_e ->> 'dotacao_texto', ''), nullif(v_e ->> 'ficha', ''),
      coalesce(emendas.modalidade_por_natureza(v_natureza), 'direta')
    ) returning id into v_id;
    v_criadas := v_criadas + 1;

    if jsonb_typeof(v_e -> 'remanejamento') = 'object' then
      insert into emendas.remanejamentos (emenda_id, data, ato, motivo, antes, depois)
        values (v_id, current_date, 'Planilha ' || p_ano || ' (versão após remanejamentos)',
                'Importado da planilha: diferença entre a versão original e a atual.',
                v_e -> 'remanejamento' -> 'antes', v_e -> 'remanejamento' -> 'depois');
      v_rem := v_rem + 1;
    end if;

    v_etapa := nullif(v_e ->> 'etapa', '');
    if v_etapa in ('empenhada', 'paga') then
      insert into emendas.movimentos_financeiros (emenda_id, tipo, numero, data, valor, observacao)
        values (v_id, 'empenho', nullif(v_e ->> 'empenho', ''), null, v_valor, 'Importado da planilha');
      v_mov := v_mov + 1;
      if v_etapa = 'paga' then
        insert into emendas.movimentos_financeiros (emenda_id, tipo, numero, data, valor, observacao)
          values (v_id, 'pagamento', null, nullif(v_e ->> 'data_pagamento', '')::date, v_valor, 'Importado da planilha');
        v_mov := v_mov + 1;
      end if;
      insert into emendas.andamentos (emenda_id, etapa, data, documento, observacao, usuario_nome)
        values (
          v_id, v_etapa,
          coalesce(nullif(v_e ->> 'data_pagamento', '')::date, current_date),
          case when nullif(v_e ->> 'empenho', '') is not null then 'EMP ' || (v_e ->> 'empenho') end,
          'Importado da planilha. Situação original: "' || coalesce(v_e ->> 'status_original', '') || '"',
          v_nome_usuario
        );
    end if;
  end loop;

  return jsonb_build_object('criadas', v_criadas, 'ignoradas', v_ignoradas, 'remanejamentos', v_rem, 'movimentos', v_mov);
end;
$function$;

revoke execute on function emendas.importar(int, jsonb) from public, anon;
grant execute on function emendas.importar(int, jsonb) to authenticated, service_role;
