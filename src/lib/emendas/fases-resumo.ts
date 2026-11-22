import { brl } from "@/lib/emendas/regras";

/**
 * Leitura rápida do andamento: as fases do fluxo (8 a 12, com nomes que variam por tipo e pelo catálogo editável) viram no
 * máximo seis macro-etapas fixas — Planejamento, Formalização, Empenho, Pagamento, Execução e prestação e Encerramento —,
 * que cabem numa linha da lista, do painel e da caixa de andamento. O detalhe de cada fase continua na aba Fases.
 * Puro: classifica pelo NOME da fase (sem acento), então uma fase nova do catálogo cai em "Formalização" se não for reconhecida.
 */
export type EstadoFase = "feita" | "parcial" | "andamento" | "pendente";
export type FaseLinha = { nome: string; estado: EstadoFase; alerta: boolean };
export type ChaveMacro = "planejamento" | "formalizacao" | "empenho" | "pagamento" | "prestacao" | "encerramento";
export type MacroEtapa = { chave: ChaveMacro; nome: string; estado: EstadoFase; alerta: boolean; fases: FaseLinha[] };

const ORDEM: ChaveMacro[] = ["planejamento", "formalizacao", "empenho", "pagamento", "prestacao", "encerramento"];
export const NOME_MACRO: Record<ChaveMacro, string> = {
  planejamento: "Planejamento",
  formalizacao: "Formalização",
  empenho: "Empenho",
  pagamento: "Pagamento",
  prestacao: "Execução e prestação",
  encerramento: "Encerramento",
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function macroDaFase(nome: string): ChaveMacro {
  const n = semAcento(nome);
  if (/encerr|conclu/.test(n)) return "encerramento";
  if (/presta|execu|monitor/.test(n)) return "prestacao";
  if (/empenh/.test(n)) return "empenho";
  if (/pagament|liquida|repasse/.test(n)) return "pagamento";
  if (/\bloa\b|indicad|analis|viabil|exequib|parecer|demanda/.test(n)) return "planejamento";
  return "formalizacao";
}

function estadoDoGrupo(fases: FaseLinha[]): EstadoFase {
  if (fases.every((f) => f.estado === "feita")) return "feita";
  if (fases.every((f) => f.estado === "pendente")) return "pendente";
  return "andamento";
}

export function consolidarFases(fases: FaseLinha[]): MacroEtapa[] {
  const grupos = new Map<ChaveMacro, FaseLinha[]>();
  for (const f of fases) {
    const k = macroDaFase(f.nome);
    grupos.set(k, [...(grupos.get(k) ?? []), f]);
  }
  return ORDEM.filter((k) => grupos.has(k)).map((k) => {
    const lista = grupos.get(k)!;
    return { chave: k, nome: NOME_MACRO[k], estado: estadoDoGrupo(lista), alerta: lista.some((f) => f.alerta), fases: lista };
  });
}

/** Índice da primeira macro-etapa ainda não concluída (−1 se todas estão feitas). */
export function indiceDaProxima(macros: MacroEtapa[]): number {
  return macros.findIndex((m) => m.estado !== "feita");
}

export type AcaoPasso = "andamento" | "empenho" | "pagamento" | null;
export type PassoSeguinte = {
  titulo: string;
  texto: string;
  acao: AcaoPasso;
  rotuloAcao?: string;
  /** Atalho para uma aba do painel (ex.: ver o financeiro, ver os documentos). */
  atalho?: { rotulo: string; aba: "financeiro" | "documentacao" | "fases" | "pendencias" };
};

const CENTAVO = 0.005;

/** O que fazer agora com a emenda, a partir do dinheiro e das macro-etapas. Só orienta; quem decide é a pessoa. */
export function proximoPasso(
  e: { valor: number; empenhado: number; pago: number; situacao: string; impedimentos_abertos: number },
  macros: MacroEtapa[]
): PassoSeguinte {
  if (e.situacao === "cancelada") return { titulo: "Emenda cancelada", texto: "Não há próximo passo.", acao: null };
  if (e.impedimentos_abertos > 0) {
    return { titulo: "Emenda impedida", texto: "Há impedimento aberto (aviso acima). Resolva-o ou remaneje a emenda em Configurações.", acao: null };
  }
  if (e.empenhado > e.valor + CENTAVO) {
    return { titulo: `Empenho acima do valor da emenda: ${brl(e.empenhado - e.valor)}`, texto: "Informe a fonte de recurso que cobriu o excesso, na aba Financeiro.", acao: null, atalho: { rotulo: "Ver financeiro", aba: "financeiro" } };
  }
  if (e.empenhado > 0 && e.empenhado < e.valor - CENTAVO) {
    return {
      titulo: `Fechar o empenho: faltam ${brl(e.valor - e.empenhado)}`,
      texto: `Empenhado ${brl(e.empenhado)} de ${brl(e.valor)}. Se a diferença for saldo, registre-o no Financeiro; se for empenho, lance o complemento.`,
      acao: "empenho",
      rotuloAcao: "Lançar empenho",
      atalho: { rotulo: "Registrar saldo", aba: "financeiro" },
    };
  }
  if (e.empenhado > 0 && e.pago < e.empenhado - CENTAVO) {
    return {
      titulo: `Pagar: faltam ${brl(e.empenhado - e.pago)}`,
      texto: `Empenhado ${brl(e.empenhado)}, pago ${brl(e.pago)}.`,
      acao: "pagamento",
      rotuloAcao: "Lançar pagamento",
    };
  }
  const i = indiceDaProxima(macros);
  if (i < 0) return { titulo: macros.length ? "Todas as etapas concluídas" : "Sem fluxo de fases", texto: macros.length ? "Nada pendente no fluxo desta emenda." : "Esta emenda ainda não tem fases calculadas.", acao: null };
  const m = macros[i];
  const falta = m.fases.filter((f) => f.estado !== "feita").map((f) => f.nome);
  const doc = m.chave === "formalizacao";
  return {
    titulo: `Próximo: ${m.nome}`,
    texto: falta.length ? `Falta: ${falta.join(", ")}.` : "Registre o andamento quando concluir.",
    acao: m.chave === "empenho" ? "empenho" : "andamento",
    rotuloAcao: m.chave === "empenho" ? "Lançar empenho" : "Registrar andamento",
    atalho: doc ? { rotulo: "Ver documentos", aba: "documentacao" } : undefined,
  };
}
