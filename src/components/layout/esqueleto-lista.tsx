/** Esqueleto de telas com filtros + lista (Emendas, Pendências): mostra a forma da página enquanto carrega. */
export function EsqueletoLista() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="h-8 w-64 max-w-full animate-pulse rounded-lg bg-slate-200" />
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[38px] w-40 animate-pulse rounded-lg bg-slate-200/70" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
