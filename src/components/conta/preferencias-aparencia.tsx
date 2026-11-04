"use client";

import * as React from "react";

import { assinarTema, definirEstilo, definirModo, lerEstilo, lerModo, type Estilo, type Modo } from "@/lib/tema";

const OPCOES: { valor: Modo; rotulo: string; detalhe: string }[] = [
  { valor: "auto", rotulo: "Automático", detalhe: "Segue o tema do seu aparelho" },
  { valor: "claro", rotulo: "Claro", detalhe: "Fundo claro" },
  { valor: "escuro", rotulo: "Escuro", detalhe: "Fundo escuro, mais confortável à noite" },
];

/** Estilo (Apple/Clássico) e modo de cor (claro/escuro/automático) — guardados neste navegador, iguais nos demais módulos. */
const ESTILOS: { valor: Estilo; rotulo: string; detalhe: string }[] = [
  { valor: "apple", rotulo: "Apple", detalhe: "Vidro translúcido e cantos arredondados (padrão)" },
  { valor: "classico", rotulo: "Clássico", detalhe: "O visual anterior" },
];

export function PreferenciasAparencia() {
  const modo = React.useSyncExternalStore(assinarTema, lerModo, () => "auto" as Modo);
  const estilo = React.useSyncExternalStore(assinarTema, lerEstilo, () => "apple" as Estilo);
  return (
    <div className="flex flex-col gap-5">
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-900">Estilo</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {ESTILOS.map((o) => (
          <label
            key={o.valor}
            className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm ${estilo === o.valor ? "border-cataguases-azul bg-slate-50" : "border-slate-200 hover:bg-slate-50"}`}
          >
            <span className="flex items-center gap-2 font-medium text-slate-900">
              <input type="radio" name="estilo" checked={estilo === o.valor} onChange={() => definirEstilo(o.valor)} className="size-4 accent-[color:rgb(var(--txt-azul))]" />
              {o.rotulo}
            </span>
            <span className="pl-6 text-xs text-slate-600">{o.detalhe}</span>
          </label>
        ))}
      </div>
    </fieldset>
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-900">Modo de cor</legend>
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
    </div>
  );
}
