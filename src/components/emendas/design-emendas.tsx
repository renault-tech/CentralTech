"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { definirDesign } from "@/lib/emendas/actions-design";

/** PROVISÓRIO (ver `lib/emendas/design.ts`): leva "visual novo ligado?" do servidor aos componentes de cliente. */
const Contexto = React.createContext(true);

export function ProvedorDesign({ novo, children }: { novo: boolean; children: React.ReactNode }) {
  return <Contexto.Provider value={novo}>{children}</Contexto.Provider>;
}

export function useNovoDesign(): boolean {
  return React.useContext(Contexto);
}

/** Botão flutuante, só para o administrador: alterna entre o visual original e o novo e recarrega a tela. */
export function AlternadorDesign({ novo }: { novo: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = React.useTransition();
  function escolher(valor: "novo" | "original") {
    if ((valor === "novo") === novo) return;
    iniciar(async () => {
      await definirDesign(valor);
      router.refresh();
    });
  }
  const opcao = (valor: "novo" | "original", rotulo: string) => {
    const ativa = (valor === "novo") === novo;
    return (
      <button
        type="button"
        aria-pressed={ativa}
        onClick={() => escolher(valor)}
        className={`min-h-9 rounded-full px-3 text-xs font-semibold transition-colors ${ativa ? "bg-[color:var(--modulo-texto)] text-white" : "text-slate-700 hover:bg-slate-200"}`}
      >
        {rotulo}
      </button>
    );
  };
  return (
    <div
      role="group"
      aria-label="Alternar visual do módulo (provisório, só administrador)"
      className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 shadow-lg print:hidden ${pendente ? "opacity-70" : ""}`}
    >
      <span className="px-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">Visual</span>
      {opcao("original", "Original")}
      {opcao("novo", "Novo")}
    </div>
  );
}
