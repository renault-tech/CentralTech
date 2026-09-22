"use client";

import * as React from "react";

/** Mesmo breakpoint do `md:` do Tailwind. */
const CONSULTA_DESKTOP = "(min-width: 768px)";

function assinarBreakpointDesktop(callback: () => void) {
  const consulta = window.matchMedia(CONSULTA_DESKTOP);
  consulta.addEventListener("change", callback);
  return () => consulta.removeEventListener("change", callback);
}

/**
 * `true` a partir do breakpoint `md:` (768px) do Tailwind — para decidir
 * entre montar a vista de tabela (desktop) ou de cartões (mobile) sem
 * montar as duas ao mesmo tempo (dobraria o trabalho de render a cada
 * atualização da lista). `useSyncExternalStore` em vez de `useState` +
 * `useEffect` com listener de resize: o servidor sempre entrega "desktop"
 * (só o cliente sabe o breakpoint real) e o navegador relê o valor certo
 * ao montar, sem cascata de render nem violar a regra
 * `react-hooks/set-state-in-effect`. Extraído de `painel-processos.tsx`
 * (primeiro uso) para não duplicar em `painel-contratos.tsx`.
 */
export function useEhDesktop(): boolean {
  return React.useSyncExternalStore(
    assinarBreakpointDesktop,
    () => window.matchMedia(CONSULTA_DESKTOP).matches,
    () => true
  );
}
