-- Novo tipo de documento ligado no Drive: atesto de recebimento (comprova, junto da nota fiscal, o cumprimento da execução direta).
alter table emendas.documentos_drive
  drop constraint documentos_drive_tipo_check,
  add constraint documentos_drive_tipo_check check (tipo = any (array['termo','plano_trabalho','extrato','anuencia_sus','relatorio_gestao','jornal_edicao','convenio','nota_fiscal','atesto','prestacao_contas']));
