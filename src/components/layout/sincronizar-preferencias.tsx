"use client";

import * as React from "react";

import { salvarPreferencias } from "@/lib/actions/preferencias";
import { aplicarDoServidor, lerEstilo, lerModo, registrarGravadorRemoto } from "@/lib/tema";

/**
 * Liga a aparência ao banco. No primeiro carregamento: se há preferência salva, ela vale (e vai
 * para o cache local); se não há mas este navegador já tinha escolha, a escolha sobe para o banco.
 * Depois, cada troca (`definirModo`/`definirEstilo`) também grava no banco. Sem UI.
 */
export function SincronizarPreferencias({ salvas }: { salvas: { tema: "auto" | "claro" | "escuro"; estilo: "apple" | "classico" } | null }) {
  React.useEffect(() => {
    registrarGravadorRemoto((p) => void salvarPreferencias(p));
    if (salvas) {
      if (salvas.tema !== lerModo() || salvas.estilo !== lerEstilo()) aplicarDoServidor(salvas);
    } else if (lerModo() !== "auto" || lerEstilo() !== "apple") {
      void salvarPreferencias({ tema: lerModo(), estilo: lerEstilo() });
    }
    return () => registrarGravadorRemoto(null);
  }, [salvas]);
  return null;
}
