import type { TipoExecucao } from "@/types/emendas";

/** Tipos do portal público (sem `server-only`: usados também no navegador e nos testes). */
export type DocumentoPortal = { id: string; tipo: "plano_trabalho" | "relatorio_gestao" | "anuencia_sus"; rotulo: string; competencia: number | null; nome: string };
export type MovimentoPortal = { tipo: "empenho" | "liquidacao" | "pagamento" | "anulacao"; data: string | null; valor: number; numero: string | null };

/** Documentos que o portal publica por exigência da IN TCE-MG 05/2025 (art. 7º, IX, X e XVII). Nenhum outro anexo sai daqui. */
export const TIPOS_DOCUMENTO_PUBLICO = ["plano_trabalho", "relatorio_gestao", "anuencia_sus"] as const;
export const ROTULO_DOC = { plano_trabalho: "Plano de trabalho", relatorio_gestao: "Relatório de gestão", anuencia_sus: "Anuência do SUS" } as const;

export type LinhaPortal = {
  numero: number;
  ano: number;
  vereador: string;
  partido: string | null;
  unidadeParlamentar: string | null;
  leiLoa: string | null;
  municipio: string | null;
  municipioCnpj: string | null;
  objeto: string;
  descricao: string;
  localidade: string | null;
  valor: number;
  saude: boolean;
  tipo: TipoExecucao;
  secretaria: string;
  unidade: string;
  funcional: string | null;
  natureza: string | null;
  gnd: string | null;
  categoria: string | null;
  beneficiario: string | null;
  /** CNPJ do recebedor (beneficiário; na execução direta, o do Município). */
  cnpj: string | null;
  etapa: string;
  situacao: "normal" | "impedida" | "cancelada";
  empenhado: number;
  liquidado: number;
  pago: number;
  ultimoPagamento: string | null;
  /** Data(s) de disponibilização do recurso: empenhos, liquidações e pagamentos. */
  movimentos: MovimentoPortal[];
  termo: string | null;
  processo: string | null;
  contrato: string | null;
  inicioPrevisto: string | null;
  terminoPrevisto: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  extratoPublicadoEm: string | null;
  /** Banco e conta da movimentação dos recursos (IN 05/2025, art. 7º, XVI): conta de pessoa jurídica, divulgada por exigência da norma. */
  conta: string | null;
  gestorPrefeitura: string | null;
  gestorEntidade: string | null;
  anuenciaSus: "sim" | "nao" | "nao_se_aplica" | null;
  identificadorContabil: string | null;
  fonteRecurso: string | null;
  planoMetas: string | null;
  planoOutrasFontes: number | null;
  documentos: DocumentoPortal[];
  impedimento: string | null;
};

