"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { CLASSE_ICONE_CABECALHO } from "@/components/layout/cabecalho-estilos";
import { assinarTema, definirModo } from "@/lib/tema";

const escuroAgora = () => document.documentElement.classList.contains("dark");

/** Alternador claro/escuro do cabeçalho — o mesmo em todos os módulos. "Automático" fica em Minha conta → Aparência. */
export function AlternarTema() {
  const escuro = React.useSyncExternalStore(assinarTema, escuroAgora, () => false);

  return (
    <button
      type="button"
      onClick={() => definirModo(escuroAgora() ? "claro" : "escuro")}
      role="switch"
      aria-checked={escuro}
      aria-label="Modo escuro"
      title={escuro ? "Mudar para o modo claro" : "Mudar para o modo escuro"}
      className={CLASSE_ICONE_CABECALHO}
    >
      {escuro ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
