"use client";

import * as React from "react";

import { salvarColunasOcultas } from "@/lib/frotas/actions";
import type { IdRelatorio } from "@/lib/frotas/relatorios";

export type Ocultas = Partial<Record<IdRelatorio, string[]>>;

const Contexto = React.createContext<{ ocultas: Ocultas; guardar: (novas: Ocultas) => void }>({ ocultas: {}, guardar: () => {} });

/** Escolha de colunas da exportação: vem do banco (por usuário) e cada mudança é guardada lá. */
export function ProvedorColunasExportacao({ iniciais, children }: { iniciais: Ocultas; children: React.ReactNode }) {
  const [ocultas, setOcultas] = React.useState<Ocultas>(iniciais);
  const guardar = React.useCallback((novas: Ocultas) => {
    setOcultas(novas);
    void salvarColunasOcultas(novas as Record<string, string[]>);
  }, []);
  const valor = React.useMemo(() => ({ ocultas, guardar }), [ocultas, guardar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useColunasExportacao() {
  return React.useContext(Contexto);
}
