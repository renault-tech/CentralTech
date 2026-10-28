"use client";

import * as React from "react";
import { ChevronDown, Download } from "lucide-react";

import { cn } from "@/lib/utils";

export type OpcaoExportar = { rotulo: string; detalhe?: string; href?: string; imprimir?: boolean };

/** Um botão "Exportar" que abre a lista de formatos (Excel, PDF, CSV…). Fecha ao clicar fora, em Esc ou numa opção. */
export function MenuExportar({ opcoes, compacto = false, rotulo = "Exportar" }: { opcoes: OpcaoExportar[]; compacto?: boolean; rotulo?: string }) {
  const [aberto, setAberto] = React.useState(false);
  const raiz = React.useRef<HTMLDivElement>(null);
  const idMenu = React.useId();

  React.useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative inline-block print:hidden">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        onClick={() => setAberto((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white text-cataguases-marinho hover:bg-slate-50",
          compacto ? "h-7 px-2 text-xs font-medium text-[#5B3FA8]" : "h-9 px-3 text-sm"
        )}
      >
        <Download className={compacto ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
        {rotulo}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto && (
        <ul id={idMenu} role="menu" className="absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {opcoes.map((o) => {
            const conteudo = (
              <>
                <span className="block text-[13px] font-medium text-cataguases-marinho">{o.rotulo}</span>
                {o.detalhe && <span className="block text-xs text-slate-500">{o.detalhe}</span>}
              </>
            );
            return (
              <li key={o.rotulo} role="none">
                {o.href ? (
                  <a role="menuitem" href={o.href} onClick={() => setAberto(false)} className="block px-3 py-2 hover:bg-slate-50">
                    {conteudo}
                  </a>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAberto(false);
                      if (o.imprimir) window.print();
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                  >
                    {conteudo}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
