"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

import type { Tour } from "@/lib/tours/tours";

/**
 * Este módulo só deve ser importado via `import("@/components/ajuda/executar-tour")`
 * (import dinâmico) — assim o driver.js e o CSS dele (poucos KB, mas sem
 * motivo para pesar em toda página) só entram no bundle quando um tour
 * realmente roda, mesmo padrão já usado para jsPDF nas exportações.
 */

/**
 * Roda o tour, pulando passos cujo elemento não existe nesta tela/estado
 * (ex.: quadro de notas vazio ainda tem o seletor do container, mas uma
 * nota específica pode não existir). Devolve `false` sem fazer nada se
 * nenhum passo tiver elemento — evita abrir um tour vazio.
 */
export function executarTour(tour: Tour, opcoes?: { aoFechar?: () => void }): boolean {
  const passos = tour.passos.filter((p) => document.querySelector(p.seletor));
  if (passos.length === 0) return false;

  const instancia = driver({
    showProgress: passos.length > 1,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Próximo",
    prevBtnText: "Voltar",
    doneBtnText: "Concluir",
    overlayColor: "#0C1D33",
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 10,
    smoothScroll: true,
    steps: passos.map((p) => ({
      element: p.seletor,
      popover: { title: p.titulo, description: p.descricao, side: p.lado ?? "bottom" },
    })),
    onDestroyed: () => opcoes?.aoFechar?.(),
  });

  instancia.drive();
  return true;
}
