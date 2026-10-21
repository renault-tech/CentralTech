"use client";

import * as React from "react";
import { Bell, X } from "lucide-react";

import { COR_APP_AVISO, NOME_APP_AVISO, destinoDoAviso } from "@/lib/notificacoes/links";
import { limparNovo, marcarComoLidas, useNotificacoes } from "@/lib/notificacoes/store";
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

  const total = Object.values(porApp).reduce((t, n) => t + (n ?? 0), 0);
  const compras = porApp.compras ?? 0;

  React.useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
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
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={total > 0 ? `Avisos: ${total} não lido(s)` : "Avisos"}
        aria-expanded={aberto}
        data-tour="sino-avisos"
      >
        <Bell className={cn("h-[18px] w-[18px]", novo && "animate-pulse")} aria-hidden />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cataguases-vermelho px-1 text-[10px] font-semibold text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-cataguases-marinho">Avisos</p>
            {lista.some((n) => !n.lida_em) && (
              <button type="button" onClick={() => void marcarComoLidas()} className="text-xs font-medium text-cataguases-azul hover:underline">
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
                  className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50", !n.lida_em && "bg-amber-50/50")}
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
        </div>
      )}

      {novo && !aberto && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-slate-800 shadow-2xl"
        >
          <span className="mt-1 h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: COR_APP_AVISO[novo.app] }} aria-hidden />
          <button type="button" onClick={() => abrir(novo)} className="min-w-0 flex-1 text-left">
            <span className="block text-[11px] font-semibold" style={{ color: COR_APP_AVISO[novo.app] }}>
              Novo aviso · {NOME_APP_AVISO[novo.app]}
            </span>
            <span className="mt-0.5 block text-sm font-semibold text-cataguases-marinho">{novo.titulo}</span>
            {novo.mensagem && <span className="mt-0.5 block truncate text-xs text-slate-500">{novo.mensagem}</span>}
          </button>
          <button type="button" onClick={limparNovo} className="text-slate-400 hover:text-slate-600" aria-label="Fechar aviso">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
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
