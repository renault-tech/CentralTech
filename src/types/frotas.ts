/**
 * Tipos do schema `frotas` (espelham supabase/migrations/20261104000000_frotas_schema.sql).
 * Módulo Frotas — roda dentro do Hub, mesmo projeto Supabase.
 */

export type PerfilFrotas = "gestor" | "consulta";
/** `admin` = admin do Hub (não existe em `frotas.usuarios`). */
export type PerfilEfetivoFrotas = PerfilFrotas | "admin";

export type Vinculo = "proprio" | "convenio" | "alugado";
export type Combustivel = "gasolina" | "flex" | "diesel" | "diesel_s10";
export type Classificacao = "leve" | "pesado" | "maquina" | "moto";
export type SituacaoVeiculo = "ativo" | "em_manutencao" | "inativo" | "baixado";
export type TipoFornecedor = "posto" | "oficina" | "locadora";
export type TipoFipe = "carros" | "motos" | "caminhoes";
export type StatusAnalise = "a_analisar" | "liberado" | "recusado" | "novo_orcamento";

export type SecretariaFrotas = {
  id: string;
  nome: string;
  controla_combustivel: boolean;
  ativa: boolean;
  criado_em: string;
};

export type Fornecedor = {
  id: string;
  tipo: TipoFornecedor;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  criado_em: string;
};

export type Veiculo = {
  id: string;
  placa: string | null;
  modelo: string;
  marca: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  combustivel: Combustivel | null;
  classificacao: Classificacao | null;
  patrimonio: string | null;
  vinculo: Vinculo;
  secretaria_id: string;
  setor: string | null;
  situacao: SituacaoVeiculo;
  motivo_situacao: string | null;
  finalidade: string | null;
  locadora_id: string | null;
  fipe_tipo: TipoFipe | null;
  fipe_marca_id: string | null;
  fipe_modelo_id: string | null;
  fipe_ano_id: string | null;
  fipe_codigo: string | null;
  fipe_referencia: string | null;
  valor_referencia: number | null;
  valor_fonte: "fipe" | "manual" | null;
  valor_referencia_em: string | null;
  revisao_ignorada: string[];
  observacoes: string | null;
  origem: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type ParametrosFrotas = {
  id: 1;
  dias_atencao: number;
  dias_critico: number;
  pct_atencao: number;
  pct_critico: number;
  reincidencia_qtd: number;
  reincidencia_meses: number;
  orcamento_acima_pct: number;
  combustivel_acima_pct: number;
  inativo_dias: number;
  atualizado_em: string;
};

export type NotaCombustivel = {
  id: string;
  secretaria_id: string;
  fornecedor_id: string | null;
  numero_nf: string;
  periodo_inicio: string;
  periodo_fim: string;
  data_emissao: string;
  valor: number;
  enviada_secretaria_em: string | null;
  retornou_em: string | null;
  enviada_contabilidade_em: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Manutencao = {
  id: string;
  veiculo_id: string;
  secretaria_id: string;
  fornecedor_id: string | null;
  servico: string;
  descricao: string | null;
  orcamento_valor: number;
  orcamento_recebido_em: string;
  status_analise: StatusAnalise;
  analisado_em: string | null;
  analise_obs: string | null;
  oc_numero: string | null;
  oc_valor: number | null;
  oc_emitida_em: string | null;
  oc_enviada_em: string | null;
  nf_numero: string | null;
  nf_emissao: string | null;
  nf_valor: number | null;
  docs_retornaram_em: string | null;
  enviada_contabilidade_em: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type UsuarioFrotas = {
  id: string;
  perfil: PerfilFrotas;
  criado_em: string;
  atualizado_em: string;
};

export type RegistroAuditoriaFrotas = {
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

export type DatabaseFrotas = {
  frotas: {
    Tables: {
      usuarios: Tabela<UsuarioFrotas, "id" | "perfil", "criado_em" | "atualizado_em">;
      secretarias: Tabela<SecretariaFrotas, "nome", "id" | "criado_em">;
      fornecedores: Tabela<Fornecedor, "tipo" | "nome", "id" | "criado_em">;
      veiculos: Tabela<Veiculo, "modelo" | "vinculo" | "secretaria_id", "id" | "criado_em" | "atualizado_em">;
      parametros: Tabela<ParametrosFrotas, "id", "atualizado_em">;
      notas_combustivel: Tabela<
        NotaCombustivel,
        "secretaria_id" | "numero_nf" | "periodo_inicio" | "periodo_fim" | "data_emissao" | "valor",
        "id" | "criado_em" | "atualizado_em"
      >;
      manutencoes: Tabela<
        Manutencao,
        "veiculo_id" | "secretaria_id" | "servico" | "orcamento_valor" | "orcamento_recebido_em",
        "id" | "criado_em" | "atualizado_em"
      >;
      auditoria: Tabela<RegistroAuditoriaFrotas, "tabela" | "acao", "id" | "em">;
    };
    Views: Record<string, never>;
    Functions: {
      meu_perfil: { Args: Record<string, never>; Returns: PerfilEfetivoFrotas | null };
      eh_gestor: { Args: Record<string, never>; Returns: boolean };
      pode_ver: { Args: Record<string, never>; Returns: boolean };
      definir_acesso: { Args: { p_usuario: string; p_perfil: PerfilFrotas }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
