import type * as React from "react";

import { cn } from "@/lib/utils";

/** Peças do resumo ao lado da lista (só consulta): blocos com título, campos "rótulo / valor", números em destaque e passos. */

export function Bloco({ titulo, children, className }: { titulo?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-slate-200 pt-3.5 first:border-t-0 first:pt-0", className)}>
      {titulo && <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-slate-600">{titulo}</h3>}
      {children}
    </section>
  );
}

export function Campos({ itens }: { itens: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[0.8125rem]">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="min-w-0">
          <dt className="text-xs text-slate-600">{rotulo}</dt>
          <dd className="break-words font-medium text-cataguases-marinho">{valor || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Numeros({ itens }: { itens: { rotulo: string; valor: string; apoio?: string; tom?: "alerta" | "critico" }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {itens.map((n) => (
        <div key={n.rotulo} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <p className="truncate text-xs text-slate-600">{n.rotulo}</p>
          <p className={cn("truncate text-[1.0625rem] font-semibold tabular-nums tracking-tight", n.tom === "critico" ? "text-red-700" : n.tom === "alerta" ? "text-amber-700" : "text-cataguases-marinho")}>{n.valor}</p>
          {n.apoio && <p className="truncate text-xs text-slate-500">{n.apoio}</p>}
        </div>
      ))}
    </div>
  );
}

export type PassoResumo = { nome: string; estado: "feito" | "atual" | "futuro"; detalhe?: string };

/** Linha do tempo vertical: ✓ feito, anel na etapa atual, cinza o que ainda não aconteceu. */
export function Passos({ passos }: { passos: PassoResumo[] }) {
  return (
    <ol className="flex flex-col">
      {passos.map((p, i) => (
        <li key={`${p.nome}-${i}`} className="grid grid-cols-[1.375rem_minmax(0,1fr)] gap-x-2.5">
          <span className="flex flex-col items-center">
            <span
              aria-hidden
              className={cn(
                "grid h-[1.375rem] w-[1.375rem] place-items-center rounded-full border-2 text-[0.6875rem] font-bold",
                p.estado === "feito" && "border-emerald-600 bg-emerald-600 text-white",
                p.estado === "atual" && "border-[color:var(--modulo)] bg-white text-[color:var(--modulo-tinta)]",
                p.estado === "futuro" && "border-slate-200 bg-slate-100 text-slate-400"
              )}
            >
              {p.estado === "feito" ? "✓" : i + 1}
            </span>
            {i < passos.length - 1 && <span aria-hidden className={cn("my-0.5 w-0.5 flex-1", p.estado === "feito" ? "bg-emerald-300" : "bg-slate-200")} />}
          </span>
          <span className="pb-2.5 text-[0.8125rem] leading-tight">
            <span className={cn(p.estado === "atual" ? "font-semibold text-cataguases-marinho" : p.estado === "feito" ? "text-slate-800" : "text-slate-500")}>
              {p.nome}
              <span className="sr-only">{p.estado === "feito" ? " (feito)" : p.estado === "atual" ? " (etapa atual)" : " (ainda não)"}</span>
            </span>
            {p.detalhe && <span className="block text-xs text-slate-500">{p.detalhe}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
