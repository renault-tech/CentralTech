-- Aviso da leitura automática do PDF ao ligar um documento (imagem sem texto, nº ou data que não bate com o cadastro).
-- Já aplicada em produção por MCP.
alter table emendas.documentos_drive add column if not exists leitura_aviso text;
