"use client";

import { X } from "lucide-react";

export type FiltroAtivo = { chave: string; rotulo: string };

/**
 * Filtros que estão valendo, um chip por filtro com ✕ para tirar só aquele, e "Limpar tudo". É o único lugar onde os
 * filtros escolhidos no dashboard (clicando em fatias, linhas e abas) ficam visíveis juntos, sem uma caixa de seletores
 * repetindo o que o gráfico já faz. Some quando não há filtro, sem deixar linha vazia.
 */
export function FiltrosAtivos({ filtros, aoRemover, aoLimparTudo }: { filtros: FiltroAtivo[]; aoRemover: (chave: string) => void; aoLimparTudo: () => void }) {
  // A linha existe sempre, com a mesma altura: o chip aparecer ou sumir não empurra o gráfico para baixo do cursor.
  if (filtros.length === 0) {
    return (
      <p className="flex min-h-[3.25rem] items-center border-b border-slate-200 px-4 text-xs text-slate-600 print:hidden">
        Nenhum filtro aplicado. Clique numa fatia, numa linha ou numa aba do gráfico para filtrar a lista.
      </p>
    );
  }
  return (
    <div className="flex min-h-[3.25rem] flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 print:hidden" role="group" aria-label="Filtros ativos">
      <span className="text-xs font-medium text-slate-600">Filtrando por</span>
      {filtros.map((f) => (
        <button
          key={f.chave}
          type="button"
          onClick={() => aoRemover(f.chave)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--modulo-tinta)]/40 bg-[color-mix(in_srgb,var(--modulo)_10%,transparent)] py-1 pl-3 pr-2 text-sm font-medium text-[color:var(--modulo-tinta)] transition-colors hover:bg-[color-mix(in_srgb,var(--modulo)_18%,transparent)]"
          title="Tirar este filtro"
        >
          {f.rotulo}
          <X className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">Tirar este filtro</span>
        </button>
      ))}
      <button type="button" onClick={aoLimparTudo} className="min-h-9 rounded-lg px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
        Limpar tudo
      </button>
    </div>
  );
}
