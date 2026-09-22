"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { CircleHelp, PlayCircle } from "lucide-react";

import { CHAVE_TOUR_PENDENTE } from "@/components/ajuda/gerenciador-tours";
import { TOURS, tourPorRota, type Tour } from "@/lib/tours/tours";
import { cn } from "@/lib/utils";

/**
 * Botão de ajuda no header (Bloco 5): roda o tour da tela atual e, num
 * painel, lista todos os tours disponíveis ("Central de Ajuda") — inclusive
 * os de outras páginas, navegando até lá antes de rodar.
 */
export function BotaoAjuda() {
  const [aberto, setAberto] = React.useState(false);
  const [semTour, setSemTour] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const tourDaTela = tourPorRota(pathname);

  React.useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  async function iniciar(tour: Tour) {
    setAberto(false);
    setSemTour(false);

    const jaEstaNaRota = tour.rota === "" || pathname.startsWith(tour.rota);
    if (!jaEstaNaRota) {
      sessionStorage.setItem(CHAVE_TOUR_PENDENTE, tour.id);
      router.push(tour.rota);
      return;
    }

    const { executarTour } = await import("@/components/ajuda/executar-tour");
    const rodou = executarTour(tour);
    if (!rodou) setSemTour(true);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-tour="botao-ajuda"
        aria-label="Ajuda"
        onClick={() => setAberto((a) => !a)}
        className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-[rgba(12,29,51,0.1)] bg-white text-slate-600 transition-colors hover:bg-slate-100"
      >
        <CircleHelp className="h-5 w-5" aria-hidden strokeWidth={1.8} />
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-lg border border-slate-200 bg-white text-slate-800 shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-medium">Central de ajuda</p>
          </div>

          {tourDaTela && (
            <button
              type="button"
              onClick={() => void iniciar(tourDaTela)}
              className="flex w-full items-start gap-2.5 border-b border-slate-100 bg-cataguases-azul/5 px-4 py-2.5 text-left text-sm hover:bg-cataguases-azul/10"
            >
              <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-cataguases-azul" aria-hidden />
              <span>
                <span className="block font-medium text-cataguases-marinho">Tour desta tela</span>
                <span className="block text-xs text-slate-500">{tourDaTela.descricao}</span>
              </span>
            </button>
          )}

          <ul className="max-h-72 overflow-y-auto">
            {TOURS.map((tour) => (
              <li key={tour.id}>
                <button
                  type="button"
                  onClick={() => void iniciar(tour)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 border-b border-slate-50 px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50",
                    tour.id === tourDaTela?.id && "text-slate-400"
                  )}
                >
                  <span className="font-medium">{tour.nome}</span>
                  <span className="text-xs text-slate-400">{tour.descricao}</span>
                </button>
              </li>
            ))}
          </ul>

          {semTour && (
            <p className="px-4 py-2.5 text-xs text-slate-400">
              Nada para destacar nesta tela agora.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
