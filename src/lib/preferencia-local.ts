"use client";

import * as React from "react";

/**
 * Preferências de interface persistidas em localStorage (sidebar recolhida,
 * zoom, modo e opções do chat).
 *
 * Usa `useSyncExternalStore` em vez de `setState` num effect: assim o
 * servidor renderiza o padrão e o cliente relê o valor real ao montar, sem
 * cascata de renders e sem violar a regra `react-hooks/set-state-in-effect`.
 */

function assinarPreferencias(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function notificar(chave: string) {
  // O evento `storage` nativo só dispara em OUTRAS abas; disparamos um
  // sintético para notificar os assinantes desta mesma aba.
  window.dispatchEvent(new StorageEvent("storage", { key: chave }));
}

/** Preferência de texto livre. `padrao` é o valor usado no servidor e antes de hidratar. */
export function usePreferenciaLocal(chave: string, padrao: string) {
  const valor = React.useSyncExternalStore(
    assinarPreferencias,
    () => window.localStorage.getItem(chave) ?? padrao,
    () => padrao
  );

  const definir = React.useCallback(
    (novo: string) => {
      window.localStorage.setItem(chave, novo);
      notificar(chave);
    },
    [chave]
  );

  return [valor, definir] as const;
}

/** Açúcar para preferências liga/desliga (guardadas como "1"/"0"). */
export function usePreferenciaBooleana(chave: string, padrao: boolean) {
  const [valor, definir] = usePreferenciaLocal(chave, padrao ? "1" : "0");
  const definirBool = React.useCallback(
    (novo: boolean) => definir(novo ? "1" : "0"),
    [definir]
  );
  return [valor === "1", definirBool] as const;
}
