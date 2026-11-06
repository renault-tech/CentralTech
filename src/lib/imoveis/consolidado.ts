import { analisarConsumo, type Anomalia } from "@/lib/imoveis/regras";
import type { Conta, Imovel, ParametrosImoveis, TipoUnidade, Unidade } from "@/types/imoveis";

export type LinhaConsolidada = {
  unidade: Unidade;
  imovel: Imovel;
  conta: Conta | null;
  anomalias: Anomalia[];
  /** Variação do consumo sobre a média dos meses anteriores (null sem base). */
  variacao: number | null;
};

/** Uma linha por unidade do tipo pedido, com a conta do mês de referência e as anomalias dela. Função pura, testada. */
export function linhasConsolidadas(tipo: TipoUnidade, referencia: string, imoveis: Imovel[], unidades: Unidade[], contas: Conta[], par: ParametrosImoveis): LinhaConsolidada[] {
  const imovelDe = new Map(imoveis.map((i) => [i.id, i]));
  const un = tipo === "agua" ? "m³" : "kWh";
  return unidades
    .filter((u) => u.tipo === tipo && imovelDe.has(u.imovel_id))
    .map((u) => {
      const cs = contas.filter((c) => c.unidade_id === u.id && c.referencia <= referencia);
      const historico = cs.map((c) => ({ referencia: c.referencia, consumo: c.consumo, valor: c.valor }));
      const conta = cs.find((c) => c.referencia === referencia) ?? null;
      const anomalias = conta ? analisarConsumo(historico, par, un) : [];
      const prev = cs.filter((c) => c.referencia < referencia && (c.consumo ?? 0) > 0).sort((a, b) => b.referencia.localeCompare(a.referencia)).slice(0, par.meses_media);
      const media = prev.length >= 3 ? prev.reduce((a, c) => a + (c.consumo ?? 0), 0) / prev.length : null;
      const variacao = conta?.consumo != null && media ? (conta.consumo / media - 1) * 100 : null;
      return { unidade: u, imovel: imovelDe.get(u.imovel_id)!, conta, anomalias, variacao };
    });
}
