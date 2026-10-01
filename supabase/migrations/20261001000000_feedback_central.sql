-- Feedback centralizado no Hub: todo app (Compras, Requerimentos, Numera,
-- Hub e os próximos) grava em UMA tabela, sinalizando o app de origem.
-- Aditivo: a tabela antiga public.feedback_usuarios (Compras) permanece
-- intacta; os 7 registros existentes são COPIADOS para cá.

-- Catálogo de apps. Novo app = uma linha aqui (+ uma entrada em
-- MODULOS no Hub); a cor identifica o app em toda a gestão de feedback.
create table hub.apps_feedback (
  slug text primary key,
  nome text not null,
  cor text not null,
  cor_texto text not null,
  ordem int not null default 0,
  ativo boolean not null default true
);

insert into hub.apps_feedback (slug, nome, cor, cor_texto, ordem) values
  ('compras', 'Compras', '#0C1D33', '#0C1D33', 1),
  ('requerimentos', 'Requerimentos', '#C63B22', '#C63B22', 2),
  ('numera', 'Numera', '#0071e3', '#0058B0', 3),
  ('hub', 'Central Cataguases', '#E9A63B', '#8A5E00', 4);

alter table hub.apps_feedback enable row level security;
create policy le_apps_feedback on hub.apps_feedback for select to authenticated, anon using (true);

create table hub.feedback (
  id uuid primary key default gen_random_uuid(),
  app text not null references hub.apps_feedback(slug),
  -- Sem FK: o Numera tem outro projeto/auth.users.
  usuario_id uuid not null,
  autor_nome text not null,
  autor_email text,
  tipo text not null default 'sugestao' check (tipo in ('suporte', 'sugestao')),
  mensagem text not null,
  pagina text,
  anexos text[] not null default '{}',
  status text not null default 'novo' check (status in ('novo', 'lido', 'resolvido', 'nao_possivel')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz
);
create index idx_hub_feedback_app on hub.feedback(app);
create index idx_hub_feedback_usuario on hub.feedback(usuario_id);
create index idx_hub_feedback_status on hub.feedback(status);

-- Quem gerencia: admin do Hub OU admin/diretor do Compras (mesma regra
-- que já valia para ver feedback lá).
create or replace function hub.pode_gerir_feedback()
returns boolean language sql stable security definer set search_path = '' as $$
  select hub.eh_admin_hub()
    or exists (
      select 1 from public.usuarios u
      where u.id = (select auth.uid()) and u.ativo and u.perfil in ('admin', 'diretor')
    );
$$;
revoke execute on function hub.pode_gerir_feedback() from public, anon;
grant execute on function hub.pode_gerir_feedback() to authenticated, service_role;

alter table hub.feedback enable row level security;
create policy le_feedback on hub.feedback for select to authenticated
  using (usuario_id = (select auth.uid()) or hub.pode_gerir_feedback());
create policy gerencia_feedback on hub.feedback for update to authenticated
  using (hub.pode_gerir_feedback()) with check (hub.pode_gerir_feedback());
-- Sem policy de insert/delete: gravação só pela RPC abaixo.
grant select, update on hub.feedback to authenticated;
grant select on hub.apps_feedback to authenticated, anon;
grant all on hub.feedback, hub.apps_feedback to service_role;

create or replace function hub.enviar_feedback(
  p_app text, p_tipo text, p_mensagem text, p_pagina text, p_anexos text[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_nome text; v_email text; v_id uuid;
begin
  if v_uid is null then raise exception 'Não autenticado.'; end if;
  if not exists (select 1 from hub.apps_feedback where slug = p_app and ativo) then
    raise exception 'Aplicativo inválido.';
  end if;
  if p_tipo not in ('suporte', 'sugestao') then raise exception 'Tipo inválido.'; end if;
  if length(trim(coalesce(p_mensagem, ''))) < 5 then raise exception 'Escreva um pouco mais.'; end if;
  if length(p_mensagem) > 4000 then raise exception 'Mensagem longa demais.'; end if;
  if coalesce(array_length(p_anexos, 1), 0) > 5 then raise exception 'Máximo de 5 anexos.'; end if;

  select au.email into v_email from auth.users au where au.id = v_uid;
  select coalesce(
    (select h.nome from hub.usuarios h where h.id = v_uid),
    (select u.nome from public.usuarios u where u.id = v_uid),
    v_email, 'Usuário') into v_nome;

  insert into hub.feedback (app, usuario_id, autor_nome, autor_email, tipo, mensagem, pagina, anexos)
  values (p_app, v_uid, v_nome, v_email, p_tipo, trim(p_mensagem), nullif(trim(coalesce(p_pagina, '')), ''), coalesce(p_anexos, '{}'))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function hub.enviar_feedback(text, text, text, text, text[]) from public, anon;
grant execute on function hub.enviar_feedback(text, text, text, text, text[]) to authenticated, service_role;

-- Cópia dos feedbacks que já existiam no Compras (mesmo id e data; os
-- anexos continuam no mesmo bucket, mesmos caminhos).
insert into hub.feedback (id, app, usuario_id, autor_nome, autor_email, tipo, mensagem, pagina, anexos, status, criado_em, atualizado_em)
select f.id, 'compras', f.usuario_id, coalesce(u.nome, 'Usuário'), u.email,
  case f.tipo when 'problema' then 'suporte' when 'dica' then 'sugestao' else f.tipo end,
  f.mensagem, f.pagina, f.anexos, f.status, f.criado_em, f.atualizado_em
from public.feedback_usuarios f left join public.usuarios u on u.id = f.usuario_id
on conflict (id) do nothing;

-- Anexos: gestão central passa a ler o bucket (antes só admin/diretor do Compras).
drop policy feedback_anexos_le on storage.objects;
create policy feedback_anexos_le on storage.objects for select to authenticated
  using (bucket_id = 'feedback-anexos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or hub.pode_gerir_feedback()));
