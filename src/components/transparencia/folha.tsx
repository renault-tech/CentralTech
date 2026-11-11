"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Painel que desliza (lateral no computador, de baixo no celular). Esc fecha e devolve o foco. */
export function Folha({ aberta, aoFechar, titulo, subtitulo, children, rotulo }: { aberta: boolean; aoFechar: () => void; titulo: React.ReactNode; subtitulo?: React.ReactNode; children: React.ReactNode; rotulo: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const montado = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  React.useEffect(() => {
    if (!aberta) return;
    const anterior = document.activeElement as HTMLElement | null;
    const corpo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
      if (e.key === "Tab" && ref.current) {
        const foco = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!foco.length) return;
        const [primeiro, ultimo] = [foco[0], foco[foco.length - 1]];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = corpo;
      anterior?.focus?.();
    };
  }, [aberta, aoFechar]);

  if (!aberta || !montado) return null;
  return createPortal(
    <div className="portal-raiz" style={{ minHeight: 0, background: "transparent" }}>
      <div className="portal-veu" onClick={aoFechar} aria-hidden />
      <div ref={ref} className="portal-folha outline-none" role="dialog" aria-modal="true" aria-label={rotulo} tabIndex={-1}>
        <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-[var(--p-linha-forte)] md:hidden" aria-hidden />
        <header className="flex items-start gap-3 border-b border-[var(--p-linha)] px-6 pb-4 pt-4 md:pt-6">
          <div className="min-w-0 flex-1">
            {subtitulo && <div className="mb-1">{subtitulo}</div>}
            <h2 className="text-xl font-semibold leading-tight tracking-tight text-[var(--p-tinta)]">{titulo}</h2>
          </div>
          <button type="button" onClick={aoFechar} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--p-superficie-2)] text-[var(--p-tinta-2)] hover:text-[var(--p-tinta)]" aria-label="Fechar">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
