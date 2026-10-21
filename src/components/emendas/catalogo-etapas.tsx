"use client";

import * as React from "react";

import { CATALOGO_PADRAO, type CatalogoEtapas } from "@/lib/emendas/regras";

const Contexto = React.createContext<CatalogoEtapas>(CATALOGO_PADRAO);

/** Leva as fases/fluxos (editáveis em Configurações → Fases) do servidor
 * para os componentes de cliente do módulo. */
export function ProvedorCatalogo({ catalogo, children }: { catalogo: CatalogoEtapas; children: React.ReactNode }) {
  return <Contexto.Provider value={catalogo}>{children}</Contexto.Provider>;
}

export function useCatalogo(): CatalogoEtapas {
  return React.useContext(Contexto);
}
