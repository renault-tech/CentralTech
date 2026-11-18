-- Índices de cobertura para chaves estrangeiras apontadas pelo advisor de desempenho.
create index if not exists andamentos_etapa_idx on emendas.andamentos (etapa);
create index if not exists emendas_etapa_idx on emendas.emendas (etapa);
create index if not exists emenda_checklist_documento_idx on emendas.emenda_checklist (documento_id);
create index if not exists fluxo_etapas_chave_idx on emendas.fluxo_etapas (chave);
create index if not exists fluxo_fases_etapa_idx on emendas.fluxo_fases (etapa);
create index if not exists pareceres_secretaria_idx on emendas.pareceres_exequibilidade (secretaria_id);
create index if not exists propostas_emenda_idx on emendas.propostas (emenda_id);
create index if not exists propostas_importacao_idx on emendas.propostas (importacao_id);
create index if not exists unidades_orc_secretaria_idx on emendas.unidades_orcamentarias (secretaria_id);
create index if not exists emendas_usuarios_secretaria_idx on emendas.usuarios (secretaria_id);
create index if not exists vereadores_substitui_idx on emendas.vereadores (substitui_id);
create index if not exists man_fornecedor_idx on frotas.manutencoes (fornecedor_id);
create index if not exists nc_fornecedor_idx on frotas.notas_combustivel (fornecedor_id);
create index if not exists veiculos_locadora_idx on frotas.veiculos (locadora_id);
create index if not exists imoveis_imobiliaria_idx on imoveis.imoveis (imobiliaria_id);
create index if not exists imoveis_usuarios_secretaria_idx on imoveis.usuarios (secretaria_id);
