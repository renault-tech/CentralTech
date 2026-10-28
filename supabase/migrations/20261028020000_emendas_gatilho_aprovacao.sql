-- Emendas: garante NO BANCO a regra "quem não é gestor/admin não troca dado já preenchido".
-- Hoje a regra vive só nas server actions (actions.ts); este gatilho vale também contra chamadas
-- diretas à API. RODAR NO SQL EDITOR do Supabase (o MCP trava em create function).
-- Reexecutável. Não afeta: gestor/admin do Hub, service_role e SQL Editor (auth.uid() nulo), nem o
-- preenchimento de campo vazio (esse continua direto; a troca vira proposta pelo app).

create or replace function emendas.bloquear_troca_dado_preenchido()
returns trigger
language plpgsql
set search_path = emendas, public
as $$
declare
  k text;
  antigo jsonb;
  novo jsonb;
begin
  -- Sem usuário logado (service_role, SQL Editor, rotinas) ou gestor/admin: livre.
  if auth.uid() is null or emendas.eh_gestor() then
    return new;
  end if;

  if tg_table_name = 'execucao' then
    antigo := to_jsonb(old);
    novo := to_jsonb(new);
    for k in select jsonb_object_keys(antigo) loop
      continue when k in ('id', 'atualizado_em', 'atualizado_por');
      if antigo -> k is not null
         and antigo -> k <> 'null'::jsonb
         and antigo ->> k <> ''
         and (novo -> k) is distinct from (antigo -> k) then
        raise exception 'A alteração de "%" em dado já preenchido precisa da aprovação do gestor (envie como proposta).', k
          using errcode = '42501';
      end if;
    end loop;

  elsif tg_table_name = 'emenda_fases' then
    if old.situacao <> 'pendente'
       and (new.situacao, new.data, new.documento, new.observacao)
           is distinct from (old.situacao, old.data, old.documento, old.observacao) then
      raise exception 'A alteração de uma fase já preenchida precisa da aprovação do gestor (envie como proposta).'
        using errcode = '42501';
    end if;

  elsif tg_table_name = 'emenda_checklist' then
    if old.estado <> 'pendente' and new.estado is distinct from old.estado then
      raise exception 'A alteração de um documento já conferido precisa da aprovação do gestor (envie como proposta).'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function emendas.bloquear_troca_dado_preenchido() from public, anon, authenticated;

drop trigger if exists zz_bloqueia_troca_execucao on emendas.execucao;
create trigger zz_bloqueia_troca_execucao before update on emendas.execucao
  for each row execute function emendas.bloquear_troca_dado_preenchido();

drop trigger if exists zz_bloqueia_troca_fases on emendas.emenda_fases;
create trigger zz_bloqueia_troca_fases before update on emendas.emenda_fases
  for each row execute function emendas.bloquear_troca_dado_preenchido();

drop trigger if exists zz_bloqueia_troca_checklist on emendas.emenda_checklist;
create trigger zz_bloqueia_troca_checklist before update on emendas.emenda_checklist
  for each row execute function emendas.bloquear_troca_dado_preenchido();

-- TESTE (opcional, depois de criar; tudo desfeito no fim). Troque o uuid por o de um usuário NÃO gestor
-- que edite alguma secretaria, e o id por uma emenda dessa secretaria que já tenha termo preenchido:
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<UUID_DO_USUARIO_NAO_GESTOR>","role":"authenticated"}', true);
--   update emendas.execucao set numero_termo = 'TESTE' where id = '<ID_DA_EMENDA_COM_TERMO>';  -- deve ERRAR 42501
--   rollback;
