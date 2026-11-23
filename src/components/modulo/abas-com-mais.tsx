"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

export type AbaItem<T extends string = string> = { chave: T; rotulo: string };

const LARGURA_MAIS = 60;

const classeAba = (ativa: boolean) =>
  cn("relative flex-none whitespace-nowrap px-2.5 py-2.5 text-[0.8125rem] transition-colors", ativa ? "font-semibold text-[color:var(--modulo-tinta)]" : "text-slate-700 hover:text-cataguases-marinho");

/**
 * Faixa de abas numa linha só: o que não cabe na largura disponível vai para o botão "Mais" (⋯). A aba aberta nunca fica escondida
 * (ela toma o lugar da última visível). Mede as abas com uma cópia invisível, então acompanha o tamanho da letra (zoom) e da janela.
 */
export function AbasComMais<T extends string>({
  abas,
  ativa,
  aoEscolher,
  idAba,
  rotuloAria,
  className,
}: {
  abas: AbaItem<T>[];
  ativa: T;
  aoEscolher: (chave: T) => void;
  idAba: (chave: T) => string;
  rotuloAria: string;
  className?: string;
}) {
  const faixa = React.useRef<HTMLDivElement>(null);
  const medida = React.useRef<HTMLDivElement>(null);
  const [largura, setLargura] = React.useState(0);
  const [larguras, setLarguras] = React.useState<number[]>([]);
  const [menu, setMenu] = React.useState(false);
  const raiz = React.useRef<HTMLDivElement>(null);

  const chaves = abas.map((a) => `${a.chave}:${a.rotulo}`).join("|");
  React.useLayoutEffect(() => {
    const medir = () => {
      if (faixa.current) setLargura(faixa.current.clientWidth);
      if (medida.current) setLarguras(Array.from(medida.current.children).map((c) => (c as HTMLElement).offsetWidth));
    };
    medir();
    const ro = new ResizeObserver(medir);
    if (faixa.current) ro.observe(faixa.current);
    void document.fonts?.ready.then(medir);
    return () => ro.disconnect();
  }, [chaves]);

  // Quantas abas cabem; se não cabem todas, reserva o lugar do "Mais".
  const total = larguras.reduce((a, b) => a + b, 0);
  const cabemTodas = larguras.length === abas.length && (largura === 0 || total <= largura);
  let visiveis: AbaItem<T>[] = abas;
  let escondidas: AbaItem<T>[] = [];
  if (!cabemTodas && larguras.length === abas.length) {
    let usado = 0;
    let n = 0;
    while (n < abas.length && usado + larguras[n] <= largura - LARGURA_MAIS) {
      usado += larguras[n];
      n++;
    }
    n = Math.max(1, n);
    visiveis = abas.slice(0, n);
    escondidas = abas.slice(n);
    // A aba aberta não pode sumir: toma o lugar da última visível.
    if (escondidas.some((a) => a.chave === ativa)) {
      const aberta = abas.find((a) => a.chave === ativa)!;
      escondidas = [...escondidas.filter((a) => a.chave !== ativa), visiveis[visiveis.length - 1]];
      visiveis = [...visiveis.slice(0, -1), aberta];
    }
  }

  React.useEffect(() => {
    if (!menu) return;
    const fora = (ev: MouseEvent) => {
      if (!raiz.current?.contains(ev.target as Node)) setMenu(false);
    };
    const esc = (ev: KeyboardEvent) => ev.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  return (
    <div ref={raiz} className={cn("relative flex-none border-y border-slate-200 bg-white/60 px-2", className)}>
      {/* Cópia invisível, só para medir a largura de cada aba. */}
      <div ref={medida} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 -z-10 flex h-0 overflow-hidden whitespace-nowrap">
        {abas.map((a) => (
          <span key={a.chave} className={cn(classeAba(true), "inline-block")}>
            {a.rotulo}
          </span>
        ))}
      </div>
      <div ref={faixa} role="tablist" aria-label={rotuloAria} className="flex items-center gap-x-0.5">
        {visiveis.map((a) => {
          const on = a.chave === ativa;
          return (
            <button key={a.chave} type="button" role="tab" id={idAba(a.chave)} aria-selected={on} onClick={() => aoEscolher(a.chave)} className={classeAba(on)}>
              {a.rotulo}
              <span aria-hidden className={cn("absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-opacity", on ? "opacity-100" : "opacity-0")} style={{ backgroundColor: "var(--modulo)" }} />
            </button>
          );
        })}
        {escondidas.length > 0 && (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={`Mais seções (${escondidas.length})`}
            title="Mais seções"
            onClick={() => setMenu((v) => !v)}
            className="ml-auto grid h-8 w-9 flex-none grid-cols-1 place-items-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-cataguases-marinho focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--modulo-tinta)]"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {menu && escondidas.length > 0 && (
        <div role="menu" aria-label="Mais seções" className="absolute right-2 top-full z-30 mt-1 min-w-[10rem] rounded-[0.75rem] border border-slate-200 bg-white p-1 shadow-lg" style={{ backgroundColor: "rgb(var(--surface))" }}>
          {escondidas.map((a) => (
            <button
              key={a.chave}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                aoEscolher(a.chave);
              }}
              className="flex min-h-9 w-full items-center rounded-md px-3 text-left text-[0.8125rem] text-slate-700 hover:bg-slate-100 hover:text-cataguases-marinho"
            >
              {a.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
