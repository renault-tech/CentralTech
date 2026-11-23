"use client";

import * as React from "react";
import { FilterX, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/utils";

export const ehDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

/**
 * Esqueleto da área de trabalho do módulo (gráficos e filtros | lista | detalhe), usado por Emendas, Pendências e Panorama:
 * a página não rola, cada painel rola por dentro. Com um item escolhido (`aberto`) os gráficos recolhem numa faixa, a lista
 * desliza para o lugar deles e o detalhe abre à direita; `expandido` leva o detalhe à largura toda. Abaixo de 1024 px o detalhe
 * abre como folha por cima da lista (CSS em `globals.css`), com fundo que fecha ao toque. Esc recolhe o expandido ou fecha o detalhe.
 */
export function EspacoTrabalho({
  aberto,
  expandido,
  aoFechar,
  aoRecolher,
  filtrosAtivos = 0,
  aoLimpar,
  graficos,
  lista,
  rotuloLista,
  detalhe,
  rotuloDetalhe,
}: {
  aberto: boolean;
  expandido: boolean;
  aoFechar: () => void;
  aoRecolher: () => void;
  /** Quantos filtros estão valendo: aparece como selo na faixa em que os gráficos se recolhem. */
  filtrosAtivos?: number;
  /** Se informado, mostra o botão discreto "Limpar filtros" no alto da área de gráficos (apagado enquanto não há filtro). */
  aoLimpar?: () => void;
  graficos: React.ReactNode;
  lista: React.ReactNode;
  rotuloLista: string;
  detalhe: React.ReactNode;
  rotuloDetalhe: string;
}) {
  const areaRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    // Altura = o que sobra da janela abaixo do topo da área, menos só o respiro de baixo (preenchimentos/bordas dos contêineres por onde
    // ela passa). Medir isso, em vez de usar um número fixo, faz a área ir até o pé da janela em qualquer tamanho, zoom ou altura de
    // cabeçalho. Não soma a altura de irmãos: se algo invisível sobrasse abaixo, a área encolheria e deixaria uma faixa vazia.
    const MINIMO = 320; // px (não rem: com zoom do texto o rem cresceria e a página passaria a rolar)
    const html = document.documentElement;
    const rolagemOriginal = html.style.overflowY;
    const ajustar = () => {
      if (!ehDesktop()) {
        el.style.height = "";
        html.style.overflowY = rolagemOriginal;
        return;
      }
      const topo = el.getBoundingClientRect().top + window.scrollY;
      let reserva = 0;
      for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        reserva += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
        if (n !== el) reserva += parseFloat(cs.marginBottom) || 0;
      }
      const ideal = Math.floor(window.innerHeight - topo - reserva);
      const altura = Math.max(MINIMO, ideal);
      if (Math.abs((parseFloat(el.style.height) || 0) - altura) >= 1) el.style.height = `${altura}px`;
      // A página não rola enquanto a área cabe na janela (é o que ela promete); numa janela minúscula (mínimo vencendo) a rolagem volta.
      html.style.overflowY = ideal >= MINIMO ? "hidden" : rolagemOriginal;
      if (ideal >= MINIMO && window.scrollY > 0) window.scrollTo(0, 0);
    };
    ajustar();
    // Observa o corpo, o pai e tudo o que vem ANTES da área (cabeçalho, avisos, abas): se qualquer um mudar de altura, remede.
    const ro = new ResizeObserver(ajustar);
    ro.observe(document.body);
    if (el.parentElement) ro.observe(el.parentElement);
    for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
      for (let irmao = n.previousElementSibling as HTMLElement | null; irmao; irmao = irmao.previousElementSibling as HTMLElement | null) ro.observe(irmao);
    }
    window.addEventListener("resize", ajustar);
    void document.fonts?.ready.then(ajustar);
    const timers = [150, 400, 1000, 2500].map((ms) => setTimeout(ajustar, ms)); // depois da animação de entrada, da fonte e de avisos que chegam tarde
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", ajustar);
      timers.forEach(clearTimeout);
      html.style.overflowY = rolagemOriginal;
    };
  }, []);

  // Enquanto as colunas deslizam, o CSS desliga o desfoque de vidro e as animações internas (`data-movendo`): refazer o desfoque a cada
  // quadro é o que mais pesava. A marca sai logo depois da transição (0,4 s).
  const anterior = React.useRef({ aberto, expandido });
  React.useEffect(() => {
    if (anterior.current.aberto === aberto && anterior.current.expandido === expandido) return;
    anterior.current = { aberto, expandido };
    const el = areaRef.current;
    if (!el) return;
    el.dataset.movendo = "true";
    const t = setTimeout(() => delete el.dataset.movendo, 480);
    return () => clearTimeout(t);
  }, [aberto, expandido]);

  React.useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || ev.defaultPrevented) return;
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
      if (expandido) aoRecolher();
      else aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, expandido, aoFechar, aoRecolher]);

  return (
    <>
      {aberto && <button type="button" tabIndex={-1} aria-label="Fechar o detalhe" onClick={aoFechar} className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden print:hidden" />}
      <div ref={areaRef} data-detalhe={aberto} data-expandido={expandido} className="emd-ws min-h-[320px]">
        <aside data-tour="ws-graficos" aria-label="Gráficos e filtros" inert={expandido} className="emd-painel relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="emd-conteudo-graficos flex h-full flex-col" inert={aberto} aria-hidden={aberto}>
            {aoLimpar && (
              <div className="flex h-8 flex-none items-center justify-end border-b border-slate-200 px-2.5">
                <button
                  type="button"
                  onClick={aoLimpar}
                  disabled={filtrosAtivos === 0}
                  className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-slate-600 transition-colors enabled:hover:bg-slate-100 enabled:hover:text-cataguases-marinho disabled:cursor-default disabled:opacity-40"
                >
                  <FilterX className="h-3.5 w-3.5" aria-hidden />
                  Limpar filtros
                  {filtrosAtivos > 0 && <span className="tabular-nums text-[color:var(--modulo-tinta)]">({filtrosAtivos})</span>}
                </button>
              </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{graficos}</div>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            tabIndex={aberto ? 0 : -1}
            aria-hidden={!aberto}
            aria-label="Mostrar gráficos e filtros"
            title="Mostrar gráficos e filtros"
            className={cn("emd-faixa absolute inset-0 flex flex-col items-center gap-3 pt-4 text-slate-600 transition-opacity duration-300 hover:bg-[color-mix(in_srgb,var(--modulo)_7%,transparent)]", aberto ? "opacity-100" : "pointer-events-none opacity-0")}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)] text-[color:var(--modulo-tinta)]">
              <PanelLeftOpen className="h-5 w-5" aria-hidden />
            </span>
            {filtrosAtivos > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[color:var(--modulo-texto)] px-1.5 text-xs font-semibold tabular-nums text-white">{filtrosAtivos}</span>}
            <span className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 [writing-mode:vertical-rl]">Gráficos e filtros</span>
          </button>
        </aside>

        <section data-tour="ws-lista" aria-label={rotuloLista} inert={expandido} className="emd-painel flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white max-lg:h-[70dvh] print:hidden">
          {lista}
        </section>

        <section data-tour="ws-detalhe" aria-label={rotuloDetalhe} aria-hidden={!aberto} inert={!aberto} className={cn("emd-painel emd-detalhe min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white print:hidden", !aberto && "border-transparent")}>
          {detalhe}
        </section>
      </div>
    </>
  );
}
