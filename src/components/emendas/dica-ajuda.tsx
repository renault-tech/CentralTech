"use client";

import * as React from "react";
import { CircleHelp } from "lucide-react";

/** "?" pequeno que explica o campo ao passar o mouse, focar (teclado) ou tocar (celular). */
export function DicaAjuda({ texto, rotulo = "Ajuda" }: { texto: React.ReactNode; rotulo?: string }) {
  const [aberta, setAberta] = React.useState(false);
  const id = React.useId();
  return (
    <span className="relative inline-flex align-middle" onMouseEnter={() => setAberta(true)} onMouseLeave={() => setAberta(false)}>
      <button
        type="button"
        aria-label={rotulo}
        aria-describedby={aberta ? id : undefined}
        onFocus={() => setAberta(true)}
        onBlur={() => setAberta(false)}
        onClick={() => setAberta((v) => !v)}
        onKeyDown={(e) => e.key === "Escape" && setAberta(false)}
        className="text-slate-400 hover:text-[#5B3FA8] focus-visible:text-[#5B3FA8] focus-visible:outline-none"
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden />
      </button>
      {aberta && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-30 mt-1.5 w-64 max-w-[80vw] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2.5 text-left text-xs font-normal leading-relaxed text-slate-700 shadow-lg"
        >
          {texto}
        </span>
      )}
    </span>
  );
}
