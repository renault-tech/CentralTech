/**
 * Tipos do schema `imoveis` (espelham supabase/migrations/20261107000000_imoveis_schema.sql).
 * Módulo Imóveis e Consumo — roda dentro do Hub, mesmo projeto Supabase.
 */

export type PerfilImoveis = "gestor" | "consulta" | "secretaria";
/** `admin` = admin do Hub (não existe em `imoveis.usuarios`). */
export type PerfilEfetivoImoveis = PerfilImoveis | "admin";

export type SituacaoImovel = "ativo" | "em_entrega" | "entregue";
export type TipoUnidade = "agua" | "luz";
export type IndiceReajuste = "IPCA" | "IGP-M" | "INPC" | "outro";
export type TipoDocumento = "contrato" | "vistoria" | "laudo" | "titularidade_agua" | "titularidade_luz" | "comprovante" | "outro";

export type SecretariaImoveis = { id: string; nome: string; ativa: boolean; criado_em: string };

export type UsuarioImoveis = {
  id: string;
  perfil: PerfilImoveis;
  secretaria_id: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Imobiliaria = {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  ativa: boolean;
  criado_em: string;
};

export type Imovel = {
  id: string;
  nome: string;
  endereco: string;
  secretaria_id: string;
  setor: string | null;
  finalidade: string | null;
  situacao: SituacaoImovel;
  contrato_numero: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  valor_aluguel: number;
  dia_vencimento: number | null;
  indice_reajuste: IndiceReajuste | null;
  proximo_reajuste: string | null;
  imobiliaria_id: string | null;
  proprietario_nome: string | null;
  proprietario_documento: string | null;
  proprietario_contato: string | null;
  proprietario_conta: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Unidade = {
  id: string;
  imovel_id: string;
  tipo: TipoUnidade;
  numero: string;
  titular: string | null;
  ativa: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type Conta = {
  id: string;
  unidade_id: string;
  referencia: string; // sempre dia 1 (AAAA-MM-01)
  consumo: number | null;
  valor: number;
  vencimento: string | null;
  pago_em: string | null;
  observacao: string | null;
  origem: "digitada" | "pdf";
  criado_em: string;
  atualizado_em: string;
};

export type Entrega = {
  id: string; // = id do imóvel
  aviso_saida_em: string | null;
  agua_pedido_em: string | null;
  agua_protocolo: string | null;
  agua_desligada_em: string | null;
  luz_pedido_em: string | null;
  luz_protocolo: string | null;
  luz_desligada_em: string | null;
  chaves_entregues_em: string | null;
  chaves_entregue_por: string | null;
  chaves_recebida_por: string | null;
  vistoria_agendada_em: string | null;
  vistoriador: string | null;
  vistoria_concluida_em: string | null;
  vistoria_obs: string | null;
  titularidade_agua_em: string | null;
  titularidade_luz_em: string | null;
  encerrado_em: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type DocumentoImovel = {
  id: string;
  imovel_id: string;
  tipo: TipoDocumento;
  nome_arquivo: string;
  caminho: string;
  enviado_por: string | null;
  criado_em: string;
};

export type PendenciaJustificada = {
  imovel_id: string;
  chave: string;
  justificativa: string;
  assinatura: string;
  usuario_id: string | null;
  em: string;
};

export type ParametrosImoveis = {
  id: 1;
  pct_acima: number;
  pct_abaixo: number;
  meses_media: number;
  dias_fim_contrato: number;
  dia_lancamento: number;
  pct_valor: number;
  dias_atraso: number;
  atualizado_em: string;
};

export type PreferenciaExportacaoImoveis = { usuario_id: string; ocultas: Record<string, string[]> };

export type RegistroAuditoriaImoveis = {
  id: number;
  tabela: string;
  registro_id: string | null;
  acao: string;
  usuario_id: string | null;
  em: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
};

type Tabela<Row, Obrigatorios extends keyof Row, Gerados extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Obrigatorios> & Partial<Omit<Row, Obrigatorios | Gerados>>;
  Update: Partial<Omit<Row, Gerados>>;
  Relationships: [];
};

export type DatabaseImoveis = {
  imoveis: {
    Tables: {
      usuarios: Tabela<UsuarioImoveis, "id" | "perfil", "criado_em" | "atualizado_em">;
      secretarias: Tabela<SecretariaImoveis, "nome", "id" | "criado_em">;
      imobiliarias: Tabela<Imobiliaria, "nome", "id" | "criado_em">;
      imoveis: Tabela<Imovel, "nome" | "endereco" | "secretaria_id", "id" | "criado_em" | "atualizado_em">;
      unidades: Tabela<Unidade, "imovel_id" | "tipo" | "numero", "id" | "criado_em" | "atualizado_em">;
      contas: Tabela<Conta, "unidade_id" | "referencia" | "valor", "id" | "criado_em" | "atualizado_em">;
      entregas: Tabela<Entrega, "id", "criado_em" | "atualizado_em">;
      documentos: Tabela<DocumentoImovel, "imovel_id" | "tipo" | "nome_arquivo" | "caminho", "id" | "criado_em">;
      pendencias_justificadas: Tabela<PendenciaJustificada, "imovel_id" | "chave" | "justificativa" | "assinatura", "em">;
      parametros: Tabela<ParametrosImoveis, "id", "atualizado_em">;
      preferencias_exportacao: Tabela<PreferenciaExportacaoImoveis, "usuario_id", never>;
      auditoria: Tabela<RegistroAuditoriaImoveis, "tabela" | "acao", "id" | "em">;
    };
    Views: Record<string, never>;
    Functions: {
      meu_perfil: { Args: Record<string, never>; Returns: PerfilEfetivoImoveis | null };
      minha_secretaria: { Args: Record<string, never>; Returns: string | null };
      eh_gestor: { Args: Record<string, never>; Returns: boolean };
      pode_ver: { Args: Record<string, never>; Returns: boolean };
      definir_acesso: { Args: { p_usuario: string; p_perfil: PerfilImoveis; p_secretaria?: string | null }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
