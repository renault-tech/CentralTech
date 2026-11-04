"use client";

import * as React from "react";
import { ChevronDown, Download } from "lucide-react";

import { cn } from "@/lib/utils";

export type OpcaoExportar = { rotulo: string; detalhe?: string; href?: string; imprimir?: boolean; aoClicar?: () => void; relatorio?: string };

/**
 * Botão "Exportar" que abre a lista de formatos (Excel, PDF, CSV…) — o MESMO em todos os módulos.
 * Teclado: Esc fecha e devolve o foco ao botão; setas sobem e descem pelas opções. Fecha ao
 * clicar fora ou numa opção.
 */
export function MenuExportar({ opcoes, compacto = false, rotulo = "Exportar" }: { opcoes: OpcaoExportar[]; compacto?: boolean; rotulo?: string }) {
  const [aberto, setAberto] = React.useState(false);
  const raiz = React.useRef<HTMLDivElement>(null);
  const botao = React.useRef<HTMLButtonElement>(null);
  const idMenu = React.useId();

  React.useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberto(false);
      botao.current?.focus();
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function setas(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const itens = Array.from(raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (itens.length === 0) return;
    e.preventDefault();
    const atual = itens.indexOf(document.activeElement as HTMLElement);
    const proximo = e.key === "ArrowDown" ? (atual + 1) % itens.length : (atual - 1 + itens.length) % itens.length;
    itens[proximo].focus();
  }

  return (
    <div ref={raiz} className="relative inline-block print:hidden" onKeyDown={setas}>
      <button
        ref={botao}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        onClick={() => setAberto((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white text-cataguases-marinho transition-colors duration-200 hover:bg-slate-50",
          compacto ? "h-8 px-2 text-xs font-medium" : "h-11 px-3 text-sm sm:h-9"
        )}
      >
        <Download className={compacto ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
        {rotulo}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto && (
        <ul id={idMenu} role="menu" aria-label={rotulo} className="absolute left-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg sm:left-auto sm:right-0">
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
                  <a role="menuitem" href={o.href} onClick={() => setAberto(false)} className="block min-h-11 px-3 py-2 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--modulo-texto)]">
                    {conteudo}
                  </a>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAberto(false);
                      if (o.imprimir) window.print();
                      o.aoClicar?.();
                    }}
                    className="block min-h-11 w-full px-3 py-2 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--modulo-texto)]"
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
