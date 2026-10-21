/**
 * Tipos do schema `emendas` (espelham supabase/migrations/20261021*).
 * Módulo Emendas Impositivas — roda dentro do Hub, mesmo projeto Supabase.
 */

export type EtapaEmenda =
  | "indicada"
  | "analise"
  | "plano_trabalho"
  | "processo_compra"
  | "empenhada"
  | "liquidada"
  | "paga"
  | "prestacao_contas"
  | "concluida";

export type Modalidade = "repasse" | "direta";
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
      documentos: Tabela<DocumentoEmenda, "emenda_id" | "tipo" | "nome_arquivo" | "caminho", "id" | "criado_em">;
      usuarios: Tabela<UsuarioEmendas, "id" | "perfil", "criado_em">;
      permissoes: Tabela<PermissaoSecretaria, "usuario_id" | "secretaria_id", never>;
      auditoria: Tabela<RegistroAuditoria, "tabela" | "acao", "id" | "em">;
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
      importar: {
        Args: { p_ano: number; p_emendas: unknown[] };
        Returns: { criadas: number; ignoradas: number; remanejamentos: number; movimentos: number };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
