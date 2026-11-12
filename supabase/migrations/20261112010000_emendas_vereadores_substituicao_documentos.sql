-- Substituição de vereador e documentos obrigatórios (aplicada por MCP em 12/11/2026).
alter table emendas.vereadores
  add column if not exists substitui_id uuid references emendas.vereadores(id),
  add column if not exists inicio_exercicio date,
  add column if not exists fim_exercicio date,
  add column if not exists motivo_saida text;
alter table emendas.vereadores add constraint vereadores_partido_obrigatorio
  check (ativo = false or nullif(btrim(partido), '') is not null);
alter table emendas.beneficiarios add column if not exists cpf text;
alter table emendas.beneficiarios drop constraint beneficiarios_tipo_check;
alter table emendas.beneficiarios add constraint beneficiarios_tipo_check check (tipo in ('entidade','orgao_publico','pessoa_fisica'));
-- NOT VALID: as 97 linhas atuais ainda não têm CNPJ; passam a ser exigidas ao serem editadas.
alter table emendas.beneficiarios add constraint beneficiarios_documento_obrigatorio
  check ((tipo = 'pessoa_fisica' and cpf ~ '^\d{3}\.\d{3}\.\d{3}-\d{2}$') or (tipo <> 'pessoa_fisica' and cnpj is not null)) not valid;
