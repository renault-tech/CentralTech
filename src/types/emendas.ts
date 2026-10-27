/**
 * Tipos do schema `emendas` (espelham supabase/migrations/20261021*).
 * Módulo Emendas Impositivas — roda dentro do Hub, mesmo projeto Supabase.
 */

/** Chave de uma fase (`emendas.etapas.chave`). As fixas são `indicada`, `empenhada`,
 * `liquidada`, `paga` e `concluida`; as demais são editáveis em Configurações → Fases. */
export type EtapaEmenda = string;

export type Modalidade = "repasse" | "direta";
/** Tipo de execução da emenda (controle do HTML de 2026): define fluxo de fases e checklist. */
export type TipoExecucao = "direta" | "osc" | "ente";
export type SituacaoFase = "pendente" | "em_andamento" | "concluida" | "nao_se_aplica";
export type EstadoChecklist = "conferido" | "presumido" | "pendente" | "nao_se_aplica";
export type DerivacaoFase = "loa" | "parecer" | "empenho" | "liquidacao" | "pagamento" | "termo" | "extrato";
export type SituacaoEmenda = "normal" | "impedida" | "cancelada";
export type PerfilEmendas = "gestor" | "admin_secretaria" | "operador" | "consulta";
/** `admin` = admin do Hub (não existe em `emendas.usuarios`). */
export type PerfilEfetivo = PerfilEmendas | "admin";
export type TipoMovimento = "empenho" | "liquidacao" | "pagamento" | "anulacao";
export type TipoImpedimento = "tecnico" | "legal" | "documentacao";
export type TipoDocumento =
  | "plano_trabalho"
  | "certidoes"
  | "termo"
  | "pedido"
  | "processo_compra"
  | "nota_empenho"
  | "nota_fiscal"
  | "comprovante_pagamento"
  | "prestacao_contas"
  | "outro";

export type Exercicio = {
  ano: number;
  cota_por_vereador: number;
  percentual_saude_min: number;
  rcl: number | null;
  percentual_rcl: number | null;
  situacao: "aberto" | "encerrado";
  criado_em: string;
  data_aprovacao_loa: string | null;
  numero_lei_loa: string | null;
  prazo_exequibilidade: string | null;
};

export type Vereador = {
  id: string;
  numero: number;
  nome: string;
  partido: string | null;
  ativo: boolean;
  criado_em: string;
};

export type Secretaria = { id: string; nome: string; ordem: number; ativo: boolean };

export type UnidadeOrcamentaria = {
  id: string;
  codigo: string;
  nome: string;
  secretaria_id: string;
  ativo: boolean;
};

export type Beneficiario = {
  id: string;
  nome: string;
  cnpj: string | null;
  tipo: "entidade" | "orgao_publico";
  criado_em: string;
};

export type Emenda = {
  id: string;
  ano: number;
  numero: number;
  numero_vereador: number;
  vereador_id: string;
  objeto: string;
  descricao: string;
  valor: number;
  beneficiario_id: string | null;
  unidade_id: string;
  saude: boolean;
  funcional_programatica: string | null;
  natureza_despesa: string | null;
  dotacao_texto: string | null;
  ficha: string | null;
  modalidade: Modalidade;
  tipo_execucao: TipoExecucao | null;
  etapa: EtapaEmenda;
  situacao: SituacaoEmenda;
  etapa_atualizada_em: string;
  criado_em: string;
  criado_por: string | null;
  atualizado_em: string;
};

/** Linha de `emendas.v_emendas` — fonte única das telas. */
export type EmendaResumo = {
  id: string;
  ano: number;
  numero: number;
  numero_vereador: number;
  objeto: string;
  descricao: string;
  valor: number;
  saude: boolean;
  modalidade: Modalidade;
  tipo_execucao: TipoExecucao | null;
  etapa: EtapaEmenda;
  situacao: SituacaoEmenda;
  etapa_atualizada_em: string;
  criado_em: string;
  atualizado_em: string;
  funcional_programatica: string | null;
  natureza_despesa: string | null;
  dotacao_texto: string | null;
  ficha: string | null;
  vereador_id: string;
  vereador_numero: number;
  vereador_nome: string;
  beneficiario_id: string | null;
  beneficiario_nome: string | null;
  beneficiario_cnpj: string | null;
  unidade_id: string;
  unidade_codigo: string;
  unidade_nome: string;
  secretaria_id: string;
  secretaria_nome: string;
  empenhado: number;
  liquidado: number;
  pago: number;
  ultimo_pagamento: string | null;
  remanejada: boolean;
  impedimentos_abertos: number;
};

export type Andamento = {
  id: string;
  emenda_id: string;
  etapa: EtapaEmenda;
  data: string;
  documento: string | null;
  observacao: string | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  criado_em: string;
};

export type MovimentoFinanceiro = {
  id: string;
  emenda_id: string;
  tipo: TipoMovimento;
  numero: string | null;
  data: string | null;
  valor: number;
  observacao: string | null;
  usuario_id: string | null;
  criado_em: string;
};

export type Impedimento = {
  id: string;
  emenda_id: string;
  tipo: TipoImpedimento;
  justificativa: string;
  data: string;
  resolvido_em: string | null;
  resolucao: string | null;
  usuario_id: string | null;
  criado_em: string;
};

export type Remanejamento = {
  id: string;
  emenda_id: string;
  data: string;
  ato: string | null;
  motivo: string | null;
  antes: Record<string, unknown>;
  depois: Record<string, unknown>;
  usuario_id: string | null;
  criado_em: string;
};

/** Dados de parceria/execução (1:1 com a emenda; `id` = id da emenda). */
export type ExecucaoEmenda = {
  id: string;
  numero_termo: string | null;
  processo_licitatorio: string | null;
  data_envio_pagamento: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  data_publicacao_extrato: string | null;
  conta_bancaria: string | null;
  gestor_osc: string | null;
  gestor_pmc: string | null;
  observacao: string | null;
  atualizado_em: string;
  atualizado_por: string | null;
};

export type DocumentoEmenda = {
  id: string;
  emenda_id: string;
  tipo: TipoDocumento;
  nome_arquivo: string;
  caminho: string;
  tamanho: number | null;
  usuario_id: string | null;
  criado_em: string;
};

export type UsuarioEmendas = {
  id: string;
  perfil: PerfilEmendas;
  secretaria_id: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type RegistroAuditoria = {
  id: number;
  tabela: string;
  registro_id: string | null;
  acao: "INSERT" | "UPDATE" | "DELETE";
  usuario_id: string | null;
  em: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
};

export type PermissaoSecretaria = {
  usuario_id: string;
  secretaria_id: string;
  pode_ver: boolean;
  pode_editar: boolean;
};

/** `emendas.etapas`: a fase em si (nome/cor/grupo), global aos dois fluxos. */
export type EtapaRegistro = { chave: string; nome: string; cor: string; grupo: 0 | 1 | 2 | 3; fixa: boolean };
/** `emendas.fluxo_etapas`: quais fases cada modalidade usa, em que ordem. */
export type FluxoEtapaRegistro = { modalidade: Modalidade; chave: string; ordem: number; ativa: boolean };

/** `emendas.fluxo_fases`: fases de cada tipo de execução (catálogo). */
export type FaseFluxo = {
  tipo: TipoExecucao;
  chave: string;
  nome: string;
  etapa: EtapaEmenda;
  referencia: string | null;
  derivacao: DerivacaoFase | null;
  ordem: number;
  ativa: boolean;
};
/** Situação de uma fase MANUAL de uma emenda (as derivadas não têm linha). */
export type FaseEmenda = {
  emenda_id: string;
  chave: string;
  situacao: SituacaoFase;
  data: string | null;
  documento: string | null;
  observacao: string | null;
  origem: string | null;
  atualizado_por: string | null;
  atualizado_em: string;
};
export type ItemChecklist = {
  tipo: TipoExecucao;
  chave: string;
  nome: string;
  referencia_legal: string | null;
  condicao: "saude" | "consorcio" | null;
  ordem: number;
  ativo: boolean;
};
export type ChecklistEmenda = {
  emenda_id: string;
  item_chave: string;
  estado: EstadoChecklist;
  documento_id: string | null;
  observacao: string | null;
  conferido_por: string | null;
  conferido_em: string | null;
};
export type ParecerExequibilidade = {
  ano: number;
  secretaria_id: string;
  data: string;
  protocolo: string | null;
  observacao: string | null;
  atualizado_por: string | null;
  atualizado_em: string;
};
export type PendenciaJustificada = {
  emenda_id: string;
  regra: string;
  assinatura: string;
  justificativa: string;
  por: string | null;
  em: string;
};

type Tabela<Row, Obrigatorios extends keyof Row, Gerados extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Obrigatorios> & Partial<Omit<Row, Obrigatorios | Gerados>>;
  Update: Partial<Omit<Row, Gerados>>;
  Relationships: [];
};

export type DatabaseEmendas = {
  emendas: {
    Tables: {
      exercicios: Tabela<Exercicio, "ano" | "cota_por_vereador", "criado_em">;
      vereadores: Tabela<Vereador, "numero" | "nome", "id" | "criado_em">;
      secretarias: Tabela<Secretaria, "nome", "id">;
      unidades_orcamentarias: Tabela<UnidadeOrcamentaria, "codigo" | "nome" | "secretaria_id", "id">;
      beneficiarios: Tabela<Beneficiario, "nome", "id" | "criado_em">;
      emendas: Tabela<
        Emenda,
        "ano" | "numero" | "numero_vereador" | "vereador_id" | "objeto" | "descricao" | "valor" | "unidade_id" | "modalidade",
        "id" | "criado_em" | "atualizado_em" | "etapa_atualizada_em"
      >;
      andamentos: Tabela<Andamento, "emenda_id" | "etapa", "id" | "criado_em">;
      movimentos_financeiros: Tabela<MovimentoFinanceiro, "emenda_id" | "tipo" | "valor", "id" | "criado_em">;
      impedimentos: Tabela<Impedimento, "emenda_id" | "tipo" | "justificativa", "id" | "criado_em">;
      remanejamentos: Tabela<Remanejamento, "emenda_id" | "antes" | "depois", "id" | "criado_em">;
      execucao: Tabela<ExecucaoEmenda, "id", never>;
      documentos: Tabela<DocumentoEmenda, "emenda_id" | "tipo" | "nome_arquivo" | "caminho", "id" | "criado_em">;
      usuarios: Tabela<UsuarioEmendas, "id" | "perfil", "criado_em">;
      permissoes: Tabela<PermissaoSecretaria, "usuario_id" | "secretaria_id", never>;
      auditoria: Tabela<RegistroAuditoria, "tabela" | "acao", "id" | "em">;
      etapas: Tabela<EtapaRegistro, "chave" | "nome" | "cor" | "grupo", never>;
      fluxo_etapas: Tabela<FluxoEtapaRegistro, "modalidade" | "chave" | "ordem", never>;
      fluxo_fases: Tabela<FaseFluxo, "tipo" | "chave" | "nome" | "etapa" | "ordem", never>;
      emenda_fases: Tabela<FaseEmenda, "emenda_id" | "chave", never>;
      checklist_itens: Tabela<ItemChecklist, "tipo" | "chave" | "nome" | "ordem", never>;
      emenda_checklist: Tabela<ChecklistEmenda, "emenda_id" | "item_chave", never>;
      pareceres_exequibilidade: Tabela<ParecerExequibilidade, "ano" | "secretaria_id" | "data", never>;
      pendencias_justificadas: Tabela<PendenciaJustificada, "emenda_id" | "regra" | "assinatura" | "justificativa", never>;
    };
    Views: {
      v_emendas: { Row: EmendaResumo; Relationships: [] };
    };
    Functions: {
      meu_perfil: { Args: Record<string, never>; Returns: PerfilEfetivo | null };
      eh_gestor: { Args: Record<string, never>; Returns: boolean };
      minha_secretaria: { Args: Record<string, never>; Returns: string | null };
      pode_editar_secretaria: { Args: { p_secretaria: string }; Returns: boolean };
      pode_editar_emenda: { Args: { p_emenda: string }; Returns: boolean };
      registrar_andamento: {
        Args: {
          p_emenda: string;
          p_etapa: EtapaEmenda;
          p_data: string;
          p_documento?: string | null;
          p_observacao?: string | null;
          p_valor?: number | null;
        };
        Returns: string;
      };
      remanejar: {
        Args: { p_emenda: string; p_novo: Record<string, unknown>; p_ato?: string | null; p_motivo?: string | null };
        Returns: string;
      };
      definir_acesso: {
        Args: {
          p_usuario: string;
          p_perfil: PerfilEmendas;
          p_secretaria: string | null;
          p_permissoes: { secretaria_id: string; ver: boolean; editar: boolean }[];
          p_ativo?: boolean;
        };
        Returns: undefined;
      };
      salvar_fluxo: {
        Args: { p_modalidade: Modalidade; p_itens: { chave: string | null; nome: string; cor: string; ativa: boolean; remover?: boolean }[] };
        Returns: undefined;
      };
      importar: {
        Args: { p_ano: number; p_emendas: unknown[] };
        Returns: { criadas: number; ignoradas: number; remanejamentos: number; movimentos: number };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
