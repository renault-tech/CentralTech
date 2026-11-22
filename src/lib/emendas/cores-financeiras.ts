/**
 * Paleta do dinheiro, a mesma em todo o módulo (barras, caixa do andamento, gráficos de situação financeira, indicadores).
 * O violeta fica só para a marca do módulo e para a seleção; nunca para um valor.
 */
export const COR_DINHEIRO = {
  /** Valor indicado: cinza-azulado. */
  indicado: "#64748B",
  empenhado: "#2563EB",
  pago: "#059669",
  aPagar: "#D97706",
  /** Valor ainda não empenhado: o cinza-azulado mais claro. */
  semEmpenhar: "#94A3B8",
  pendencia: "#B91C1C",
} as const;
