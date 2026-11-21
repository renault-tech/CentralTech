"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Check, X } from "lucide-react";

import { AnelAndamento } from "@/components/emendas/anel-andamento";
import { useCatalogo } from "@/components/emendas/catalogo-etapas";
import { CategoriaSelo } from "@/components/emendas/categoria-selo";
import { TipoSelo } from "@/components/emendas/tipo-selo";
import { Chip, SeloEtapa } from "@/components/emendas/ui";
import { TIPOS_EXECUCAO, tipoDaEmenda } from "@/lib/emendas/fases";
import { NOME_GRAVIDADE } from "@/lib/emendas/pendencias";
import { brl, dataBr, numeroVereador, pct } from "@/lib/emendas/regras";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { cn } from "@/lib/utils";
import type { EmendaResumo } from "@/types/emendas";

const COR_GRAVIDADE = { alta: "#B91C1C", media: "#B45309", baixa: "#64748B" } as const;

function Barra({ rotulo, valor, total, cor, detalhe }: { rotulo: string; valor: number; total: number; cor: string; detalhe: string }) {
  const p = total > 0 ? Math.min(1, Math.max(0, valor / total)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
        <span className="text-slate-600">{rotulo}</span>
        <span className="font-semibold tabular-nums text-cataguases-marinho">{brl(valor)}</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="emd-preenche h-full rounded-full" style={{ width: `${p * 100}%`, background: `linear-gradient(90deg, ${cor}, color-mix(in srgb, ${cor} 70%, white))` }} />
      </div>
      <p className="text-xs tabular-nums text-slate-500">{detalhe}</p>
    </div>
  );
}

/**
 * Painel à direita da lista: o resumo da emenda escolhida (andamento, dinheiro, fases, pendências, dados) sem sair da lista.
 * Usa só o que a lista já carregou; "Abrir emenda completa" leva à página de sempre, com lançamentos, documentos e histórico.
 */
export function PainelDetalheEmenda({ emenda: e, resumo, aoFechar }: { emenda: EmendaResumo; resumo?: ResumoLinha; aoFechar: () => void }) {
  const catalogo = useCatalogo();
  const tipo = tipoDaEmenda(e);
  const cor = TIPOS_EXECUCAO[tipo].cor;
  const aPagar = Math.max(0, e.empenhado - e.pago);
  const semEmpenhar = Math.max(0, e.valor - e.empenhado);
  const fases = resumo?.fases ?? [];
  const proxima = fases.findIndex((f) => f.estado !== "feita");
  const href = (aba?: string) => `/emendas/${e.id}${aba ? `?aba=${aba}` : ""}`;

  return (
    <article key={e.id} className="emd-troca flex h-full min-w-[20rem] flex-col" aria-label={`Emenda ${e.numero}`}>
      <header className="relative border-b border-slate-200 px-4 pb-3 pt-3" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${cor} 14%, transparent), transparent 70%)` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-md bg-white/70 px-2 py-0.5 font-mono font-semibold text-cataguases-marinho ring-1 ring-slate-200">Nº {e.numero}</span>
            <TipoSelo tipo={tipo} />
            <CategoriaSelo categoria={e.beneficiario_categoria} />
            {e.saude && <Chip tom="saude">Saúde</Chip>}
            {e.remanejada && <Chip tom="amarelo">Remanejada</Chip>}
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar detalhe da emenda" title="Fechar (Esc)" className="-mr-1.5 -mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-cataguases-marinho">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <h2 className="mt-2 line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-tight text-cataguases-marinho" title={e.objeto}>{e.objeto}</h2>
        <p className="mt-0.5 truncate text-[0.8125rem] text-slate-600">{[e.beneficiario_nome, e.secretaria_nome].filter(Boolean).join(" · ")}</p>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[1.5rem] font-semibold leading-none tracking-tight tabular-nums text-cataguases-marinho">{brl(e.valor)}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <SeloEtapa etapa={e.etapa} situacao={e.situacao} catalogo={catalogo} />
              {e.ultimo_pagamento && <span className="text-xs text-slate-500">pago em {dataBr(e.ultimo_pagamento)}</span>}
            </div>
          </div>
          {resumo && resumo.total > 0 && (
            <div className="flex flex-none items-center gap-2.5" title={`${resumo.concluidas} de ${resumo.total} fases concluídas`}>
              <span className="text-right text-xs leading-tight text-slate-600">
                <span className="block font-medium text-cataguases-marinho">Andamento</span>
                <span className="block tabular-nums">{resumo.concluidas}/{resumo.total} fases</span>
              </span>
              <AnelAndamento concluidas={resumo.concluidas} total={resumo.total} tamanho={52} espessura={5} />
            </div>
          )}
        </div>
      </header>

      <div className="emd-cont min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5">
        <div className="emd-det-grade">
          <div className="space-y-4">
            <section aria-label="Execução financeira" className="space-y-2.5">
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500">Execução financeira</h3>
              <Barra rotulo="Empenhado" valor={e.empenhado} total={e.valor} cor="#7C5CCF" detalhe={`${pct(e.valor ? e.empenhado / e.valor : 0, 0)} do valor da emenda`} />
              <Barra rotulo="Pago" valor={e.pago} total={e.empenhado || e.valor} cor="#4C3494" detalhe={e.empenhado ? `${pct(e.pago / e.empenhado, 0)} do empenhado` : "sem empenho ainda"} />
              <div className="grid grid-cols-2 gap-2 text-[0.8125rem]">
                <div className="rounded-lg bg-slate-50 px-2.5 py-1.5"><span className="block text-xs text-slate-500">A pagar</span><span className="font-semibold tabular-nums text-cataguases-marinho">{brl(aPagar)}</span></div>
                <div className="rounded-lg bg-slate-50 px-2.5 py-1.5"><span className="block text-xs text-slate-500">Sem empenhar</span><span className="font-semibold tabular-nums text-cataguases-marinho">{brl(semEmpenhar)}</span></div>
              </div>
            </section>

            {!!resumo?.pendencias?.length && (
              <section aria-label="Pendências" className="space-y-2">
                <h3 className="flex items-center justify-between text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Pendências abertas
                  <Link href={href("pendencias")} className="font-medium normal-case tracking-normal text-[color:var(--modulo-tinta)] hover:underline">ver todas ({resumo.abertas})</Link>
                </h3>
                <ul className="space-y-1">
                  {resumo.pendencias.map((p, i) => (
                    <li key={`${p.titulo}-${i}`} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white/60 px-2.5 py-1.5 text-[0.8125rem]">
                      <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ backgroundColor: COR_GRAVIDADE[p.gravidade] }} aria-hidden />
                      <span className="min-w-0 flex-1 leading-snug text-cataguases-marinho">{p.titulo}</span>
                      <span className="flex-none text-xs font-medium" style={{ color: COR_GRAVIDADE[p.gravidade] }}>{NOME_GRAVIDADE[p.gravidade]}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-label="Dados" className="space-y-1.5">
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500">Dados</h3>
              <dl className="divide-y divide-slate-100 text-[0.8125rem]">
                {(
                  [
                    ["Vereador(a)", `${numeroVereador(e.vereador_numero)} · ${e.vereador_nome}`],
                    ["Unidade", `${e.unidade_codigo} ${e.unidade_nome}`],
                    ["Ficha", e.ficha],
                    ["Natureza", e.natureza_despesa],
                    ["Funcional", e.funcional_programatica],
                  ] as [string, string | null][]
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[5.5rem_1fr] gap-2 py-1.5">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="min-w-0 break-words font-medium text-cataguases-marinho">{v}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          </div>

          {fases.length > 0 && (
            <section aria-label="Fases" className="space-y-2">
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500">Fluxo de fases</h3>
              <ol>
                {fases.map((f, i) => {
                  const atual = i === proxima;
                  return (
                    <li key={`${f.nome}-${i}`} className="relative flex items-center gap-2.5 py-[0.1875rem]">
                      {i < fases.length - 1 && <span aria-hidden className="absolute left-[0.5625rem] top-[1.4rem] h-[calc(100%-0.9rem)] w-px" style={{ background: f.estado === "feita" ? "#10B981" : "rgb(203 213 225)" }} />}
                      <span
                        className={cn(
                          "relative z-[1] flex h-[1.125rem] w-[1.125rem] flex-none items-center justify-center rounded-full border-2",
                          f.estado === "feita" && "border-emerald-500 bg-emerald-500 text-white",
                          f.estado === "parcial" && "border-amber-500 bg-white text-amber-600",
                          f.estado === "andamento" && "border-[color:var(--modulo)] bg-white",
                          f.estado === "pendente" && "border-slate-300 bg-white",
                          atual && "emd-pulso"
                        )}
                      >
                        {(f.estado === "feita" || f.estado === "parcial") && <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden />}
                        {f.estado === "andamento" && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--modulo)" }} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-snug" title={f.nome}>
                        <span className={cn(f.estado === "pendente" && !atual ? "text-slate-500" : "font-medium text-cataguases-marinho")}>{f.nome}</span>
                        {atual && <span className="ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--modulo)_14%,transparent)] px-1.5 py-px text-[0.6875rem] font-semibold text-[color:var(--modulo-tinta)]">próxima</span>}
                        {f.alerta && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500" aria-label="Com alerta" />}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/70 px-4 py-2.5 backdrop-blur">
        <Link href={href()} className="btn-ui inline-flex h-9 items-center gap-1.5 rounded-lg bg-[color:var(--modulo-texto)] px-3.5 text-sm font-semibold text-white hover:brightness-110">
          Abrir emenda completa <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link href={href("financeiro")} className="btn-ui inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-cataguases-marinho hover:bg-slate-50">Financeiro</Link>
        <Link href={href("documentacao")} className="btn-ui inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-cataguases-marinho hover:bg-slate-50">Documentos</Link>
      </footer>
    </article>
  );
}
