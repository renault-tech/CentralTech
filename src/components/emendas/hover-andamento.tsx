"use client";

import * as React from "react";

import { CaixaInfo } from "@/components/emendas/caixa-info";
import { AlertTriangle, Check } from "lucide-react";

import { corDoAndamento } from "@/components/emendas/anel-andamento";
import { macrosDoResumo } from "@/components/emendas/barra-fases";
import { indiceDaProxima } from "@/lib/emendas/fases-resumo";
import { COR_DINHEIRO } from "@/lib/emendas/cores-financeiras";
import { brl, pct } from "@/lib/emendas/regras";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { cn } from "@/lib/utils";
import type { EmendaResumo } from "@/types/emendas";

/**
 * Envolve a barra de fases da lista: ao passar o mouse (depois de uma pequena pausa) abre a caixa com os valores da emenda e
 * as macro-etapas do fluxo.
 */
export function HoverAndamento({ emenda: e, resumo, children }: { emenda: EmendaResumo; resumo: ResumoLinha; children: React.ReactNode }) {
  const macros = macrosDoResumo(resumo);
  const proxima = indiceDaProxima(macros);
  const p = resumo.total > 0 ? Math.round((resumo.concluidas / resumo.total) * 100) : 0;
  const aPagar = Math.max(0, e.empenhado - e.pago);
  const semEmpenhar = Math.max(0, e.valor - e.empenhado);

  const linha = (rotulo: string, valor: number, base: number, cor: string, nota: string) => {
    const w = base > 0 ? Math.min(100, Math.max(0, (valor / base) * 100)) : 0;
    return (
      <div>
        <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
          <span className="text-slate-600">{rotulo}</span>
          <span className="font-semibold tabular-nums text-cataguases-marinho">{brl(valor)}</span>
        </div>
        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full" style={{ width: `${w}%`, background: cor }} />
        </div>
        <p className="text-[0.6875rem] tabular-nums text-slate-500">{nota}</p>
      </div>
    );
  };

  const conteudo = (
    <>
      <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500">Emenda nº {e.numero}</p>
                <p className="text-base font-semibold tabular-nums tracking-tight">{brl(e.valor)}</p>
              </div>
              <div className="text-right text-xs leading-tight text-slate-600">
                <span className="block text-xl font-semibold tabular-nums" style={{ color: corDoAndamento(p) }}>{p}%</span>
                <span className="block tabular-nums">{resumo.concluidas}/{resumo.total} fases</span>
              </div>
            </div>

            <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5">
              {linha("Empenhado", e.empenhado, e.valor, COR_DINHEIRO.empenhado, `${pct(e.valor ? e.empenhado / e.valor : 0, 0)} do valor da emenda`)}
              {linha("Pago", e.pago, e.empenhado || e.valor, COR_DINHEIRO.pago, e.empenhado ? `${pct(e.pago / e.empenhado, 0)} do empenhado` : "sem empenho ainda")}
              <div className="grid grid-cols-2 gap-2 text-[0.8125rem]">
                <div className="rounded-lg bg-slate-50 px-2 py-1"><span className="flex items-center gap-1.5 text-[0.6875rem] text-slate-600"><span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: COR_DINHEIRO.aPagar }} aria-hidden />A pagar</span><span className="font-semibold tabular-nums">{brl(aPagar)}</span></div>
                <div className="rounded-lg bg-slate-50 px-2 py-1"><span className="flex items-center gap-1.5 text-[0.6875rem] text-slate-600"><span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: COR_DINHEIRO.semEmpenhar }} aria-hidden />Sem empenhar</span><span className="font-semibold tabular-nums">{brl(semEmpenhar)}</span></div>
              </div>
            </div>

            {macros.length > 0 && (
              <div className="mt-2.5 border-t border-slate-100 pt-2.5">
                <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500">Etapas</p>
                <ol className="space-y-1">
                  {macros.map((m, i) => (
                    <li key={m.chave} className="flex items-center gap-2 text-[0.8125rem]">
                      <span
                        className={cn(
                          "flex h-4 w-4 flex-none items-center justify-center rounded-full border-2",
                          m.estado === "feita" && "border-emerald-500 bg-emerald-500 text-white",
                          m.estado === "andamento" && "border-[#6B4FBB] bg-white",
                          m.estado === "pendente" && "border-slate-300 bg-white"
                        )}
                      >
                        {m.estado === "feita" && <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden />}
                        {m.estado === "andamento" && <span className="h-1.5 w-1.5 rounded-full bg-[#6B4FBB]" />}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate", m.estado === "pendente" && i !== proxima ? "text-slate-500" : "font-medium")}>{m.nome}</span>
                      {i === proxima && <span className="flex-none rounded-full bg-violet-100 px-1.5 py-px text-[0.6875rem] font-semibold text-violet-800">próxima</span>}
                      {m.alerta && <AlertTriangle className="h-3.5 w-3.5 flex-none text-amber-500" aria-label="Com alerta" />}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <p className="mt-2 text-[0.6875rem] text-slate-400">Clique na emenda para ver as fases e os documentos ao lado.</p>
    </>
  );
  return <CaixaInfo conteudo={conteudo}>{children}</CaixaInfo>;
}
