-- Cadastro unificado pelo Hub (parte 1): tabela de solicitações de acesso.
-- Hoje só o admin_hub cria contas manualmente em Configurações; quem ainda
-- não tem login em nenhum módulo não tem como pedir acesso. Esta tabela é a
-- porta de entrada pública: qualquer pessoa (com ou sem conta) preenche
-- nome/e-mail/módulos desejados, e o admin_hub decide o resto em
-- Configurações → Solicitações (aprovação por módulo, orquestrada por
-- server actions — ver `aprovarSolicitacao`).

create table if not exists hub.solicitacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  modulos_solicitados text[] not null,
  secretaria_sugerida text,
  justificativa text,
  status text not null default 'pendente' check (status = any (array['pendente', 'aprovada', 'recusada'])),
  decidido_por uuid references auth.users(id),
  decidido_em timestamptz,
  observacao_decisao text,
  criado_em timestamptz not null default now()
);

alter table hub.solicitacoes_acesso enable row level security;

-- Só o admin_hub lê/decide; a inserção é o único ponto aberto ao público
-- (com ou sem sessão) — é o único jeito de alguém sem conta nenhuma
-- conseguir pedir acesso, e por isso o `with check` trava o status inicial.
drop policy if exists admin_le_e_decide_solicitacoes on hub.solicitacoes_acesso;
create policy admin_le_e_decide_solicitacoes on hub.solicitacoes_acesso
  for select using (hub.eh_admin_hub());

drop policy if exists admin_atualiza_solicitacoes on hub.solicitacoes_acesso;
create policy admin_atualiza_solicitacoes on hub.solicitacoes_acesso
  for update using (hub.eh_admin_hub()) with check (hub.eh_admin_hub());

drop policy if exists qualquer_um_solicita_acesso on hub.solicitacoes_acesso;
create policy qualquer_um_solicita_acesso on hub.solicitacoes_acesso
  for insert with check (status = 'pendente');

-- `anon` nunca teve `usage` no schema `hub` (só authenticated/service_role,
-- baseline original) — sem isso, qualquer grant de tabela abaixo é letra
-- morta (42501 "permission denied for schema hub"), confirmado testando.
grant usage on schema hub to anon;

-- `eh_admin_hub()` nunca teve EXECUTE para `anon` (só authenticated) — e
-- mesmo um `insert ... returning` de `anon` nesta tabela aciona a policy de
-- SELECT (que chama `eh_admin_hub()`) para validar a linha retornada,
-- estourando "permission denied for function eh_admin_hub" mesmo a policy
-- de INSERT não citando a função. Confirmado testando. Sem risco em
-- liberar: para `anon`, `auth.uid()` é sempre nulo, então a função sempre
-- resolve `false`.
grant execute on function hub.eh_admin_hub() to anon;

-- Tabela nova: grant explícito, schema `hub` não herda nada de `public` e
-- `anon` precisa poder inserir (lição já repetida várias vezes nesta base —
-- conferir com has_table_privilege depois de aplicar).
grant select, insert, update on hub.solicitacoes_acesso to anon, authenticated, service_role;

create or replace function hub.rejeitar_solicitacao(p_id uuid, p_observacao text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not hub.eh_admin_hub() then
    raise exception 'Sem permissão para decidir solicitações de acesso';
  end if;

  update hub.solicitacoes_acesso
     set status = 'recusada',
         decidido_por = (select auth.uid()),
         decidido_em = now(),
         observacao_decisao = p_observacao
   where id = p_id and status = 'pendente';

  if not found then
    raise exception 'Solicitação não encontrada ou já decidida';
  end if;
end;
$function$;

revoke execute on function hub.rejeitar_solicitacao(uuid, text) from public;
grant execute on function hub.rejeitar_solicitacao(uuid, text) to authenticated, service_role;
