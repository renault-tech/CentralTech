"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { tourPorId } from "@/lib/tours/tours";

/** Chave de sessão usada para "agendar" um tour antes de navegar até a rota dele. */
export const CHAVE_TOUR_PENDENTE = "tour-pendente";

/** Chave persistida (para sempre, neste navegador) indicando que o tour de boas-vindas já rodou. */
const CHAVE_TOUR_VISTO = "tour-boas-vindas-visto";

/**
 * Componente invisível, montado uma vez no AppShell: dispara o tour de
 * boas-vindas no primeiro acesso de sempre (marca em localStorage) e, se a
 * Central de Ajuda agendou um tour de outra página (via `sessionStorage`),
 * roda-o assim que a rota certa carrega.
 *
 * Lê `localStorage` direto dentro do efeito (em vez de `usePreferenciaLocal`)
 * de propósito: o efeito de boas-vindas só roda uma vez, com deps `[]`, e um
 * hook reativo baseado em `useSyncExternalStore` pode entregar o valor
 * padrão do servidor (sempre "não visto") nesse primeiro disparo — a
 * correção de hidratação chega depois, mas o efeito com `[]` nunca reexecuta
 * para pegá-la. Como este componente não renderiza nada, não há motivo para
 * reatividade aqui: uma leitura direta e síncrona no momento do efeito basta.
 */
export function GerenciadorTours() {
  const pathname = usePathname();
  const jaTentouBoasVindas = React.useRef(false);

  // Tour agendado de outra tela (Central de Ajuda → navegar → rodar aqui).
  React.useEffect(() => {
    const idPendente = sessionStorage.getItem(CHAVE_TOUR_PENDENTE);
    if (!idPendente) return;
    const tour = tourPorId(idPendente);
    if (!tour || (tour.rota && !pathname.startsWith(tour.rota))) return;

    sessionStorage.removeItem(CHAVE_TOUR_PENDENTE);
    const timer = setTimeout(() => {
      void import("@/components/ajuda/executar-tour").then(({ executarTour }) => {
        executarTour(tour);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Boas-vindas: uma única vez, na vida do navegador.
  React.useEffect(() => {
    if (jaTentouBoasVindas.current) return;
    if (localStorage.getItem(CHAVE_TOUR_VISTO) === "1") return;
    if (sessionStorage.getItem(CHAVE_TOUR_PENDENTE)) return;
    jaTentouBoasVindas.current = true;

    const timer = setTimeout(() => {
      const tour = tourPorId("boas-vindas");
      if (!tour) return;
      void import("@/components/ajuda/executar-tour").then(({ executarTour }) => {
        const rodou = executarTour(tour, {
          aoFechar: () => localStorage.setItem(CHAVE_TOUR_VISTO, "1"),
        });
        if (!rodou) localStorage.setItem(CHAVE_TOUR_VISTO, "1");
      });
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
