-- Retorno ao usuário: além do status, a gestão escreve uma resposta ("como
-- está agora") que o autor lê em "Meus envios" e recebe no sino.
-- Aditivo: colunas nulas por padrão; a RLS de update (gerencia_feedback) já
-- cobre as novas colunas.
alter table hub.feedback
  add column if not exists resposta text,
  add column if not exists respondido_em timestamptz,
  add column if not exists respondido_por text;

create or replace function hub.notificar_feedback_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_titulo text;
  v_msg text;
  v_status_mudou boolean := new.status is distinct from old.status and new.status <> 'novo';
  v_resposta_mudou boolean := new.resposta is distinct from old.resposta
                              and length(trim(coalesce(new.resposta, ''))) > 0;
begin
  if not (v_status_mudou or v_resposta_mudou) then
    return null;
  end if;
  if new.app = 'numera' or new.usuario_id is not distinct from (select auth.uid()) then
    return null;
  end if;

  v_titulo := case
    when v_status_mudou and new.status = 'lido' then 'Seu feedback está em análise'
    when v_status_mudou and new.status = 'resolvido' then 'Seu feedback foi resolvido'
    when v_status_mudou and new.status = 'nao_possivel' then 'Seu feedback não pôde ser atendido'
    else 'Resposta ao seu feedback'
  end;
  v_msg := '“' || left(regexp_replace(new.mensagem, '\s+', ' ', 'g'), 100) || '”';
  if length(trim(coalesce(new.resposta, ''))) > 0 then
    v_msg := v_msg || E'\nResposta: ' || left(regexp_replace(new.resposta, '\s+', ' ', 'g'), 220);
  end if;

  if new.app = 'compras'
     and exists (select 1 from public.usuarios u where u.id = new.usuario_id) then
    insert into public.notificacoes (destinatario_id, tipo, mensagem)
    values (new.usuario_id, 'feedback_status', v_titulo || ': ' || v_msg);
  else
    perform hub.notificar(
      array[new.usuario_id], new.app, 'feedback_status', v_titulo, v_msg,
      case when new.app in ('hub', 'emendas') then '/feedback?aba=meus' else null end,
      new.id, (select auth.uid()),
      'feedback:' || new.id || ':' || new.status || ':' || md5(coalesce(new.resposta, '')));
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
  after update of status, resposta on hub.feedback
  for each row execute function hub.notificar_feedback_status();
