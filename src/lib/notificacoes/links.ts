import { MODULOS } from "@/lib/modulos-info";
import type { AppNotificacao } from "@/types/database";

/**
 * Para onde um aviso leva, a partir da Central. Central e Emendas moram aqui
 * (caminho direto). Os apps externos passam pelo SSO silencioso, que abre o
 * app já autenticado e no ponto certo (`proximo`).
 */
export function destinoDoAviso(app: AppNotificacao, link: string | null): string {
  if (app === "hub" || (app !== "compras" && app !== "numera" && app !== "requerimentos" && MODULOS[app]?.interno)) {
    return link ?? "/";
  }
  const proximo = link ? `&proximo=${encodeURIComponent(link)}` : "";
  return `/sso/silencioso?app=${app}${proximo}`;
}

export const NOME_APP_AVISO: Record<AppNotificacao, string> = {
  hub: "Central",
  compras: MODULOS.compras.nomeCurto,
  numera: MODULOS.numera.nomeCurto,
  requerimentos: MODULOS.requerimentos.nomeCurto,
  emendas: MODULOS.emendas.nomeCurto,
};

export const COR_APP_AVISO: Record<AppNotificacao, string> = {
  hub: "#E9A63B",
  compras: "#0D9488",
  numera: MODULOS.numera.cor,
  requerimentos: MODULOS.requerimentos.cor,
  emendas: MODULOS.emendas.cor,
};
