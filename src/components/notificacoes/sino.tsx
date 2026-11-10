"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";

import { COR_APP_AVISO, NOME_APP_AVISO, destinoDoAviso } from "@/lib/notificacoes/links";
import { limparNovo, marcarComoLidas, useNotificacoes } from "@/lib/notificacoes/store";
import { CLASSE_ICONE_CABECALHO } from "@/components/layout/cabecalho-estilos";
import { cn } from "@/lib/utils";
import type { NotificacaoHub } from "@/types/database";

function haQuanto(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

function abrir(n: NotificacaoHub) {
  void marcarComoLidas({ ids: [n.id] });
  window.location.href = destinoDoAviso(n.app, n.link);
}

/**
 * Sino da Central: avisos de todos os módulos, ao vivo (Supabase Realtime —
 * não precisa atualizar a página). Os avisos do Compras continuam no próprio
 * Compras; aqui aparece só quantos chegaram e o atalho para lá.
 */
export function SinoNotificacoes({ usuarioId }: { usuarioId: string }) {
  const { lista, porApp, novo } = useNotificacoes(usuarioId);
  const [aberto, setAberto] = React.useState(false);
  const caixa = React.useRef<HTMLDivElement>(null);
  const botao = React.useRef<HTMLButtonElement>(null);
  const painel = React.useRef<HTMLDivElement>(null);
  const [topo, setTopo] = React.useState(56);

  const total = Object.values(porApp).reduce((t, n) => t + (n ?? 0), 0);
  const compras = porApp.compras ?? 0;

  React.useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!caixa.current?.contains(alvo) && !painel.current?.contains(alvo)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberto(false);
      botao.current?.focus(); // o foco volta ao sino, não se perde na página
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  React.useEffect(() => {
    if (!novo) return;
    const t = setTimeout(limparNovo, 7000);
    return () => clearTimeout(t);
  }, [novo]);

  return (
    <div ref={caixa} className="sm:relative">
      <button
        ref={botao}
        type="button"
        onClick={() => {
          setTopo((botao.current?.getBoundingClientRect().bottom ?? 48) + 8);
          setAberto((v) => !v);
        }}
        className={CLASSE_ICONE_CABECALHO}
        aria-label={total > 0 ? `Avisos: ${total} não lido(s)` : "Avisos"}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        data-tour="sino-avisos"
      >
        <Bell className={cn("h-5 w-5", novo && "animate-pulse motion-reduce:animate-none")} aria-hidden strokeWidth={1.8} />
        {total > 0 && (
          <span className="absolute right-0.5 top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cataguases-vermelho px-1 text-[11px] font-semibold leading-none text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {aberto && typeof document !== "undefined" && createPortal(
        <div
          ref={painel}
          role="dialog"
          aria-label="Avisos"
          style={{ top: topo, backgroundColor: "rgb(var(--surface))", backdropFilter: "none", WebkitBackdropFilter: "none" }}
          className="tema-atual fixed inset-x-3 z-[100] overflow-hidden rounded-xl border border-slate-200 text-slate-800 shadow-xl sm:inset-x-auto sm:right-3 sm:w-[380px]"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-cataguases-marinho">Avisos</p>
            {lista.some((n) => !n.lida_em) && (
              <button type="button" onClick={() => void marcarComoLidas()} className="inline-flex min-h-8 items-center text-xs font-medium text-cataguases-azul hover:underline">
                Marcar todas como lidas
              </button>
            )}
          </div>

          {compras > 0 && (
            <a
              href={destinoDoAviso("compras", null)}
              className="flex items-center gap-2 border-b border-slate-100 bg-teal-50/60 px-4 py-2.5 text-[13px] hover:bg-teal-50"
            >
              <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: COR_APP_AVISO.compras }} />
              <span className="flex-1">
                <b>{compras}</b> {compras === 1 ? "aviso novo" : "avisos novos"} no Compras
              </span>
              <span className="text-xs text-slate-500">abrir →</span>
            </a>
          )}

          <ul className="max-h-[60vh] overflow-y-auto">
            {lista.length === 0 && compras === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">Nenhum aviso por enquanto.</li>
            )}
            {lista.map((n) => (
              <li key={n.id} className="border-b border-slate-100 last:border-0">
                <button
                  type="button"
                  onClick={() => abrir(n)}
                  className={cn(
                    "flex min-h-11 w-full gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cataguases-azul",
                    !n.lida_em && "bg-amber-50/50"
                  )}
                >
                  <span
                    className="mt-1.5 h-2 w-2 flex-none rounded-full"
                    style={{ backgroundColor: n.lida_em ? "#CBD5E1" : COR_APP_AVISO[n.app] }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-semibold" style={{ color: COR_APP_AVISO[n.app] }}>
                        {NOME_APP_AVISO[n.app]}
                      </span>
                      <span>{haQuanto(n.criado_em)}</span>
                      {!n.lida_em && <span className="sr-only">não lido</span>}
                    </span>
                    <span className={cn("mt-0.5 block text-[13px]", !n.lida_em ? "font-semibold text-cataguases-marinho" : "text-slate-700")}>
                      {n.titulo}
                    </span>
                    {n.mensagem && <span className="mt-0.5 block truncate text-xs text-slate-500">{n.mensagem}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}

      {novo && !aberto && typeof document !== "undefined" && createPortal(
        <div
          role="status"
          style={{ backgroundColor: "rgb(var(--surface))", backdropFilter: "none", WebkitBackdropFilter: "none" }}
          className="tema-atual fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-slate-800 shadow-2xl"
        >
          <span className="mt-1 h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: COR_APP_AVISO[novo.app] }} aria-hidden />
          <button type="button" onClick={() => abrir(novo)} className="min-w-0 flex-1 text-left">
            <span className="block text-[11px] font-semibold" style={{ color: COR_APP_AVISO[novo.app] }}>
              Novo aviso · {NOME_APP_AVISO[novo.app]}
            </span>
            <span className="mt-0.5 block text-sm font-semibold text-cataguases-marinho">{novo.titulo}</span>
            {novo.mensagem && <span className="mt-0.5 block truncate text-xs text-slate-500">{novo.mensagem}</span>}
          </button>
          <button type="button" onClick={limparNovo} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar aviso">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

/** Selo de não lidos no card de um módulo da Início ("de onde vem a demanda"). */
export function SeloModulo({ usuarioId, app }: { usuarioId: string; app: NotificacaoHub["app"] }) {
  const { porApp } = useNotificacoes(usuarioId);
  const n = porApp[app] ?? 0;
  if (n === 0) return null;
  return (
    <span
      className="absolute right-3 top-3 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-cataguases-vermelho px-2 text-xs font-semibold text-white shadow-sm"
      title={`${n} ${n === 1 ? "aviso não lido" : "avisos não lidos"} neste módulo`}
    >
      {n > 99 ? "99+" : n}
      <span className="sr-only"> {n === 1 ? "aviso não lido" : "avisos não lidos"}</span>
    </span>
  );
}
