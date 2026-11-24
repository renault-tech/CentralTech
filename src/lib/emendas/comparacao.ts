/**
 * Comparação entre exercícios (anos). Pura: quem carrega os dados é a página. Enquanto só existe um exercício, nada
 * disto aparece com números; quando o seguinte for aberto (ex.: 2027), a tela compara sozinha com o anterior ou com o
 * ano escolhido em `?comparar=`.
 */
import type { EmendaResumo } from "@/types/emendas";

export type TotaisExercicio = {
  ano: number;
  n: number;
  valor: number;
  empenhado: number;
  pago: number;
  /** Valor indicado para a Saúde. */
  saude: number;
  /** Emendas que ainda estão na etapa inicial. */
  semAndamento: number;
};

export function totaisDoExercicio(ano: number, emendas: Pick<EmendaResumo, "valor" | "empenhado" | "pago" | "saude" | "etapa" | "situacao">[]): TotaisExercicio {
  const t: TotaisExercicio = { ano, n: 0, valor: 0, empenhado: 0, pago: 0, saude: 0, semAndamento: 0 };
  for (const e of emendas) {
    if (e.situacao === "cancelada") continue;
    t.n += 1;
    t.valor += e.valor;
    t.empenhado += e.empenhado;
    t.pago += e.pago;
    if (e.saude) t.saude += e.valor;
    if (e.etapa === "indicada") t.semAndamento += 1;
  }
  return t;
}

export type Variacao = {
  /** atual − anterior (em pontos percentuais quando o indicador já é um percentual). */
  diferenca: number;
  /** Variação relativa (0,12 = +12%); nula quando não há base de comparação. */
  relativa: number | null;
  sentido: "alta" | "queda" | "igual" | "sem_base";
};

export function variacao(atual: number, anterior: number, emPontos = false): Variacao {
  const diferenca = atual - anterior;
  const igual = Math.abs(diferenca) < (emPontos ? 0.0005 : 0.005);
  if (igual) return { diferenca: 0, relativa: 0, sentido: "igual" };
  if (!emPontos && anterior === 0) return { diferenca, relativa: null, sentido: "sem_base" };
  return { diferenca, relativa: emPontos || anterior === 0 ? null : diferenca / Math.abs(anterior), sentido: diferenca > 0 ? "alta" : "queda" };
}

export type LinhaComparacao = {
  chave: string;
  rotulo: string;
  formato: "inteiro" | "moeda" | "percentual";
  atual: number;
  anterior: number;
  variacao: Variacao;
  /** O que é bom: subir, cair ou nenhum dos dois (só informa). */
  bomQuando: "alta" | "queda" | "neutro";
};

const razao = (a: number, b: number) => (b > 0 ? a / b : 0);

export function compararExercicios(a: TotaisExercicio, b: TotaisExercicio): LinhaComparacao[] {
  const l = (chave: string, rotulo: string, formato: LinhaComparacao["formato"], atual: number, anterior: number, bomQuando: LinhaComparacao["bomQuando"]): LinhaComparacao => ({
    chave,
    rotulo,
    formato,
    atual,
    anterior,
    variacao: variacao(atual, anterior, formato === "percentual"),
    bomQuando,
  });
  return [
    l("n", "Emendas", "inteiro", a.n, b.n, "neutro"),
    l("valor", "Valor indicado", "moeda", a.valor, b.valor, "neutro"),
    l("empenhado", "Empenhado", "moeda", a.empenhado, b.empenhado, "alta"),
    l("pago", "Pago", "moeda", a.pago, b.pago, "alta"),
    l("pct_pago", "Pago sobre o indicado", "percentual", razao(a.pago, a.valor), razao(b.pago, b.valor), "alta"),
    l("pct_saude", "Parte na Saúde", "percentual", razao(a.saude, a.valor), razao(b.saude, b.valor), "neutro"),
    l("sem_andamento", "Sem andamento", "inteiro", a.semAndamento, b.semAndamento, "queda"),
  ];
}

/** Pago acumulado até o mês/dia (MM-DD) do ano: base do "mesmo período" (um ano em curso não se compara com um ano inteiro). */
export function pagoAte(pagamentos: { data: string | null; valor: number }[], ano: number, mesDia: string): number {
  const limite = `${ano}-${mesDia}`;
  let s = 0;
  for (const p of pagamentos) if (p.data && p.data.startsWith(`${ano}-`) && p.data <= limite) s += p.valor;
  return s;
}

/** Pago acumulado mês a mês, em fração do valor indicado (0..1): torna anos de tamanhos diferentes comparáveis. */
export function curvaPercentual(pagamentos: { data: string | null; valor: number }[], ano: number, indicado: number): number[] {
  const porMes = new Array(12).fill(0) as number[];
  for (const p of pagamentos) {
    if (!p.data) continue;
    const [a, m] = p.data.split("-").map(Number);
    if (a === ano && m >= 1 && m <= 12) porMes[m - 1] += p.valor;
  }
  let ac = 0;
  return porMes.map((v) => {
    ac += v;
    return indicado > 0 ? Math.min(1, ac / indicado) : 0;
  });
}

/** Exercício com que comparar: o pedido (se existir e for outro), senão o imediatamente anterior. */
export function anoParaComparar(atual: number, anos: number[], pedido?: string | null): number | null {
  const p = Number(pedido);
  if (Number.isInteger(p) && p !== atual && anos.includes(p)) return p;
  const anteriores = anos.filter((a) => a < atual).sort((x, y) => y - x);
  return anteriores[0] ?? null;
}
