/**
 * Categoria (origem) do beneficiário. Ela SUGERE o tipo de execução e o instrumento da emenda, nunca trava: a emenda pode
 * sobrescrever quando o caso fugir da regra. O `tipo` do cadastro (entidade / órgão público / pessoa física) só valida o
 * documento (CNPJ ou CPF) e é derivado da categoria. Funções puras, testadas em `categorias.test.ts`.
 */

import type { Instrumento } from "@/lib/emendas/documentos-drive";
import type { TipoBeneficiario } from "@/lib/emendas/documentos";
import type { TipoExecucao } from "@/types/emendas";

export const CATEGORIAS = ["osc", "saude_sus", "consorcio", "ente_publico", "orgao_municipal", "pessoa_fisica"] as const;
export type CategoriaBeneficiario = (typeof CATEGORIAS)[number];

export type InfoCategoria = {
  nome: string;
  curto: string;
  descricao: string;
  cor: string;
  /** Tipo do cadastro (define se o documento é CNPJ ou CPF). */
  tipo: TipoBeneficiario;
  /** Sugestão para a emenda (null = sem sugestão). */
  tipoExecucao: TipoExecucao | null;
  instrumento: Instrumento | null;
};

export const INFO_CATEGORIA: Record<CategoriaBeneficiario, InfoCategoria> = {
  osc: {
    nome: "Organização da sociedade civil",
    curto: "OSC",
    descricao: "Associação, clube, conselho comunitário, caixa escolar, ONG. Parceria pelo MROSC (termo de fomento ou de colaboração).",
    cor: "#9A5A0E",
    tipo: "entidade",
    tipoExecucao: "osc",
    instrumento: "termo_fomento",
  },
  saude_sus: {
    nome: "Hospital ou instituição conveniada ao SUS",
    curto: "Saúde/SUS",
    descricao: "Hospital e instituição que atende o SUS. Exige anuência do gestor do SUS.",
    cor: "#962A52",
    tipo: "entidade",
    tipoExecucao: "ente",
    instrumento: "termo_fomento",
  },
  consorcio: {
    nome: "Consórcio público",
    curto: "Consórcio",
    descricao: "Consórcio intermunicipal (Lei 11.107/2005). O instrumento é o contrato de rateio (convênio), não o termo de fomento.",
    cor: "#1D6A8A",
    tipo: "entidade",
    tipoExecucao: "ente",
    instrumento: "convenio",
  },
  ente_publico: {
    nome: "Outro ente público",
    curto: "Ente público",
    descricao: "Estado, União, autarquia ou fundação pública de outro ente. Instrumento: convênio.",
    cor: "#5B6573",
    tipo: "entidade",
    tipoExecucao: "ente",
    instrumento: "convenio",
  },
  orgao_municipal: {
    nome: "Órgão ou unidade da Prefeitura",
    curto: "Prefeitura",
    descricao: "Secretaria, escola, posto, CAPS etc. Aplicação direta, sem parceria (vale o CNPJ do Município).",
    cor: "#475569",
    tipo: "orgao_publico",
    tipoExecucao: "direta",
    instrumento: null,
  },
  pessoa_fisica: {
    nome: "Pessoa física",
    curto: "Pessoa física",
    descricao: "Beneficiário pessoa física. O CPF nunca aparece no portal público.",
    cor: "#6B4FBB",
    tipo: "pessoa_fisica",
    tipoExecucao: null,
    instrumento: null,
  },
};

export const ehCategoria = (v: unknown): v is CategoriaBeneficiario => typeof v === "string" && (CATEGORIAS as readonly string[]).includes(v);

export function tipoDaCategoria(c: CategoriaBeneficiario): TipoBeneficiario {
  return INFO_CATEGORIA[c].tipo;
}

/** O que a categoria sugere para a emenda: tipo de execução e instrumento. */
export function sugestaoDaCategoria(c: CategoriaBeneficiario | null | undefined): { tipoExecucao: TipoExecucao | null; instrumento: Instrumento | null } {
  if (!c) return { tipoExecucao: null, instrumento: null };
  const i = INFO_CATEGORIA[c];
  return { tipoExecucao: i.tipoExecucao, instrumento: i.instrumento };
}

/** Categoria sugerida a partir do tipo do cadastro antigo e do nome (para quem ainda não tem categoria). */
export function categoriaPorTipoENome(tipo: TipoBeneficiario, nome: string): CategoriaBeneficiario {
  if (tipo === "pessoa_fisica") return "pessoa_fisica";
  if (tipo === "orgao_publico") return "orgao_municipal";
  if (/cons[óo]rcio|\bcisum\b/i.test(nome)) return "consorcio";
  if (/hospital|santa casa/i.test(nome)) return "saude_sus";
  return "osc";
}

/** Categoria provável a partir da natureza jurídica do cartão do CNPJ ou do nome/estatuto. Null = não deu para decidir. */
export function categoriaPelaNaturezaJuridica(texto: string): CategoriaBeneficiario | null {
  const t = texto.toLowerCase();
  if (/cons[óo]rcio p[úu]blico/.test(t)) return "consorcio";
  if (/munic[íi]pio|prefeitura municipal|fundo municipal|secretaria municipal/.test(t) && !/associa|conselho/.test(t)) return "orgao_municipal";
  if (/\bestado\b|uni[ãa]o|autarquia|funda[çc][ãa]o p[úu]blica|instituto estadual|[óo]rg[ãa]o p[úu]blico/.test(t) && !/associa|privad/.test(t)) return "ente_publico";
  if (/hospital|santa casa/.test(t)) return "saude_sus";
  if (/associa[çc][ãa]o|funda[çc][ãa]o privada|organiza[çc][ãa]o religiosa|conselho|clube|sociedade civil|caixa escolar|organiza[çc][ãa]o da sociedade civil|\bong\b/.test(t)) return "osc";
  return null;
}

/**
 * Conflito entre o instrumento da emenda e a categoria do beneficiário. Só sinaliza (nunca bloqueia):
 * termo de fomento é do MROSC e vale para OSC; consórcio e ente público pedem convênio (contrato de rateio).
 */
export function conflitoInstrumento(categoria: CategoriaBeneficiario | null | undefined, instrumento: Instrumento | null | undefined): string | null {
  const instr: Instrumento = instrumento ?? "termo_fomento";
  if ((categoria === "consorcio" || categoria === "ente_publico") && instr === "termo_fomento") {
    return `${INFO_CATEGORIA[categoria].nome} não é organização da sociedade civil: o termo de fomento (MROSC, Lei 13.019/2014) não se aplica. O instrumento esperado é convênio (contrato de rateio, no caso de consórcio).`;
  }
  if (categoria === "osc" && instr === "convenio") {
    return "A parceria com organização da sociedade civil é por termo de fomento ou de colaboração (MROSC). Confirme por que o instrumento é convênio.";
  }
  return null;
}
