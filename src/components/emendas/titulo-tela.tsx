import type { ReactNode } from "react";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { usarNovoDesign } from "@/lib/emendas/design";

/**
 * Título de tela do módulo Emendas: o mesmo em todas as abas. Uma linha de título (com selo opcional, ex.: o exercício),
 * subtítulo de apoio e as ações à direita. Substitui o cabeçalho azul grande, que repetia a identidade que o cabeçalho
 * da Central já dá; o respiro vai para o conteúdo.
 */
export async function TituloTela({ titulo, tituloOriginal, subtitulo, selo, acao }: { titulo: string; /** Título do visual original, quando diferente. */ tituloOriginal?: string; subtitulo?: ReactNode; selo?: ReactNode; acao?: ReactNode }) {
  if (!(await usarNovoDesign())) {
    // Visual original: cabeçalho azul grande (o selo, quando há, vira o começo do subtítulo).
    const sub = [typeof selo === "string" ? selo : null, typeof subtitulo === "string" ? subtitulo : null].filter(Boolean).join(" · ");
    return <CabecalhoPagina titulo={tituloOriginal ?? titulo} subtitulo={sub || undefined} acao={acao} />;
  }
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-cataguases-marinho text-balance">
          {titulo}
          {selo && <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)] px-2.5 py-0.5 align-middle text-xs font-semibold tracking-normal text-[color:var(--modulo-tinta)]">{selo}</span>}
        </h1>
        {subtitulo && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{subtitulo}</p>}
      </div>
      {acao && <div className="flex flex-wrap items-center gap-2 print:hidden">{acao}</div>}
    </header>
  );
}
