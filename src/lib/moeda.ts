/** Formatação de dinheiro e percentual comum a todos os módulos (puro). */

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function brlCompleto(v: number): string {
  return BRL.format(v);
}

/** "R$ 5,16 mi" / "R$ 425 mil" — para KPIs e rótulos de barra. */
export function brlCurto(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) {
    return `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  }
  if (abs >= 1e3) return `R$ ${Math.round(v / 1e3).toLocaleString("pt-BR")} mil`;
  return BRL.format(v);
}

/** Fração (0–1) em percentual com `casas` decimais no máximo. */
export function pctDe(x: number, casas = 0): string {
  const v = Number.isFinite(x) ? x * 100 : 0;
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
}
