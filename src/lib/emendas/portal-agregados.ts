import type { LinhaPortal } from "@/lib/emendas/portal-tipos";
import type { TipoExecucao } from "@/types/emendas";

/**
 * Cálculos do painel público (puros, rodam no navegador sobre as emendas já recebidas).
 * Tudo que o painel mostra sai daqui, para os números de todos os gráficos baterem entre si.
 */

export type SituacaoPublica = "paga" | "parcial" | "empenhada" | "aguardando" | "impedida";

export const SITUACOES_PUBLICAS: { chave: SituacaoPublica; nome: string; explicacao: string }[] = [
  { chave: "paga", nome: "Paga", explicacao: "Todo o valor indicado já foi pago." },
  { chave: "parcial", nome: "Pagamento parcial", explicacao: "Parte do valor já foi paga; o restante está em execução." },
  { chave: "empenhada", nome: "Empenhada", explicacao: "O valor foi reservado (empenhado) e aguarda a entrega ou o pagamento." },
  { chave: "aguardando", nome: "Aguardando empenho", explicacao: "Ainda em preparação: plano de trabalho, documentação ou processo de compra." },
  { chave: "impedida", nome: "Com impedimento", explicacao: "Execução suspensa por impedimento técnico, legal ou de documentação." },
];

const TOL = 0.005;

export function situacaoPublica(l: Pick<LinhaPortal, "valor" | "pago" | "empenhado" | "situacao">): SituacaoPublica {
  if (l.situacao === "impedida") return "impedida";
  if (l.valor > 0 && l.pago >= l.valor - TOL) return "paga";
  if (l.pago > TOL) return "parcial";
  if (l.empenhado > TOL) return "empenhada";
  return "aguardando";
}

/** Três partes que somam o valor indicado: pago, empenhado ainda não pago, ainda não empenhado. */
export type Partes = { pago: number; aPagar: number; aEmpenhar: number; total: number };

export function partes(l: Pick<LinhaPortal, "valor" | "pago" | "empenhado">): Partes {
  const total = Math.max(l.valor, 0);
  const pago = Math.min(Math.max(l.pago, 0), total);
  const empenhado = Math.min(Math.max(l.empenhado, pago), total);
  return { pago, aPagar: empenhado - pago, aEmpenhar: total - empenhado, total };
}

function somar(a: Partes, b: Partes): Partes {
  return { pago: a.pago + b.pago, aPagar: a.aPagar + b.aPagar, aEmpenhar: a.aEmpenhar + b.aEmpenhar, total: a.total + b.total };
}
const ZERO: Partes = { pago: 0, aPagar: 0, aEmpenhar: 0, total: 0 };

export type Totais = Partes & { quantidade: number; saude: number; porSituacao: Record<SituacaoPublica, { quantidade: number; valor: number }> };

export function totais(linhas: LinhaPortal[]): Totais {
  const porSituacao = Object.fromEntries(SITUACOES_PUBLICAS.map((s) => [s.chave, { quantidade: 0, valor: 0 }])) as Totais["porSituacao"];
  let p = ZERO;
  let saude = 0;
  for (const l of linhas) {
    p = somar(p, partes(l));
    if (l.saude) saude += l.valor;
    const s = porSituacao[situacaoPublica(l)];
    s.quantidade += 1;
    s.valor += l.valor;
  }
  return { ...p, quantidade: linhas.length, saude, porSituacao };
}

export type Grupo = Partes & { chave: string; nome: string; quantidade: number; detalhe?: string | null };

/** Agrupa por uma chave (vereador, secretaria, tipo…), do maior valor para o menor. */
export function agrupar(linhas: LinhaPortal[], chave: (l: LinhaPortal) => string, detalhe?: (l: LinhaPortal) => string | null): Grupo[] {
  const m = new Map<string, Grupo>();
  for (const l of linhas) {
    const k = chave(l);
    const g = m.get(k) ?? { ...ZERO, chave: k, nome: k, quantidade: 0, detalhe: detalhe?.(l) ?? null };
    m.set(k, { ...g, ...somar(g, partes(l)), quantidade: g.quantidade + 1 });
  }
  return [...m.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function porTipo(linhas: LinhaPortal[]): Record<TipoExecucao, Grupo> {
  const base = (t: TipoExecucao): Grupo => ({ ...ZERO, chave: t, nome: t, quantidade: 0 });
  const r = { direta: base("direta"), osc: base("osc"), ente: base("ente") };
  for (const g of agrupar(linhas, (l) => l.tipo)) r[g.chave as TipoExecucao] = g;
  return r;
}

/** Pagamentos por mês (líquidos de anulação de pagamento não existem: anulação abate empenho). Acumulado para a curva. */
export type PontoMes = { mes: number; pago: number; acumulado: number; quantidade: number };

export function pagamentosPorMes(linhas: LinhaPortal[], ano: number): { pontos: PontoMes[]; semData: number } {
  const porMes = Array.from({ length: 12 }, () => ({ pago: 0, quantidade: 0 }));
  let semData = 0;
  let foraDoAno = 0;
  for (const l of linhas) {
    for (const m of l.movimentos) {
      if (m.tipo !== "pagamento") continue;
      if (!m.data) {
        semData += m.valor;
        continue;
      }
      const [a, mes] = m.data.split("-").map(Number);
      if (a !== ano) {
        foraDoAno += m.valor;
        continue;
      }
      porMes[mes - 1].pago += m.valor;
      porMes[mes - 1].quantidade += 1;
    }
  }
  let acc = 0;
  const pontos = porMes.map((p, i) => {
    acc += p.pago;
    return { mes: i + 1, pago: p.pago, acumulado: acc, quantidade: p.quantidade };
  });
  return { pontos, semData: semData + foraDoAno };
}

export const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type Filtros = {
  busca: string;
  vereador: string;
  secretaria: string;
  tipo: string;
  situacao: string;
  area: string; // "" | "saude" | "demais"
};

export const FILTROS_VAZIOS: Filtros = { busca: "", vereador: "", secretaria: "", tipo: "", situacao: "", area: "" };

export function filtrar(linhas: LinhaPortal[], f: Filtros): LinhaPortal[] {
  const termos = norm(f.busca.trim()).split(/\s+/).filter(Boolean);
  return linhas.filter(
    (l) =>
      (!f.vereador || l.vereador === f.vereador) &&
      (!f.secretaria || l.secretaria === f.secretaria) &&
      (!f.tipo || l.tipo === f.tipo) &&
      (!f.situacao || situacaoPublica(l) === f.situacao) &&
      (!f.area || (f.area === "saude" ? l.saude : !l.saude)) &&
      (termos.length === 0 ||
        termos.every((t) => norm([l.numero, l.objeto, l.descricao, l.beneficiario ?? "", l.vereador, l.secretaria, l.localidade ?? ""].join(" ")).includes(t)))
  );
}

export type Ordem = "valor_desc" | "valor_asc" | "pago_desc" | "pendente_desc" | "numero" | "vereador";

export const ORDENS: { chave: Ordem; nome: string }[] = [
  { chave: "valor_desc", nome: "Maior valor" },
  { chave: "valor_asc", nome: "Menor valor" },
  { chave: "pendente_desc", nome: "Maior valor a pagar" },
  { chave: "pago_desc", nome: "Mais pago (%)" },
  { chave: "numero", nome: "Número da emenda" },
  { chave: "vereador", nome: "Vereador (A–Z)" },
];

export function ordenar(linhas: LinhaPortal[], ordem: Ordem): LinhaPortal[] {
  const r = [...linhas];
  const pctPago = (l: LinhaPortal) => (l.valor > 0 ? l.pago / l.valor : 0);
  const cmp: Record<Ordem, (a: LinhaPortal, b: LinhaPortal) => number> = {
    valor_desc: (a, b) => b.valor - a.valor || a.numero - b.numero,
    valor_asc: (a, b) => a.valor - b.valor || a.numero - b.numero,
    pago_desc: (a, b) => pctPago(b) - pctPago(a) || b.valor - a.valor,
    pendente_desc: (a, b) => b.valor - b.pago - (a.valor - a.pago) || a.numero - b.numero,
    numero: (a, b) => a.numero - b.numero,
    vereador: (a, b) => a.vereador.localeCompare(b.vereador, "pt-BR") || a.numero - b.numero,
  };
  return r.sort(cmp[ordem]);
}
