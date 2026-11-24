"use client";

import * as React from "react";

function assinar(aviso: () => void) {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
}

/** `true` enquanto o navegador diz que há conexão. No servidor (e na primeira pintura) assume que há. */
export function useOnline(): boolean {
  return React.useSyncExternalStore(
    assinar,
    () => navigator.onLine,
    () => true
  );
}
