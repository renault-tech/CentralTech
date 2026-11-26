/**
 * Limites legais do exercício (puro e testado). Os percentuais valem sobre a RCL (receita corrente líquida):
 * `percentual_rcl` = teto das emendas, `restos_teto_pct` = máximo que pode ficar em restos a pagar.
 * Sem a RCL informada, ela é deduzida do valor aprovado ÷ percentual do teto (marcada como derivada, para o gestor
 * conferir); um valor manual em R$ de restos a pagar substitui o percentual.
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
  /** RCL usada nas contas (informada ou deduzida). */
  baseRcl: number | null;
  baseDerivada: boolean;
  /** Teto das emendas em R$ (percentual × RCL). */
  tetoValor: number | null;
  /** Máximo em restos a pagar em R$ (manual, ou percentual × RCL). */
  restosTeto: number | null;
  restosOrigem: "manual" | "percentual" | null;
  /** Texto curto de onde veio o limite de restos, para a tela. */
  restosDescricao: string | null;
  /** Só com RCL informada: o quanto as emendas passam do teto (0 = dentro). */
  acimaDoTeto: number | null;
};

const positivo = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const casas = (v: number) => Math.round(v * 100) / 100;
const pctTexto = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;

export function calcularLimites(e: EntradaLimites): LimitesExercicio {
  const aprovadoOrigem = positivo(e.aprovadoLoa) ? "lei" : "emendas";
  const aprovadoReferencia = positivo(e.aprovadoLoa) ? e.aprovadoLoa : e.somaEmendas;

  let baseRcl: number | null = null;
  let baseDerivada = false;
  if (positivo(e.rcl)) baseRcl = e.rcl;
  else if (positivo(e.percentualTeto) && aprovadoReferencia > 0) {
    baseRcl = casas(aprovadoReferencia / (e.percentualTeto / 100));
    baseDerivada = true;
  }

  const tetoValor = baseRcl != null && positivo(e.percentualTeto) ? casas(baseRcl * (e.percentualTeto / 100)) : null;

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
    restosDescricao = `${pctTexto(e.percentualRestos)} da RCL${baseDerivada ? " (RCL deduzida do aprovado)" : ""}`;
  }

  const acimaDoTeto = !baseDerivada && tetoValor != null ? casas(Math.max(0, aprovadoReferencia - tetoValor)) : null;

  return { aprovadoReferencia, aprovadoOrigem, baseRcl, baseDerivada, tetoValor, restosTeto, restosOrigem, restosDescricao, acimaDoTeto };
}
