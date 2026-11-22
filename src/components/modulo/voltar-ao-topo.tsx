"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Botão discreto "voltar ao topo" para uma lista que rola por dentro: aparece depois de rolar um pouco e leva ao início.
 * Fica no canto de baixo do contêiner `relative` que envolve a lista; `alvoRef` é o elemento que rola.
 */
export function VoltarAoTopo({ alvoRef, depois = 480 }: { alvoRef: React.RefObject<HTMLElement | null>; depois?: number }) {
  const [visivel, setVisivel] = React.useState(false);
  React.useEffect(() => {
    const el = alvoRef.current;
    if (!el) return;
    const aoRolar = () => setVisivel(el.scrollTop > depois);
    el.addEventListener("scroll", aoRolar, { passive: true });
    aoRolar();
    return () => el.removeEventListener("scroll", aoRolar);
  }, [alvoRef, depois]);
  return (
    <button
      type="button"
      onClick={() => alvoRef.current?.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      aria-label="Voltar ao topo da lista"
      title="Voltar ao topo"
      tabIndex={visivel ? 0 : -1}
      aria-hidden={!visivel}
      className={cn(
        "absolute bottom-3 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-600 shadow-sm backdrop-blur transition-all duration-200 hover:bg-white hover:text-cataguases-marinho motion-reduce:transition-none print:hidden",
        visivel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      )}
    >
      <ArrowUp className="h-4 w-4" aria-hidden />
    </button>
  );
}
