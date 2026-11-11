-- Portal público das emendas: publicação controlada por exercício e boletim por e-mail.
-- Só acrescenta. Nada aqui é exposto a anon/authenticated além do que já era:
-- o portal lê com a chave de serviço, no servidor, com lista fechada de colunas.

-- 1) Publicação: o portal só mostra um exercício depois que um gestor revisou os
--    alertas e publicou. A "ciência" guarda quantos alertas havia no momento (auditoria).
alter table emendas.exercicios
  add column if not exists portal_publicado_em timestamptz,
  add column if not exists portal_publicado_por uuid,
  add column if not exists portal_ciencia jsonb;

-- 2) Assinantes do boletim (LGPD: confirmação dupla, finalidade única, cancelamento a
--    qualquer momento). Sem política de RLS: só a service_role lê e grava.
create table if not exists emendas.portal_assinantes (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token uuid not null default gen_random_uuid() unique,
  vereador text check (vereador is null or length(vereador) <= 200),
  criado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  cancelado_em timestamptz,
  ultimo_envio_em timestamptz
);
create unique index if not exists portal_assinantes_email_uq on emendas.portal_assinantes (lower(email));
alter table emendas.portal_assinantes enable row level security;
revoke all on emendas.portal_assinantes from anon, authenticated;

-- 3) Fotografia do que o boletim já informou (para mandar só o que mudou).
create table if not exists emendas.portal_boletim_estado (
  ano int not null,
  numero int not null,
  etapa text not null,
  situacao text not null,
  valor numeric(14,2) not null,
  empenhado numeric(14,2) not null,
  pago numeric(14,2) not null,
  atualizado_em timestamptz not null default now(),
  primary key (ano, numero)
);
alter table emendas.portal_boletim_estado enable row level security;
revoke all on emendas.portal_boletim_estado from anon, authenticated;

-- 4) A chave de serviço (o portal e o boletim leem/gravam com ela) precisa do GRANT explícito:
--    as tabelas novas do schema `emendas` não herdam privilégio para service_role.
grant select, insert, update, delete on emendas.portal_assinantes to service_role;
grant select, insert, update, delete on emendas.portal_boletim_estado to service_role;
