"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check } from "lucide-react";

import { corDoAndamento } from "@/components/emendas/anel-andamento";
import { macrosDoResumo } from "@/components/emendas/barra-fases";
import { indiceDaProxima } from "@/lib/emendas/fases-resumo";
import { brl, pct } from "@/lib/emendas/regras";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { cn } from "@/lib/utils";
import type { EmendaResumo } from "@/types/emendas";

const LARGURA = 288; // 18 rem em tamanho normal; o cálculo de posição usa o tamanho real medido

/**
 * Envolve o anel de andamento da lista: ao passar o mouse (ou focar) abre uma caixa com os valores da emenda e as etapas
 * mais importantes do fluxo. A caixa vai para o `body` (portal) porque a lista rola e tem vidro, que prenderiam um
 * elemento `fixed`; por isso usa cores literais (as variáveis do módulo ficam no contêiner da página).
 */
export function HoverAndamento({ emenda: e, resumo, children }: { emenda: EmendaResumo; resumo: ResumoLinha; children: React.ReactNode }) {
  const alvo = React.useRef<HTMLSpanElement>(null);
  const caixa = React.useRef<HTMLDivElement>(null);
  const [aberta, setAberta] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const temporizador = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = React.useId();

  const abrir = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAberta(true), 140);
  };
  const fechar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    setAberta(false);
    setPos(null);
  };
  React.useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  // Posição: abaixo do anel, alinhada à direita dele; se não couber, ao lado (à esquerda) para não cobrir o anel.
  // Nunca sai da janela.
  React.useLayoutEffect(() => {
    if (!aberta || !alvo.current || !caixa.current) return;
    const r = alvo.current.getBoundingClientRect();
    const c = caixa.current.getBoundingClientRect();
    const margem = 8;
    const cabeAbaixo = r.bottom + 8 + c.height <= window.innerHeight - margem;
    let left: number;
    let top: number;
    if (cabeAbaixo) {
      left = r.right - c.width;
      top = r.bottom + 8;
    } else if (r.left - 8 - c.width >= margem) {
      left = r.left - 8 - c.width;
      top = r.top + r.height / 2 - c.height / 2;
    } else {
      left = r.right - c.width;
      top = r.top - c.height - 8;
    }
    left = Math.max(margem, Math.min(left, window.innerWidth - c.width - margem));
    top = Math.max(margem, Math.min(top, window.innerHeight - c.height - margem));
    setPos({ top, left });
  }, [aberta]);

  React.useEffect(() => {
    if (!aberta) return;
    const sair = () => fechar();
    window.addEventListener("scroll", sair, true);
    window.addEventListener("resize", sair);
    return () => {
      window.removeEventListener("scroll", sair, true);
      window.removeEventListener("resize", sair);
    };
  }, [aberta]);

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

  return (
    <span
      ref={alvo}
      className="inline-flex"
      onMouseEnter={abrir}
      onMouseLeave={fechar}
      onFocus={abrir}
      onBlur={fechar}
      aria-describedby={aberta ? id : undefined}
    >
      {children}
      {aberta &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={caixa}
            id={id}
            role="tooltip"
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: LARGURA, opacity: pos ? 1 : 0, zIndex: 80 }}
            className="pointer-events-none rounded-[0.875rem] border border-slate-200 bg-white p-3.5 text-cataguases-marinho shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)] transition-opacity duration-150 motion-reduce:transition-none"
          >
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
              {linha("Empenhado", e.empenhado, e.valor, "#2563EB", `${pct(e.valor ? e.empenhado / e.valor : 0, 0)} do valor da emenda`)}
              {linha("Pago", e.pago, e.empenhado || e.valor, "#059669", e.empenhado ? `${pct(e.pago / e.empenhado, 0)} do empenhado` : "sem empenho ainda")}
              <div className="grid grid-cols-2 gap-2 text-[0.8125rem]">
                <div className="rounded-lg bg-slate-50 px-2 py-1"><span className="block text-[0.6875rem] text-slate-500">A pagar</span><span className="font-semibold tabular-nums">{brl(aPagar)}</span></div>
                <div className="rounded-lg bg-slate-50 px-2 py-1"><span className="block text-[0.6875rem] text-slate-500">Sem empenhar</span><span className="font-semibold tabular-nums">{brl(semEmpenhar)}</span></div>
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
          </div>,
          document.body
        )}
    </span>
  );
}
