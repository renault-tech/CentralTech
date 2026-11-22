"use client";

import * as React from "react";

/**
 * Quando a rolagem de uma lista (`.emd-lista`) para, ela desacelera até o início da linha mais próxima, em vez de parar com uma linha
 * cortada ao meio. Troca o `scroll-snap` do navegador, que puxava a cada giro da roda e dava tranco: aqui nada mexe enquanto a pessoa
 * rola; só depois de uma pausa (140 ms) o ajuste começa, devagar no final (easeOutCubic), e qualquer gesto novo o cancela na hora.
 * Não renderiza nada. Respeita `prefers-reduced-motion` (sem ajuste).
 */
export function AjusteDeRolagem() {
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let animando = false;
    let ponteiro = false;
    let ultima: HTMLElement | null = null;

    const cancelar = () => {
      clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      animando = false;
    };
    const agendar = (el: HTMLElement) => {
      clearTimeout(timer);
      timer = setTimeout(() => ajustar(el), 140);
    };

    function ajustar(el: HTMLElement) {
      if (ponteiro) return agendar(el);
      const maximo = el.scrollHeight - el.clientHeight;
      const inicio = el.scrollTop;
      if (inicio <= 1 || inicio >= maximo - 1) return;
      const topo = el.getBoundingClientRect().top;
      let delta: number | null = null;
      for (const filho of Array.from(el.children)) {
        const d = filho.getBoundingClientRect().top - topo;
        if (Math.abs(d) > filho.clientHeight) continue;
        if (delta === null || Math.abs(d) < Math.abs(delta)) delta = d;
      }
      if (delta === null || Math.abs(delta) < 1.5) return;
      const alvo = Math.min(maximo, Math.max(0, inicio + delta));
      const distancia = alvo - inicio;
      const duracao = Math.min(420, 200 + Math.abs(distancia) * 3);
      const t0 = performance.now();
      animando = true;
      const quadro = (agora: number) => {
        const t = Math.min(1, (agora - t0) / duracao);
        el.scrollTop = inicio + distancia * (1 - Math.pow(1 - t, 3));
        if (t < 1) raf = requestAnimationFrame(quadro);
        else {
          raf = 0;
          animando = false;
        }
      };
      raf = requestAnimationFrame(quadro);
    }

    const aoRolar = (ev: Event) => {
      const el = ev.target;
      if (!(el instanceof HTMLElement) || !el.classList.contains("emd-lista")) return;
      ultima = el;
      if (animando) return; // são os quadros do próprio ajuste
      agendar(el);
    };
    const gesto = () => cancelar();
    const aoApertar = () => {
      ponteiro = true;
      cancelar();
    };
    const aoSoltar = () => {
      ponteiro = false;
      if (ultima) agendar(ultima);
    };

    document.addEventListener("scroll", aoRolar, true);
    document.addEventListener("wheel", gesto, { passive: true, capture: true });
    document.addEventListener("touchstart", gesto, { passive: true, capture: true });
    document.addEventListener("keydown", gesto, true);
    document.addEventListener("pointerdown", aoApertar, true);
    document.addEventListener("pointerup", aoSoltar, true);
    document.addEventListener("pointercancel", aoSoltar, true);
    return () => {
      cancelar();
      document.removeEventListener("scroll", aoRolar, true);
      document.removeEventListener("wheel", gesto, true);
      document.removeEventListener("touchstart", gesto, true);
      document.removeEventListener("keydown", gesto, true);
      document.removeEventListener("pointerdown", aoApertar, true);
      document.removeEventListener("pointerup", aoSoltar, true);
      document.removeEventListener("pointercancel", aoSoltar, true);
    };
  }, []);
  return null;
}
