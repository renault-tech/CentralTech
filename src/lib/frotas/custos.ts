/**
 * Manutenção × valor do veículo na FIPE — funções puras sobre as listas que a RLS liberou.
 * Diferente de `custoPorVeiculo` (só os últimos 12 meses, só quem já tem valor), aqui o período é
 * escolhido, o gasto vem ano a ano e quem ainda não tem valor FIPE aparece à parte, com o gasto.
 */

import { chaveTexto } from "@/lib/frotas/importacao/normalizar";
import { custoManutencao, dataDoCusto, nivelPorPercentual, subtrairMeses, type NivelAlerta } from "@/lib/frotas/regras";
import type { Manutencao, ParametrosFrotas, Veiculo } from "@/types/frotas";

export type PeriodoCusto = "12m" | "24m" | "ano" | "tudo";

export const ROTULO_PERIODO: Record<PeriodoCusto, string> = {
  "12m": "Últimos 12 meses",
  "24m": "Últimos 24 meses",
  ano: "Ano atual",
  tudo: "Todo o histórico",
};

export function periodoValido(v: string | undefined): PeriodoCusto {
  return v === "24m" || v === "ano" || v === "tudo" ? v : "12m";
}

/** Data inicial (AAAA-MM-DD) do período, ou null para "tudo". */
export function inicioDoPeriodo(periodo: PeriodoCusto, hoje: string): string | null {
  if (periodo === "tudo") return null;
  if (periodo === "ano") return `${hoje.slice(0, 4)}-01-01`;
  return subtrairMeses(hoje, periodo === "24m" ? 24 : 12);
}

export type LinhaCustoFipe = {
  veiculo: Veiculo;
  /** Valor na FIPE (ou digitado), null quando ainda não há. */
  valor: number | null;
  custoPeriodo: number;
  custoTotal: number;
  servicos: number;
  ultimaData: string | null;
  /** Gasto por ano civil (todos os anos com serviço, do mais novo ao mais antigo). */
  porAno: { ano: string; valor: number }[];
  /** Gasto do período como % do valor; null sem valor. */
  pctPeriodo: number | null;
  /** Gasto acumulado como % do valor; null sem valor. */
  pctTotal: number | null;
  nivel: NivelAlerta;
};

export type ResumoCustos = {
  gastoPeriodo: number;
  valorFrota: number;
  pctFrota: number | null;
  veiculosComGasto: number;
  atencao: number;
  critico: number;
  semValor: number;
  gastoSemValor: number;
};

export type EntradaCustos = {
  hoje: string;
  veiculos: Veiculo[];
  manutencoes: Manutencao[];
  params: Pick<ParametrosFrotas, "pct_atencao" | "pct_critico">;
  periodo: PeriodoCusto;
};

export function custosFipe({ hoje, veiculos, manutencoes, params, periodo }: EntradaCustos): { linhas: LinhaCustoFipe[]; resumo: ResumoCustos } {
  const inicio = inicioDoPeriodo(periodo, hoje);
  type Acc = { total: number; periodo: number; n: number; ultima: string | null; anos: Map<string, number> };
  const acc = new Map<string, Acc>();
  for (const m of manutencoes) {
    const custo = custoManutencao(m);
    if (custo === null) continue;
    const data = dataDoCusto(m);
    const a = acc.get(m.veiculo_id) ?? { total: 0, periodo: 0, n: 0, ultima: null, anos: new Map() };
    a.total += custo;
    a.n += 1;
    if (!inicio || data >= inicio) a.periodo += custo;
    if (!a.ultima || data > a.ultima) a.ultima = data;
    const ano = data.slice(0, 4);
    a.anos.set(ano, (a.anos.get(ano) ?? 0) + custo);
    acc.set(m.veiculo_id, a);
  }

  const linhas: LinhaCustoFipe[] = [];
  for (const v of veiculos) {
    const a = acc.get(v.id);
    if (!a) continue;
    const valor = v.vinculo !== "alugado" && v.valor_referencia && v.valor_referencia > 0 ? v.valor_referencia : null;
    const pctPeriodo = valor ? (a.periodo / valor) * 100 : null;
    linhas.push({
      veiculo: v,
      valor,
      custoPeriodo: a.periodo,
      custoTotal: a.total,
      servicos: a.n,
      ultimaData: a.ultima,
      porAno: [...a.anos.entries()].sort((x, y) => y[0].localeCompare(x[0])).map(([ano, v2]) => ({ ano, valor: v2 })),
      pctPeriodo,
      pctTotal: valor ? (a.total / valor) * 100 : null,
      nivel: pctPeriodo === null ? "ok" : nivelPorPercentual(pctPeriodo, params),
    });
  }

  const comValor = linhas.filter((l) => l.valor !== null);
  const gastoComValor = comValor.reduce((s, l) => s + l.custoPeriodo, 0);
  const valorFrota = comValor.reduce((s, l) => s + (l.valor ?? 0), 0);
  const semValor = linhas.filter((l) => l.valor === null);
  const resumo: ResumoCustos = {
    gastoPeriodo: linhas.reduce((s, l) => s + l.custoPeriodo, 0),
    valorFrota,
    pctFrota: valorFrota > 0 ? (gastoComValor / valorFrota) * 100 : null,
    veiculosComGasto: linhas.filter((l) => l.custoPeriodo > 0).length,
    atencao: comValor.filter((l) => l.nivel === "atencao").length,
    critico: comValor.filter((l) => l.nivel === "critico").length,
    semValor: semValor.length,
    gastoSemValor: semValor.reduce((s, l) => s + l.custoPeriodo, 0),
  };
  return { linhas, resumo };
}

export type FiltroCustos = { q?: string; secretaria?: string; nivel?: "ok" | "atencao" | "critico" | "sem_valor" };

/** Filtra e ordena: com valor primeiro, pelo % do período (maior primeiro); sem valor depois, pelo gasto. */
export function filtrarCustos(linhas: LinhaCustoFipe[], f: FiltroCustos): LinhaCustoFipe[] {
  const busca = chaveTexto(f.q ?? "");
  return linhas
    .filter((l) => {
      if (f.secretaria && l.veiculo.secretaria_id !== f.secretaria) return false;
      if (f.nivel === "sem_valor") return l.valor === null;
      if (f.nivel && (l.valor === null || l.nivel !== f.nivel)) return false;
      if (busca && !chaveTexto([l.veiculo.placa, l.veiculo.modelo, l.veiculo.marca, l.veiculo.patrimonio].join(" ")).includes(busca)) return false;
      return true;
    })
    .sort((a, b) => {
      if ((a.valor === null) !== (b.valor === null)) return a.valor === null ? 1 : -1;
      if (a.pctPeriodo !== null && b.pctPeriodo !== null) return b.pctPeriodo - a.pctPeriodo;
      return b.custoPeriodo - a.custoPeriodo;
    });
}
