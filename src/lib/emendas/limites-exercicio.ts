/**
 * Limites legais do exercício (puro e testado). Os percentuais valem sobre a RCL (receita corrente líquida):
 * `percentual_rcl` = teto das emendas, `restos_teto_pct` = máximo que pode ficar em restos a pagar.
 * A RCL TEM de ser informada (ela não se deduz do valor aprovado: a Câmara pode aprovar acima do teto);
 * um valor manual em R$ de restos a pagar substitui o percentual.
 */
export type EntradaLimites = {
  rcl: number | null;
  percentualTeto: number | null;
  percentualRestos: number | null;
  restosValorManual: number | null;
  aprovadoLoa: number | null;
  /** Soma das emendas não canceladas (a planilha importada). */
  somaEmendas: number;
};

export type LimitesExercicio = {
  /** Valor aprovado usado como referência: o da lei, se informado, senão a soma das emendas. */
  aprovadoReferencia: number;
  aprovadoOrigem: "lei" | "emendas";
  /** RCL informada (base dos percentuais); nula = ainda não informada. */
  baseRcl: number | null;
  /** Teto das emendas em R$ (percentual × RCL). */
  tetoValor: number | null;
  /** Texto curto do teto, ex.: "2% da RCL". */
  tetoDescricao: string | null;
  /** Máximo em restos a pagar em R$ (manual, ou percentual × RCL). */
  restosTeto: number | null;
  restosOrigem: "manual" | "percentual" | null;
  /** Texto curto de onde veio o limite de restos, para a tela. */
  restosDescricao: string | null;
  /** O quanto o valor aprovado passa do teto (0 = dentro); nulo sem RCL. */
  acimaDoTeto: number | null;
};

const positivo = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const casas = (v: number) => Math.round(v * 100) / 100;
const pctTexto = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;

export function calcularLimites(e: EntradaLimites): LimitesExercicio {
  const aprovadoOrigem = positivo(e.aprovadoLoa) ? "lei" : "emendas";
  const aprovadoReferencia = positivo(e.aprovadoLoa) ? e.aprovadoLoa : e.somaEmendas;

  const baseRcl = positivo(e.rcl) ? e.rcl : null;
  const tetoValor = baseRcl != null && positivo(e.percentualTeto) ? casas(baseRcl * (e.percentualTeto / 100)) : null;
  const tetoDescricao = tetoValor != null && positivo(e.percentualTeto) ? `${pctTexto(e.percentualTeto)} da RCL` : null;

  let restosTeto: number | null = null;
  let restosOrigem: LimitesExercicio["restosOrigem"] = null;
  let restosDescricao: string | null = null;
  if (typeof e.restosValorManual === "number" && e.restosValorManual >= 0) {
    restosTeto = casas(e.restosValorManual);
    restosOrigem = "manual";
    restosDescricao = "valor informado";
  } else if (baseRcl != null && typeof e.percentualRestos === "number" && e.percentualRestos >= 0) {
    restosTeto = casas(baseRcl * (e.percentualRestos / 100));
    restosOrigem = "percentual";
    restosDescricao = `${pctTexto(e.percentualRestos)} da RCL`;
  }

  const acimaDoTeto = tetoValor != null ? casas(Math.max(0, aprovadoReferencia - tetoValor)) : null;

  return { aprovadoReferencia, aprovadoOrigem, baseRcl, tetoValor, tetoDescricao, restosTeto, restosOrigem, restosDescricao, acimaDoTeto };
}
