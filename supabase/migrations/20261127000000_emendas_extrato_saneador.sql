-- Extrato saneador: publicação que regulariza o termo cujo extrato saiu DEPOIS do repasse (Lei 13.019/2014, art. 38).
-- Decisão do Controle Interno (22/11/2026): a saída é publicar um extrato saneador. Só acrescenta (nada é apagado):
--  1) a data de publicação do extrato saneador na execução da emenda (baixa a pendência "pagamento antes do extrato");
--  2) o tipo de documento 'extrato_saneador' no Drive (o PDF da publicação, mesma regra de tarja e pasta PUBLICIDADE).
alter table emendas.execucao add column if not exists data_extrato_saneador date;

alter table emendas.documentos_drive drop constraint documentos_drive_tipo_check,
  add constraint documentos_drive_tipo_check check (tipo = any (array['termo','plano_trabalho','extrato','extrato_saneador','anuencia_sus','relatorio_gestao','jornal_edicao','convenio','nota_fiscal','prestacao_contas']));
