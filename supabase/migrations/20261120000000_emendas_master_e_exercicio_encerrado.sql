-- Gestor master (20/11/2026): quem decide encerramento de emendas, abertura/fechamento de exercício e importação de planilhas.
-- Só o administrador da Central designa. Enquanto NÃO houver nenhum master, gestores e administradores seguem decidindo
-- (a regra única está em src/lib/emendas/master.ts), para ninguém ficar sem acesso na transição.
create table if not exists emendas.masters (
  usuario_id uuid primary key,
  designado_por uuid default auth.uid(),
  designado_em timestamptz not null default now()
);
alter table emendas.masters enable row level security;
create policy le_masters on emendas.masters for select to authenticated using (true);
create policy admin_insere_masters on emendas.masters for insert to authenticated with check (hub.eh_admin_hub());
create policy admin_apaga_masters on emendas.masters for delete to authenticated using (hub.eh_admin_hub());
grant select, insert, delete on emendas.masters to authenticated;
grant all on emendas.masters to service_role;
create trigger auditoria after insert or delete on emendas.masters for each row execute function emendas.registrar_auditoria();

-- Exercício encerrado: só entram pagamentos (e anulações) de emendas inscritas em restos a pagar. Qualquer outro lançamento
-- financeiro exige reabrir o exercício em Configurações › Exercício.
create or replace function emendas.bloquear_movimento_exercicio_encerrado()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_emenda uuid := coalesce(new.emenda_id, old.emenda_id);
  v_tipo text := coalesce(new.tipo, old.tipo);
  v_situacao text;
  v_restos boolean;
begin
  select x.situacao into v_situacao
    from emendas.emendas e join emendas.exercicios x on x.ano = e.ano
   where e.id = v_emenda;
  if v_situacao = 'encerrado' then
    select exists (select 1 from emendas.encerramentos where id = v_emenda and situacao = 'restos_a_pagar') into v_restos;
    if not (v_restos and v_tipo in ('pagamento', 'anulacao')) then
      raise exception 'O exercício está encerrado: só se lançam pagamentos de restos a pagar. Reabra o exercício em Configurações > Exercício para outros lançamentos.'
        using errcode = 'check_violation';
    end if;
  end if;
  return coalesce(new, old);
end;
$function$;
revoke all on function emendas.bloquear_movimento_exercicio_encerrado() from public, anon, authenticated;

create trigger a_bloquear_exercicio_encerrado before insert or update or delete on emendas.movimentos_financeiros
  for each row execute function emendas.bloquear_movimento_exercicio_encerrado();
