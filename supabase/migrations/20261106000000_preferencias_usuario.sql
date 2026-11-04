-- Preferências de aparência por pessoa (valem em Hub, Compras e Requerimentos, mesmo projeto Supabase).
create table if not exists hub.preferencias_usuario (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  tema text not null default 'auto' check (tema in ('auto','claro','escuro')),
  estilo text not null default 'apple' check (estilo in ('apple','classico')),
  detalhe_processo text not null default 'folha' check (detalhe_processo in ('folha','linha')),
  atualizado_em timestamptz not null default now()
);
alter table hub.preferencias_usuario enable row level security;
create policy le_propria_preferencia on hub.preferencias_usuario for select to authenticated
  using (usuario_id = (select auth.uid()));
revoke all on hub.preferencias_usuario from public, anon;
grant select on hub.preferencias_usuario to authenticated;
grant all on hub.preferencias_usuario to service_role;

create or replace function hub.salvar_preferencias(p_tema text, p_estilo text, p_detalhe text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sem sessão'; end if;
  insert into hub.preferencias_usuario (usuario_id, tema, estilo, detalhe_processo)
  values (v_uid, coalesce(p_tema,'auto'), coalesce(p_estilo,'apple'), coalesce(p_detalhe,'folha'))
  on conflict (usuario_id) do update
    set tema = excluded.tema, estilo = excluded.estilo,
        detalhe_processo = excluded.detalhe_processo, atualizado_em = now();
end $$;
revoke execute on function hub.salvar_preferencias(text,text,text) from public, anon;
grant execute on function hub.salvar_preferencias(text,text,text) to authenticated, service_role;
