-- Limite de tentativas por IP e rota (lib/seguranca/limite-requisicoes.ts). Aplicada por MCP em 28/10/2026.
-- `janela` = início da janela em segundos desde 1970. Só a service_role acessa (sem policies para anon/authenticated).
create table if not exists hub.limites_requisicao (
  chave text not null,
  janela bigint not null,
  contagem int not null default 0,
  primary key (chave, janela)
);
alter table hub.limites_requisicao enable row level security;
revoke all on hub.limites_requisicao from anon, authenticated;
grant select, insert, update, delete on hub.limites_requisicao to service_role;
