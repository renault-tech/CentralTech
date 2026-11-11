"use client";

import * as React from "react";

/**
 * Uma dica flutuante para o painel todo (passar o mouse ou focar com o teclado mostra o mesmo
 * conteúdo). O conteúdo é React (texto escapado), nunca HTML montado à mão.
 */
type Estado = { x: number; y: number; conteudo: React.ReactNode } | null;
const Ctx = React.createContext<(e: Estado) => void>(() => {});

export function ProvedorDica({ children }: { children: React.ReactNode }) {
  const [dica, setDica] = React.useState<Estado>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);

  React.useLayoutEffect(() => {
    if (!dica || !ref.current) return setPos(null);
    const r = ref.current.getBoundingClientRect();
    const m = 12;
    let left = dica.x + 14;
    let top = dica.y + 16;
    if (left + r.width > window.innerWidth - m) left = Math.max(m, dica.x - r.width - 14);
    if (top + r.height > window.innerHeight - m) top = Math.max(m, dica.y - r.height - 14);
    setPos({ left, top });
  }, [dica]);

  React.useEffect(() => {
    const fechar = () => setDica(null);
    window.addEventListener("scroll", fechar, { passive: true });
    return () => window.removeEventListener("scroll", fechar);
  }, []);

  return (
    <Ctx.Provider value={setDica}>
      {children}
      {dica && (
        <div ref={ref} role="tooltip" className="portal-dica" style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}>
          {dica.conteudo}
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Props para espalhar num elemento: mouse, toque e foco mostram a dica. */
export function useDica() {
  const set = React.useContext(Ctx);
  return React.useCallback(
    (conteudo: React.ReactNode) => ({
      onPointerMove: (e: React.PointerEvent) => e.pointerType !== "touch" && set({ x: e.clientX, y: e.clientY, conteudo }),
      onPointerLeave: () => set(null),
      onFocus: (e: React.FocusEvent<HTMLElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        set({ x: r.left + Math.min(r.width, 240) / 2, y: r.bottom, conteudo });
      },
      onBlur: () => set(null),
    }),
    [set]
  );
}

export function LinhaDica({ cor, rotulo, valor, forte }: { cor?: string; rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {cor && <span aria-hidden className="h-[3px] w-3 shrink-0 rounded-full" style={{ background: cor }} />}
      <span className="flex-1 text-[var(--p-tinta-3)]">{rotulo}</span>
      <span className={`tabular-nums ${forte ? "font-semibold text-[var(--p-tinta)]" : "font-medium text-[var(--p-tinta)]"}`}>{valor}</span>
    </div>
  );
}
