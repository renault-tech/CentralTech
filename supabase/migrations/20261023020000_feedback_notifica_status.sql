-- Quem manda feedback passa a ser avisado quando o status muda (em análise,
-- resolvido, não possível). Aditivo: só uma função e um gatilho em
-- hub.feedback; nenhuma coluna muda.
--  * Compras: grava em public.notificacoes (o sino do Compras e o da Central
--    já leem dali, ao vivo).
--  * Requerimentos / Emendas / Central: hub.notificar (sino de cada app).
--  * Numera: projeto Supabase à parte (outro auth.users) — o próprio app
--    consulta "Meus envios" e avisa na abertura; aqui não há o que fazer.
-- Nunca avisa quem mudou o status (p_autor) e nunca derruba a mudança de
-- status se o aviso falhar.
create or replace function hub.notificar_feedback_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_titulo text;
  v_msg text;
begin
  if new.status is not distinct from old.status or new.status = 'novo' then
    return null;
  end if;
  if new.app = 'numera' or new.usuario_id is not distinct from (select auth.uid()) then
    return null;
  end if;

  v_titulo := case new.status
    when 'lido' then 'Seu feedback está em análise'
    when 'resolvido' then 'Seu feedback foi resolvido'
    when 'nao_possivel' then 'Seu feedback não pôde ser atendido'
  end;
  v_msg := '“' || left(regexp_replace(new.mensagem, '\s+', ' ', 'g'), 120) || '”';

  if new.app = 'compras'
     and exists (select 1 from public.usuarios u where u.id = new.usuario_id) then
    insert into public.notificacoes (destinatario_id, tipo, mensagem)
    values (new.usuario_id, 'feedback_status', v_titulo || ': ' || v_msg);
  else
    perform hub.notificar(
      array[new.usuario_id], new.app, 'feedback_status', v_titulo, v_msg,
      case when new.app in ('hub', 'emendas') then '/feedback?aba=meus' else null end,
      new.id, (select auth.uid()), 'feedback:' || new.id || ':' || new.status);
  end if;
  return null;
exception when others then
  raise warning '[hub.notificar_feedback_status] %', sqlerrm;
  return null;
end;
$fn$;

revoke execute on function hub.notificar_feedback_status() from public, anon, authenticated;

drop trigger if exists trg_feedback_notifica_status on hub.feedback;
create trigger trg_feedback_notifica_status
  after update of status on hub.feedback
  for each row execute function hub.notificar_feedback_status();
