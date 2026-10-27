-- Emendas: tipo de execução (direta/osc/ente), fases por tipo, checklist documental,
-- datas do exercício (LOA/exequibilidade) e parecer de exequibilidade por secretaria.
-- Só acrescenta; reexecutável. Fases ligadas a dado existente (empenho, pagamento,
-- termo, extrato, LOA, parecer) são DERIVADAS no app e nunca gravadas em emenda_fases.

alter table emendas.emendas add column if not exists tipo_execucao text;
do $$ begin
  alter table emendas.emendas add constraint emendas_tipo_execucao_ck check (tipo_execucao in ('direta','osc','ente'));
exception when duplicate_object then null; end $$;
create index if not exists emendas_ano_tipo_idx on emendas.emendas (ano, tipo_execucao);

alter table emendas.exercicios
  add column if not exists data_aprovacao_loa date,
  add column if not exists numero_lei_loa text,
  add column if not exists prazo_exequibilidade date;

create table if not exists emendas.fluxo_fases (
  tipo text not null check (tipo in ('direta','osc','ente')),
  chave text not null,
  nome text not null,
  etapa text not null references emendas.etapas(chave),
  referencia text,
  derivacao text check (derivacao in ('loa','parecer','empenho','liquidacao','pagamento','termo','extrato')),
  ordem int not null,
  ativa boolean not null default true,
  primary key (tipo, chave)
);

create table if not exists emendas.emenda_fases (
  emenda_id uuid not null references emendas.emendas(id) on delete cascade,
  chave text not null,
  situacao text not null default 'pendente' check (situacao in ('pendente','em_andamento','concluida','nao_se_aplica')),
  data date,
  documento text,
  observacao text,
  origem text,
  atualizado_por uuid,
  atualizado_em timestamptz not null default now(),
  primary key (emenda_id, chave)
);

create table if not exists emendas.checklist_itens (
  tipo text not null check (tipo in ('direta','osc','ente')),
  chave text not null,
  nome text not null,
  referencia_legal text,
  condicao text check (condicao in ('saude','consorcio')),
  ordem int not null,
  ativo boolean not null default true,
  primary key (tipo, chave)
);

create table if not exists emendas.emenda_checklist (
  emenda_id uuid not null references emendas.emendas(id) on delete cascade,
  item_chave text not null,
  estado text not null default 'pendente' check (estado in ('conferido','presumido','pendente','nao_se_aplica')),
  documento_id uuid references emendas.documentos(id) on delete set null,
  observacao text,
  conferido_por uuid,
  conferido_em timestamptz,
  primary key (emenda_id, item_chave)
);

create table if not exists emendas.pareceres_exequibilidade (
  ano int not null references emendas.exercicios(ano),
  secretaria_id uuid not null references emendas.secretarias(id),
  data date not null,
  protocolo text,
  observacao text,
  atualizado_por uuid,
  atualizado_em timestamptz not null default now(),
  primary key (ano, secretaria_id)
);

alter table emendas.impedimentos add column if not exists parecer_ano int, add column if not exists parecer_secretaria_id uuid;

create table if not exists emendas.pendencias_justificadas (
  emenda_id uuid not null references emendas.emendas(id) on delete cascade,
  regra text not null,
  assinatura text not null,
  justificativa text not null,
  por uuid,
  em timestamptz not null default now(),
  primary key (emenda_id, regra)
);

-- RLS
alter table emendas.fluxo_fases enable row level security;
alter table emendas.emenda_fases enable row level security;
alter table emendas.checklist_itens enable row level security;
alter table emendas.emenda_checklist enable row level security;
alter table emendas.pareceres_exequibilidade enable row level security;
alter table emendas.pendencias_justificadas enable row level security;

do $$ begin
  -- catálogos: todos com perfil leem, gestor escreve
  create policy le_fluxo_fases on emendas.fluxo_fases for select using (emendas.meu_perfil() is not null);
  create policy gestor_insere_fluxo_fases on emendas.fluxo_fases for insert with check (emendas.eh_gestor());
  create policy gestor_altera_fluxo_fases on emendas.fluxo_fases for update using (emendas.eh_gestor()) with check (emendas.eh_gestor());
  create policy gestor_apaga_fluxo_fases on emendas.fluxo_fases for delete using (emendas.eh_gestor());
  create policy le_checklist_itens on emendas.checklist_itens for select using (emendas.meu_perfil() is not null);
  create policy gestor_insere_checklist_itens on emendas.checklist_itens for insert with check (emendas.eh_gestor());
  create policy gestor_altera_checklist_itens on emendas.checklist_itens for update using (emendas.eh_gestor()) with check (emendas.eh_gestor());
  create policy gestor_apaga_checklist_itens on emendas.checklist_itens for delete using (emendas.eh_gestor());
  -- por emenda: mesmas regras de execucao
  create policy le_emenda_fases on emendas.emenda_fases for select using (emendas.pode_ver_emenda(emenda_id));
  create policy insere_emenda_fases on emendas.emenda_fases for insert with check (emendas.pode_editar_emenda(emenda_id));
  create policy altera_emenda_fases on emendas.emenda_fases for update using (emendas.pode_editar_emenda(emenda_id)) with check (emendas.pode_editar_emenda(emenda_id));
  create policy gestor_apaga_emenda_fases on emendas.emenda_fases for delete using (emendas.eh_gestor());
  create policy le_emenda_checklist on emendas.emenda_checklist for select using (emendas.pode_ver_emenda(emenda_id));
  create policy insere_emenda_checklist on emendas.emenda_checklist for insert with check (emendas.pode_editar_emenda(emenda_id));
  create policy altera_emenda_checklist on emendas.emenda_checklist for update using (emendas.pode_editar_emenda(emenda_id)) with check (emendas.pode_editar_emenda(emenda_id));
  create policy gestor_apaga_emenda_checklist on emendas.emenda_checklist for delete using (emendas.eh_gestor());
  create policy le_justificativas on emendas.pendencias_justificadas for select using (emendas.pode_ver_emenda(emenda_id));
  create policy insere_justificativas on emendas.pendencias_justificadas for insert with check (emendas.pode_editar_emenda(emenda_id));
  create policy altera_justificativas on emendas.pendencias_justificadas for update using (emendas.pode_editar_emenda(emenda_id)) with check (emendas.pode_editar_emenda(emenda_id));
  create policy gestor_apaga_justificativas on emendas.pendencias_justificadas for delete using (emendas.eh_gestor());
  -- parecer: lê quem tem perfil; gestor escreve
  create policy le_pareceres on emendas.pareceres_exequibilidade for select using (emendas.meu_perfil() is not null);
  create policy gestor_insere_pareceres on emendas.pareceres_exequibilidade for insert with check (emendas.eh_gestor());
  create policy gestor_altera_pareceres on emendas.pareceres_exequibilidade for update using (emendas.eh_gestor()) with check (emendas.eh_gestor());
  create policy gestor_apaga_pareceres on emendas.pareceres_exequibilidade for delete using (emendas.eh_gestor());
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on emendas.fluxo_fases, emendas.emenda_fases, emendas.checklist_itens,
  emendas.emenda_checklist, emendas.pareceres_exequibilidade, emendas.pendencias_justificadas to authenticated;
revoke all on emendas.fluxo_fases, emendas.emenda_fases, emendas.checklist_itens,
  emendas.emenda_checklist, emendas.pareceres_exequibilidade, emendas.pendencias_justificadas from anon;

insert into emendas.fluxo_fases(tipo,chave,nome,etapa,referencia,derivacao,ordem) values
('direta','indicada','Indicada na LOA','indicada','LOA','loa',10),
('direta','analise','Análise técnica e de impedimento','analise','CF, art. 166, §§ 13-14 (simetria)','parecer',20),
('direta','demanda','DFD, ETP e termo de referência','processo_compra','Lei 14.133, arts. 12, VII; 18; 40',null,30),
('direta','precos','Pesquisa de preços','processo_compra','Lei 14.133, art. 23',null,40),
('direta','contratacao','Processo de contratação','processo_compra','Lei 14.133, arts. 28, 74, 75, 86',null,50),
('direta','instrumento','Contrato, ata ou autorização de fornecimento','processo_compra','Lei 14.133, art. 95',null,60),
('direta','empenho','Empenho','empenhada','Lei 4.320, art. 58','empenho',70),
('direta','recebimento','Recebimento e liquidação','liquidada','Lei 14.133, art. 140; Lei 4.320, art. 63','liquidacao',80),
('direta','pagamento','Pagamento','paga','Lei 4.320, art. 64; Lei 14.133, art. 141','pagamento',90),
('direta','conclusao','Encerramento','concluida','Processo arquivado',null,100),
('osc','indicada','Indicada na LOA','indicada','LOA','loa',10),
('osc','analise','Análise técnica e de impedimento','analise','CF, art. 166, §§ 13-14 (simetria)','parecer',20),
('osc','documentacao','Documentação da OSC','plano_trabalho','Lei 13.019, arts. 33, 34 e 39',null,30),
('osc','plano','Plano de trabalho aprovado','plano_trabalho','Lei 13.019, art. 22',null,40),
('osc','pareceres','Pareceres técnico e jurídico','plano_trabalho','Lei 13.019, art. 35, V e VI',null,50),
('osc','termo','Termo assinado','plano_trabalho','Lei 13.019, arts. 29 e 42','termo',60),
('osc','extrato','Publicação do extrato','plano_trabalho','Lei 13.019, art. 38','extrato',70),
('osc','empenho','Empenho','empenhada','Lei 4.320, art. 58','empenho',80),
('osc','liquidacao','Liquidação e envio ao financeiro','liquidada','Lei 4.320, art. 63','liquidacao',90),
('osc','repasse','Repasse à conta específica','paga','Lei 13.019, arts. 48 e 51','pagamento',100),
('osc','execucao','Execução e monitoramento','paga','Lei 13.019, arts. 58-62',null,110),
('osc','prestacao','Prestação de contas','prestacao_contas','Lei 13.019, arts. 63-72',null,120),
('osc','conclusao','Encerramento','concluida','Processo arquivado',null,130),
('ente','indicada','Indicada na LOA','indicada','LOA','loa',10),
('ente','analise','Análise técnica e de impedimento','analise','CF, art. 166, §§ 13-14 (simetria)','parecer',20),
('ente','documentacao','Habilitação da instituição','plano_trabalho','Certidões, CNES, instrumento SUS',null,30),
('ente','plano','Plano de trabalho ou de aplicação','plano_trabalho','Lei 13.019, art. 22 / Lei 11.107',null,40),
('ente','pareceres','Pareceres e aprovações','plano_trabalho','Parecer jurídico; CMS quando Saúde',null,50),
('ente','termo','Instrumento assinado','plano_trabalho','Termo, convênio, aditivo ou contrato de rateio','termo',60),
('ente','extrato','Publicação do extrato','plano_trabalho','Publicidade do instrumento','extrato',70),
('ente','empenho','Empenho','empenhada','Lei 4.320, art. 58','empenho',80),
('ente','liquidacao','Liquidação e envio ao financeiro','liquidada','Lei 4.320, art. 63','liquidacao',90),
('ente','repasse','Repasse','paga','Lei 4.320, art. 64','pagamento',100),
('ente','execucao','Execução e monitoramento','paga','Plano de trabalho',null,110),
('ente','prestacao','Prestação de contas','prestacao_contas','Instrumento / TCE-MG',null,120),
('ente','conclusao','Encerramento','concluida','Processo arquivado',null,130)
on conflict (tipo,chave) do nothing;
insert into emendas.checklist_itens(tipo,chave,nome,referencia_legal,condicao,ordem) values
('direta','dfd','Documento de formalização da demanda (DFD)','Lei 14.133, art. 12, VII',null,10),
('direta','etp','Estudo técnico preliminar ou justificativa de dispensa','Lei 14.133, art. 18, I e § 3º',null,20),
('direta','tr','Termo de referência ou projeto básico','Lei 14.133, arts. 6º, XXIII e 40',null,30),
('direta','precos','Pesquisa de preços e orçamento estimado','Lei 14.133, art. 23',null,40),
('direta','dotacao','Indicação da dotação e da ficha da emenda','Lei 14.133, art. 72, IV; art. 150',null,50),
('direta','juridico','Parecer jurídico','Lei 14.133, art. 53',null,60),
('direta','autorizacao','Autorização da autoridade competente','Lei 14.133, art. 72, VIII',null,70),
('direta','pncp','Divulgação no PNCP','Lei 14.133, arts. 54, 72 par. único e 94',null,80),
('direta','instrumento','Contrato, ata ou nota de empenho como instrumento','Lei 14.133, art. 95',null,90),
('direta','af','Ordem de fornecimento ou de serviço','Instrumento',null,100),
('direta','nf','Nota fiscal atestada pelo fiscal','Lei 14.133, art. 140',null,110),
('direta','regularidade','Regularidade fiscal do fornecedor no pagamento','Lei 14.133, art. 68',null,120),
('direta','ordem','Pagamento na ordem cronológica','Lei 14.133, art. 141',null,130),
('osc','oficio','Ofício de solicitação da entidade','Instrução do processo',null,10),
('osc','estatuto','Estatuto social com as cláusulas exigidas','Lei 13.019, art. 33, I a IV',null,20),
('osc','ata','Ata de eleição e posse da diretoria vigente','Lei 13.019, art. 34, V',null,30),
('osc','dirigentes','Relação de dirigentes (endereço, RG, CPF)','Lei 13.019, art. 34, VI',null,40),
('osc','cnpj','Cartão CNPJ — existência mínima de 1 ano','Lei 13.019, art. 33, V, "a"',null,50),
('osc','experiencia','Comprovação de experiência prévia','Lei 13.019, art. 33, V, "b"',null,60),
('osc','capacidade','Capacidade técnica e operacional','Lei 13.019, art. 33, V, "c"',null,70),
('osc','endereco','Comprovante de endereço de funcionamento','Lei 13.019, art. 34, VII',null,80),
('osc','cnd_federal','Certidão conjunta RFB/PGFN','Lei 13.019, art. 34, II',null,90),
('osc','crf','Certificado de regularidade do FGTS','Lei 13.019, art. 34, II',null,100),
('osc','cndt','Certidão negativa de débitos trabalhistas','Lei 13.019, art. 34, II',null,110),
('osc','cnd_est','Certidão de regularidade estadual','Lei 13.019, art. 34, II',null,120),
('osc','cnd_mun','Certidão de regularidade municipal','Lei 13.019, art. 34, II',null,130),
('osc','decl39','Declaração de inexistência de impedimentos','Lei 13.019, art. 39',null,140),
('osc','menor','Declaração de não emprego de menor','CF, art. 7º, XXXIII',null,150),
('osc','conta','Conta bancária específica da parceria','Lei 13.019, art. 51',null,160),
('osc','plano','Plano de trabalho','Lei 13.019, art. 22',null,170),
('osc','dispensa','Justificativa de não chamamento (emenda)','Lei 13.019, art. 29',null,180),
('osc','par_tec','Parecer técnico do órgão','Lei 13.019, art. 35, V',null,190),
('osc','par_jur','Parecer jurídico','Lei 13.019, art. 35, VI',null,200),
('osc','gestor','Designação do gestor da parceria','Lei 13.019, arts. 35, V, "g" e 61',null,210),
('osc','termo','Termo de fomento ou colaboração assinado','Lei 13.019, art. 42',null,220),
('osc','extrato','Extrato publicado','Lei 13.019, art. 38',null,230),
('osc','transparencia','Divulgação no portal da transparência','Lei 13.019, arts. 10 e 11',null,240),
('ente','oficio','Ofício de solicitação','Instrução do processo',null,10),
('ente','constitutivo','Estatuto ou ato constitutivo e ata da diretoria','Entidade privada / consórcio',null,20),
('ente','nomeacao','Ato de nomeação do representante legal','Representação',null,30),
('ente','cnes','CNES ativo (quando Saúde)','Portaria GM/MS','saude',40),
('ente','cebas','CEBAS (quando houver)','Lei Complementar 187/2021','saude',50),
('ente','vinculo_sus','Instrumento vigente com o SUS ou contrato de consórcio','Contratualização / Lei 11.107',null,60),
('ente','rateio','Contrato de rateio (consórcio)','Lei 11.107, art. 8º','consorcio',70),
('ente','cnd_federal','Certidão conjunta RFB/PGFN','Regularidade fiscal',null,80),
('ente','crf','Certificado de regularidade do FGTS','Regularidade fiscal',null,90),
('ente','cndt','Certidão negativa de débitos trabalhistas','Regularidade trabalhista',null,100),
('ente','cnd_est_mun','Certidões estadual e municipal','Regularidade fiscal',null,110),
('ente','plano','Plano de trabalho ou de aplicação','Instrumento',null,120),
('ente','cms','Aprovação no Conselho Municipal de Saúde (quando Saúde)','Lei 8.142/1990','saude',130),
('ente','par_tec','Parecer técnico','Instrução do processo',null,140),
('ente','par_jur','Parecer jurídico','Instrução do processo',null,150),
('ente','conta','Conta bancária específica','Rastreabilidade do recurso',null,160),
('ente','gestor','Designação de gestor ou fiscal','Acompanhamento',null,170),
('ente','instrumento','Instrumento assinado','Formalização',null,180),
('ente','extrato','Extrato publicado','Publicidade',null,190)
on conflict (tipo,chave) do nothing;

-- v_emendas ganha tipo_execucao (coluna nova sempre no fim)
create or replace view emendas.v_emendas with (security_invoker=true) as
 SELECT e.id, e.ano, e.numero, e.numero_vereador, e.objeto, e.descricao, e.valor, e.saude, e.modalidade, e.etapa, e.situacao, e.etapa_atualizada_em, e.criado_em, e.atualizado_em, e.funcional_programatica, e.natureza_despesa, e.dotacao_texto, e.ficha, e.vereador_id, v.numero AS vereador_numero, v.nome AS vereador_nome, e.beneficiario_id, b.nome AS beneficiario_nome, b.cnpj AS beneficiario_cnpj, e.unidade_id, u.codigo AS unidade_codigo, u.nome AS unidade_nome, u.secretaria_id, s.nome AS secretaria_nome,
    COALESCE(m.empenhado, 0::numeric) AS empenhado, COALESCE(m.liquidado, 0::numeric) AS liquidado, COALESCE(m.pago, 0::numeric) AS pago, m.ultimo_pagamento,
    (EXISTS ( SELECT 1 FROM emendas.remanejamentos r WHERE r.emenda_id = e.id)) AS remanejada,
    ( SELECT count(*) AS count FROM emendas.impedimentos i WHERE i.emenda_id = e.id AND i.resolvido_em IS NULL) AS impedimentos_abertos,
    e.tipo_execucao
   FROM emendas.emendas e
     JOIN emendas.vereadores v ON v.id = e.vereador_id
     JOIN emendas.unidades_orcamentarias u ON u.id = e.unidade_id
     JOIN emendas.secretarias s ON s.id = u.secretaria_id
     LEFT JOIN emendas.beneficiarios b ON b.id = e.beneficiario_id
     LEFT JOIN LATERAL ( SELECT sum(mf.valor) FILTER (WHERE mf.tipo = 'empenho'::text) - COALESCE(sum(mf.valor) FILTER (WHERE mf.tipo = 'anulacao'::text), 0::numeric) AS empenhado,
            sum(mf.valor) FILTER (WHERE mf.tipo = 'liquidacao'::text) AS liquidado,
            sum(mf.valor) FILTER (WHERE mf.tipo = 'pagamento'::text) AS pago,
            max(mf.data) FILTER (WHERE mf.tipo = 'pagamento'::text) AS ultimo_pagamento
           FROM emendas.movimentos_financeiros mf WHERE mf.emenda_id = e.id) m ON true;

-- Carga única (feita em 27/10/2026 na produção, conferida em transação antes):
--  * tipo_execucao dos 215 a partir do HTML de controle (85 direta · 109 osc · 21 ente);
--  * andamentos 'processo_compra' das diretas viraram emenda_fases.demanda (origem 'importacao').
-- Fases de empenho/liquidação/pagamento NÃO são migradas: o app as deriva de movimentos_financeiros
-- e, na falta deles, da etapa atual da emenda (marcadas como "presumida").
