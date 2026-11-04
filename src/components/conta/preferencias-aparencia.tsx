"use client";

import * as React from "react";

import { assinarTema, definirModo, lerModo, type Modo } from "@/lib/tema";

const OPCOES: { valor: Modo; rotulo: string; detalhe: string }[] = [
  { valor: "auto", rotulo: "Automático", detalhe: "Segue o tema do seu aparelho" },
  { valor: "claro", rotulo: "Claro", detalhe: "Fundo claro" },
  { valor: "escuro", rotulo: "Escuro", detalhe: "Fundo escuro, mais confortável à noite" },
];

/** Modo de cor (claro/escuro/automático) — guardado neste navegador, igual nos demais módulos. */
export function PreferenciasAparencia() {
  const modo = React.useSyncExternalStore(assinarTema, lerModo, () => "auto" as Modo);
  return (
    <fieldset>
      <legend className="sr-only">Modo de cor</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {OPCOES.map((o) => (
          <label
            key={o.valor}
            className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm ${modo === o.valor ? "border-cataguases-azul bg-slate-50" : "border-slate-200 hover:bg-slate-50"}`}
          >
            <span className="flex items-center gap-2 font-medium text-slate-900">
              <input type="radio" name="modo" checked={modo === o.valor} onChange={() => definirModo(o.valor)} className="size-4 accent-[color:rgb(var(--txt-azul))]" />
              {o.rotulo}
            </span>
            <span className="pl-6 text-xs text-slate-600">{o.detalhe}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
