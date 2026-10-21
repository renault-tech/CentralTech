"use client";

import * as React from "react";

import { criarClienteNavegador } from "@/lib/supabase/client";
import type { AppNotificacao, NotificacaoHub } from "@/types/database";

/**
 * Estado dos avisos no navegador — um só por aba, compartilhado entre o sino
 * do cabeçalho e os selos dos cards (`useNotificacoes`). Carrega uma vez e
 * assina o Supabase Realtime: `hub.notificacoes` (Requerimentos, Emendas,
 * Central) e `public.notificacoes` (Compras, que já tinha a sua tabela). Cada
 * evento relê a lista e o resumo — a RLS garante que só chegam os avisos da
 * própria pessoa.
 */

export type EstadoNotificacoes = {
  carregado: boolean;
  lista: NotificacaoHub[];
  /** Não lidas por módulo (Compras: só a partir do corte da Central). */
  porApp: Partial<Record<AppNotificacao, number>>;
  /** Último aviso que chegou ao vivo (para o destaque/toast). */
  novo: NotificacaoHub | null;
};

const VAZIO: EstadoNotificacoes = { carregado: false, lista: [], porApp: {}, novo: null };

let estado: EstadoNotificacoes = VAZIO;
const ouvintes = new Set<() => void>();
let iniciadoPara: string | null = null;
let releitura: ReturnType<typeof setTimeout> | null = null;

function publicar(parcial: Partial<EstadoNotificacoes>) {
  estado = { ...estado, ...parcial };
  for (const o of ouvintes) o();
}

async function recarregar() {
  const supabase = criarClienteNavegador();
  const [{ data: lista }, { data: resumo }] = await Promise.all([
    supabase.from("notificacoes").select("*").order("criado_em", { ascending: false }).limit(30),
    supabase.rpc("resumo_notificacoes"),
  ]);
  const porApp: EstadoNotificacoes["porApp"] = {};
  for (const r of resumo ?? []) porApp[r.app] = r.nao_lidas;
  publicar({ carregado: true, lista: lista ?? [], porApp });
}

function agendarReleitura() {
  if (releitura) clearTimeout(releitura);
  releitura = setTimeout(() => void recarregar(), 300);
}

async function iniciar(usuarioId: string) {
  if (iniciadoPara === usuarioId) return;
  iniciadoPara = usuarioId;
  await recarregar();

  const supabase = criarClienteNavegador();
  const { data } = await supabase.auth.getSession();
  if (data.session) supabase.realtime.setAuth(data.session.access_token);

  supabase
    .channel(`avisos-${usuarioId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "hub", table: "notificacoes", filter: `destinatario_id=eq.${usuarioId}` },
      (payload) => {
        publicar({ novo: payload.new as NotificacaoHub });
        agendarReleitura();
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "hub", table: "notificacoes", filter: `destinatario_id=eq.${usuarioId}` },
      () => agendarReleitura()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notificacoes", filter: `destinatario_id=eq.${usuarioId}` },
      () => agendarReleitura()
    )
    .subscribe();
}

export function useNotificacoes(usuarioId: string): EstadoNotificacoes {
  React.useEffect(() => {
    void iniciar(usuarioId);
  }, [usuarioId]);
  return React.useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    () => estado,
    () => VAZIO
  );
}

/** Marca como lidas (todas, as de um módulo ou ids específicos) e relê. */
export async function marcarComoLidas(filtro: { ids?: string[]; app?: AppNotificacao } = {}) {
  const supabase = criarClienteNavegador();
  // Atualiza na hora, sem esperar o servidor (a releitura confirma).
  publicar({
    lista: estado.lista.map((n) =>
      !n.lida_em && (!filtro.ids || filtro.ids.includes(n.id)) && (!filtro.app || n.app === filtro.app)
        ? { ...n, lida_em: new Date().toISOString() }
        : n
    ),
  });
  await supabase.rpc("marcar_notificacoes_lidas", { p_ids: filtro.ids ?? null, p_app: filtro.app ?? null });
  await recarregar();
}

export function limparNovo() {
  publicar({ novo: null });
}
