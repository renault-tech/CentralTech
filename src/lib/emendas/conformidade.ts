/**
 * Conformidade da emenda com a IN TCE-MG 05/2025 (art. 7º: elementos de publicidade; art. 5º e 6º:
 * rastreabilidade e conta específica) e com a Recomendação MPC-MG 01/2025. Funções puras (testadas em
 * `conformidade.test.ts`): quem carrega os dados é `calculos.ts`.
 *
 * Princípio: o sistema ALERTA (pendência de gravidade alta se já houve empenho/pagamento), não bloqueia.
 */

import { tipoDaEmenda } from "@/lib/emendas/fases";
import type { EmendaResumo, ExecucaoEmenda, Exercicio } from "@/types/emendas";

export type CodigoItem =
  | "I" | "II" | "III" | "IV" | "V" | "VI" | "VII" | "VIII" | "IX" | "X" | "XI" | "XII" | "XIII" | "XIV" | "XV" | "XVI" | "XVII"
  | "art5";

export type ItemConformidade = {
  codigo: CodigoItem;
  /** Nome curto para listas e tabelas. */
  nome: string;
  /** Texto da exigência, com a referência. */
  exigencia: string;
  /** Se a exigência vale para esta emenda neste momento. */
  aplica: boolean;
  ok: boolean;
  /** O que falta, em linguagem simples. */
  falta?: string;
};

export type DocumentoResumo = { tipo: string; competencia: number | null };
export type MovimentoConf = { tipo: string; data: string | null };

export type EntradaConformidade = {
  emenda: EmendaResumo;
  execucao: Partial<ExecucaoEmenda> | null;
  partido: string | null;
  exercicio: Pick<Exercicio, "numero_lei_loa" | "municipio_nome" | "municipio_cnpj" | "unidade_parlamentar"> | null;
  documentos: DocumentoResumo[];
  movimentos: MovimentoConf[];
};

const preenchido = (v: string | null | undefined) => !!v && v.trim().length > 0;

/** 2º dígito da natureza (3.3.90.39 → GND 3). 1º dígito: 3 = despesa corrente, 4 = despesa de capital. */
export function gndDaNatureza(natureza: string | null | undefined): { gnd: string; nome: string; categoria: "corrente" | "capital" | null } | null {
  const m = /^(\d)\.(\d)\./.exec((natureza ?? "").trim());
  if (!m) return null;
  const nomes: Record<string, string> = {
    "1": "Pessoal e encargos sociais",
    "2": "Juros e encargos da dívida",
    "3": "Outras despesas correntes",
    "4": "Investimentos",
    "5": "Inversões financeiras",
    "6": "Amortização da dívida",
  };
  return { gnd: m[2], nome: nomes[m[2]] ?? `GND ${m[2]}`, categoria: m[1] === "3" ? "corrente" : m[1] === "4" ? "capital" : null };
}

const BANCOS_OFICIAIS = /(banco do brasil|\bbb\b|caixa econ[oô]mica|\bcef\b|\bcaixa\b)/i;

/** Instituição financeira oficial (art. 6º da IN: "onde houver"). Texto livre do cadastro. */
export function bancoOficial(conta: string | null | undefined): boolean | null {
  if (!preenchido(conta)) return null;
  return BANCOS_OFICIAIS.test(conta as string);
}

/** Chave estável da conta (banco + número), para achar a MESMA conta usada em mais de uma emenda. */
export function chaveDaConta(conta: string | null | undefined): string | null {
  if (!preenchido(conta)) return null;
  const t = (conta as string).toLowerCase();
  const n = /conta[:\s.]*([0-9][0-9.\-\s]*)/i.exec(t);
  if (!n) return null;
  const digitos = n[1].replace(/\D/g, "");
  if (digitos.length < 4) return null;
  const banco = /caixa|cef/.test(t) ? "caixa" : /banco do brasil|\bbb\b/.test(t) ? "bb" : /sicoob|siccob/.test(t) ? "sicoob" : /sicredi/.test(t) ? "sicredi" : t.replace(/[^a-z]/g, "").slice(0, 8);
  return `${banco}:${digitos}`;
}

/** Contas usadas por mais de uma emenda (id da execução → true). */
export function contasRepetidas(execucoes: Pick<ExecucaoEmenda, "id" | "conta_bancaria">[]): Set<string> {
  const porChave = new Map<string, string[]>();
  for (const x of execucoes) {
    const k = chaveDaConta(x.conta_bancaria);
    if (k) porChave.set(k, [...(porChave.get(k) ?? []), x.id]);
  }
  const out = new Set<string>();
  for (const ids of porChave.values()) if (ids.length > 1) ids.forEach((i) => out.add(i));
  return out;
}

export function planoEstaCompleto(i: EntradaConformidade): { ok: boolean; falta: string[] } {
  const falta: string[] = [];
  const tipo = tipoDaEmenda(i.emenda);
  const temDoc = i.documentos.some((d) => d.tipo === "plano_trabalho");
  const temProcesso = !!(i.execucao?.processo_id || preenchido(i.execucao?.processo_licitatorio));
  if (!temDoc && !(tipo === "direta" && temProcesso)) falta.push(tipo === "direta" ? "anexar o plano de trabalho (ou vincular o processo com o termo de referência)" : "anexar o plano de trabalho");
  if (!preenchido(i.execucao?.plano_metas)) falta.push("descrever finalidade e metas");
  return { ok: falta.length === 0, falta };
}

export function avaliarArt7(i: EntradaConformidade): ItemConformidade[] {
  const { emenda: e, execucao: x, exercicio: ex } = i;
  const tipo = tipoDaEmenda(e);
  const iniciou = e.empenhado > 0 || e.pago > 0;
  const naoInformado = (t: string) => `informar ${t}`;
  const plano = planoEstaCompleto(i);
  const comDataTodas = i.movimentos.length > 0 && i.movimentos.every((m) => !!m.data);

  const item = (codigo: CodigoItem, nome: string, exigencia: string, ok: boolean, falta: string, aplica = true): ItemConformidade => ({
    codigo, nome, exigencia, aplica, ok: aplica ? ok : true, falta: aplica && !ok ? falta : undefined,
  });

  return [
    item("I", "Parlamentar", "Nome completo, partido e unidade parlamentar (art. 7º, I)", preenchido(i.partido) && preenchido(ex?.unidade_parlamentar),
      [!preenchido(i.partido) && "partido do vereador", !preenchido(ex?.unidade_parlamentar) && "unidade parlamentar (Câmara)"].filter(Boolean).join(" e ")),
    item("II", "Código e ato normativo", "Número da emenda vinculado à LOA/crédito que a aprovou (art. 7º, II)", preenchido(ex?.numero_lei_loa), naoInformado("o número da LOA no exercício")),
    item("III", "Objeto detalhado", "Descrição detalhada: ação, projeto ou atividade e finalidade (art. 7º, III)", e.descricao.trim().length >= 40 && e.objeto.trim().length >= 25, "descrever melhor o objeto e a finalidade"),
    item("IV", "Valor", "Valor alocado (art. 7º, IV)", e.valor > 0, naoInformado("o valor")),
    item("V", "Executor ou beneficiário", "Órgão/entidade executora ou beneficiário final (art. 7º, V)", !!e.secretaria_nome && (tipo === "direta" || !!e.beneficiario_nome), naoInformado("o beneficiário")),
    item("VI", "Localidade", "Município ou localidade beneficiada (art. 7º, VI)", preenchido(x?.localidade), naoInformado("a localidade beneficiada")),
    item("VII", "Cronograma", "Início e término previstos (art. 7º, VII)", (!!x?.inicio_previsto && !!x?.termino_previsto) || (!!x?.vigencia_inicio && !!x?.vigencia_fim), naoInformado("início e término previstos")),
    item("VIII", "Instrumentos e processo", "Convênio/termo/contrato e processo administrativo (art. 7º, VIII)",
      tipo === "direta" ? !!(x?.processo_id || preenchido(x?.processo_licitatorio)) : preenchido(x?.numero_termo) && !!(x?.processo_id || preenchido(x?.processo_licitatorio) || preenchido(x?.numero_contrato)),
      tipo === "direta" ? "vincular o processo do Compras" : "informar o termo e o processo administrativo", iniciou),
    item("IX", "Plano de Trabalho", "Plano de trabalho com objeto, metas, recursos, classificação e prazo (art. 7º, IX)", plano.ok, plano.falta.join("; ")),
    item("XI", "Recebedor e CNPJ", "Recebedor dos recursos e CNPJ (art. 7º, XI)", tipo === "direta" ? preenchido(ex?.municipio_cnpj) : preenchido(e.beneficiario_cnpj), tipo === "direta" ? "informar o CNPJ do Município" : "informar o CNPJ do beneficiário"),
    item("XII", "Município e CNPJ", "Município e CNPJ do recebedor (art. 7º, XII)", preenchido(ex?.municipio_cnpj) && preenchido(ex?.municipio_nome), "informar nome e CNPJ do Município no exercício"),
    item("XIII", "Datas de disponibilização", "Data(s) de disponibilização do recurso (art. 7º, XIII)", comDataTodas, "informar a data de cada empenho e pagamento", iniciou),
    item("XIV", "Gestor responsável", "Nome completo do gestor responsável (art. 7º, XIV)", preenchido(x?.gestor_pmc) && (tipo === "direta" || preenchido(x?.gestor_osc)),
      tipo === "direta" ? "informar o gestor na Prefeitura" : "informar o gestor na Prefeitura e na entidade"),
    item("XV", "GND", "Grupo de Natureza de Despesa (art. 7º, XV)", gndDaNatureza(e.natureza_despesa) !== null, "informar a natureza da despesa"),
    item("XVI", "Banco e conta", "Instituição bancária e número da conta (art. 7º, XVI)", preenchido(x?.conta_bancaria), "informar banco, agência e conta específica", tipo !== "direta"),
    item("XVII", "Anuência do SUS", "Anuência prévia do gestor do SUS, quando for o caso (art. 7º, XVII)", !!x?.anuencia_sus, "informar se houve anuência do SUS", e.saude),
    item("art5", "Identificador contábil", "Fonte de recurso ou código único da emenda (art. 5º)", preenchido(x?.identificador_contabil) || preenchido(x?.fonte_recurso), "informar o identificador/fonte de recurso da Contabilidade", iniciou),
  ];
}

export function faltas(itens: ItemConformidade[]): ItemConformidade[] {
  return itens.filter((i) => i.aplica && !i.ok);
}

// ----------------------------------------------------------- relatório de gestão

export type SituacaoRelatorio = { competencia: number; prazo: string; situacao: "entregue" | "vencido" | "a_vencer" };

/**
 * Relatório de gestão (IN art. 7º, X e § 1º): primeiro até 30/06 do ano seguinte ao recebimento dos recursos,
 * depois atualizado todo 30/06. Devolve as competências que merecem atenção (vencidas ou vencendo em até 60 dias).
 * `hoje` = AAAA-MM-DD. O recebimento é o primeiro pagamento com data.
 */
export function relatoriosDeGestao(
  movimentos: MovimentoConf[],
  documentos: DocumentoResumo[],
  hoje: string
): SituacaoRelatorio[] {
  const anosPagos = movimentos.filter((m) => m.tipo === "pagamento" && m.data).map((m) => Number((m.data as string).slice(0, 4)));
  if (anosPagos.length === 0) return [];
  const primeiro = Math.min(...anosPagos);
  const anoAtual = Number(hoje.slice(0, 4));
  const entregues = new Set(documentos.filter((d) => d.tipo === "relatorio_gestao").map((d) => d.competencia).filter((c): c is number => c !== null));
  const sem = documentos.some((d) => d.tipo === "relatorio_gestao" && d.competencia === null);
  const out: SituacaoRelatorio[] = [];
  for (let y = primeiro; y < anoAtual; y++) {
    const prazo = `${y + 1}-06-30`;
    if (entregues.has(y) || (sem && y === primeiro)) {
      continue;
    }
    if (hoje > prazo) out.push({ competencia: y, prazo, situacao: "vencido" });
    else if ((Date.parse(prazo) - Date.parse(hoje)) / 86_400_000 <= 60) out.push({ competencia: y, prazo, situacao: "a_vencer" });
  }
  return out;
}
