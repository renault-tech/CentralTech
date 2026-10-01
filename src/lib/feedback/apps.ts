import type { AppFeedback, StatusFeedback, TipoFeedback } from "@/types/database";

/**
 * Identidade de cada app na gestão de feedback. REGRA PARA OS PRÓXIMOS
 * APPS: (1) uma linha em `hub.apps_feedback` (slug/nome/cor), (2) uma
 * entrada aqui com a MESMA cor, (3) o botão de megafone do app novo manda
 * seu próprio slug. Nada mais muda na tela de gestão.
 * `cor` = preenchimento/borda; `corTexto` passa de 4,5:1 sobre branco.
 */
export const APPS_FEEDBACK: Record<AppFeedback, { nome: string; cor: string; corTexto: string }> = {
  compras: { nome: "Compras", cor: "#0C1D33", corTexto: "#0C1D33" },
  requerimentos: { nome: "Requerimentos", cor: "#C63B22", corTexto: "#C63B22" },
  numera: { nome: "Numera", cor: "#0071e3", corTexto: "#0058B0" },
  hub: { nome: "Central Cataguases", cor: "#E9A63B", corTexto: "#8A5E00" },
};

export const ORDEM_APPS: AppFeedback[] = ["compras", "requerimentos", "numera", "hub"];

export const ROTULO_TIPO: Record<TipoFeedback, string> = { suporte: "Suporte", sugestao: "Sugestão" };

export const ROTULO_STATUS: Record<StatusFeedback, string> = {
  novo: "Novo",
  lido: "Em análise",
  resolvido: "Resolvido",
  nao_possivel: "Não possível",
};
