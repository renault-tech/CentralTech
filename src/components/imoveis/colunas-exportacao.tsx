"use client";

import * as React from "react";

import { salvarColunasOcultasImoveis } from "@/lib/imoveis/actions";
import type { IdRelatorioImoveis } from "@/lib/imoveis/relatorios";

export type OcultasImoveis = Partial<Record<IdRelatorioImoveis, string[]>>;

const Contexto = React.createContext<{ ocultas: OcultasImoveis; guardar: (novas: OcultasImoveis) => void }>({ ocultas: {}, guardar: () => {} });

/** Escolha de colunas da exportação: vem do banco (por usuário) e cada mudança é guardada lá. */
export function ProvedorColunasImoveis({ iniciais, children }: { iniciais: OcultasImoveis; children: React.ReactNode }) {
  const [ocultas, setOcultas] = React.useState<OcultasImoveis>(iniciais);
  const guardar = React.useCallback((novas: OcultasImoveis) => {
    setOcultas(novas);
    void salvarColunasOcultasImoveis(novas as Record<string, string[]>);
  }, []);
  const valor = React.useMemo(() => ({ ocultas, guardar }), [ocultas, guardar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useColunasImoveis() {
  return React.useContext(Contexto);
}
