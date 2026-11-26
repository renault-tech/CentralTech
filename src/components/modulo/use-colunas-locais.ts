"use client";

import * as React from "react";

/**
 * Colunas que a pessoa escondeu na exportação de uma tela, guardadas neste navegador (`localStorage[chave]`).
 * Devolve a lista, o gravador e o trecho `&sem=A|B` para acrescentar às URLs de exportação.
 */
export function useColunasLocais(chave: string, validas: string[]) {
  const bruto = React.useSyncExternalStore(
    (f) => {
      window.addEventListener("storage", f);
      window.addEventListener("colunas-locais", f);
      return () => {
        window.removeEventListener("storage", f);
        window.removeEventListener("colunas-locais", f);
      };
    },
    () => {
      try {
        return localStorage.getItem(chave) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]"
  );
  const ocultas = React.useMemo(() => {
    try {
      const l = JSON.parse(bruto);
      return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string" && validas.includes(x)) : [];
    } catch {
      return [];
    }
  }, [bruto, validas]);
  const guardar = React.useCallback(
    (l: string[]) => {
      try {
        localStorage.setItem(chave, JSON.stringify(l));
      } catch {
        /* vale só nesta visita */
      }
      window.dispatchEvent(new Event("colunas-locais"));
    },
    [chave]
  );
  const sem = ocultas.length ? `&sem=${encodeURIComponent(ocultas.join("|"))}` : "";
  return { ocultas, guardar, sem };
}
