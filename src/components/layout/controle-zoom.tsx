"use client";

import * as React from "react";
import { ALargeSmall, RotateCcw } from "lucide-react";

import { CLASSE_ICONE_CABECALHO } from "@/components/layout/cabecalho-estilos";
import { assinarZoom, definirZoom, lerZoom, limiteDoZoom, passoVizinho, PASSOS_ZOOM } from "@/lib/zoom";
import { cn } from "@/lib/utils";

/**
 * Estado do zoom: o que a pessoa ESCOLHEU (`preferido`), o que vale agora na largura desta tela (`aplicado`) e o
 * maior passo que cabe (`limite`). O instantâneo é um texto para o React comparar por valor.
 */
export function useZoom() {
  const chave = React.useSyncExternalStore(
    assinarZoom,
    () => `${lerZoom()}|${window.innerWidth}`,
    () => "100|1280"
  );
  const [preferido, largura] = chave.split("|").map(Number);
  const limite = limiteDoZoom(largura);
  return { preferido, aplicado: Math.min(preferido, limite), limite };
}

/** Ajuste do tamanho do texto: − / +, passos prontos, exemplo ao vivo e "voltar ao padrão". Usado no painel e em Minha conta. */
export function AjusteZoom() {
  const { preferido, aplicado, limite } = useZoom();
  const limitado = preferido > limite;

  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === "+" || e.key === "=") definirZoom(passoVizinho(aplicado, 1, limite));
        else if (e.key === "-") definirZoom(passoVizinho(aplicado, -1, limite));
        else if (e.key === "0") definirZoom(100);
        else return;
        e.preventDefault();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Diminuir o texto"
          disabled={aplicado <= 100}
          onClick={() => definirZoom(passoVizinho(aplicado, -1, limite))}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10"
        >
          <span className="text-sm font-semibold" aria-hidden>
            A−
          </span>
        </button>
        <output aria-live="polite" className="min-w-16 text-center text-lg font-semibold tabular-nums text-slate-900">
          {aplicado}%
        </output>
        <button
          type="button"
          aria-label="Aumentar o texto"
          disabled={aplicado >= limite}
          onClick={() => definirZoom(passoVizinho(aplicado, 1, limite))}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10"
        >
          <span className="text-lg font-semibold" aria-hidden>
            A+
          </span>
        </button>
      </div>

      <div role="radiogroup" aria-label="Tamanho do texto" className="grid grid-cols-6 gap-1">
        {PASSOS_ZOOM.map((p) => {
          const cabe = p <= limite;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={aplicado === p}
              disabled={!cabe}
              title={cabe ? undefined : "Não cabe nesta largura de tela"}
              onClick={() => definirZoom(p)}
              className={cn(
                "h-9 rounded-md border text-xs font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                aplicado === p ? "border-[color:var(--modulo-tinta)] bg-[color-mix(in_srgb,var(--modulo)_14%,transparent)] text-[color:var(--modulo-tinta)]" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              {p}
            </button>
          );
        })}
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Assim fica o texto da plataforma. Números como 1.234,56 também.</p>

      {limitado && (
        <p className="text-xs text-slate-600">
          Nesta largura de tela o máximo é {limite}%. Sua escolha de {preferido}% volta quando a tela for maior.
        </p>
      )}

      {preferido !== 100 && (
        <button
          type="button"
          onClick={() => definirZoom(100)}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Voltar ao padrão (100%)
        </button>
      )}
    </div>
  );
}

/**
 * Botão discreto de zoom. `cabecalho`: ícone igual aos do cabeçalho escuro (depois do modo escuro). `flutuante`:
 * botãozinho no canto, só nas páginas SEM cabeçalho (login, portal público…): `globals.css` o esconde quando há
 * cabeçalho, para não aparecer duas vezes.
 */
export function ControleZoom({ variante = "cabecalho" }: { variante?: "cabecalho" | "flutuante" }) {
  const [aberto, setAberto] = React.useState(false);
  const { aplicado } = useZoom();
  const container = React.useRef<HTMLDivElement>(null);
  const botao = React.useRef<HTMLButtonElement>(null);
  const flutuante = variante === "flutuante";

  React.useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (container.current && !container.current.contains(e.target as Node)) setAberto(false);
    };
    const aoApertarEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberto(false);
      botao.current?.focus();
    };
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoApertarEsc);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoApertarEsc);
    };
  }, [aberto]);

  return (
    <div ref={container} className={flutuante ? "zoom-flutuante fixed bottom-3 right-3 z-30 print:hidden" : "sm:relative print:hidden"}>
      <button
        ref={botao}
        type="button"
        aria-label={`Tamanho do texto (${aplicado}%)`}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        title="Tamanho do texto"
        onClick={() => setAberto((a) => !a)}
        className={
          flutuante
            ? "inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white/85 text-slate-600 opacity-70 shadow-sm backdrop-blur transition hover:opacity-100 focus-visible:opacity-100"
            : CLASSE_ICONE_CABECALHO
        }
      >
        <ALargeSmall className="h-5 w-5" aria-hidden strokeWidth={1.8} />
        {aplicado !== 100 && !flutuante && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--modulo)]" aria-hidden />}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Tamanho do texto"
          className={cn(
            "tema-atual z-40 rounded-lg border border-slate-200 bg-white p-4 text-slate-800 shadow-lg",
            flutuante ? "absolute bottom-full right-0 mb-2 w-72" : "absolute inset-x-3 top-full mt-1 sm:inset-x-auto sm:right-0 sm:mt-2 sm:w-72"
          )}
        >
          <p className="mb-3 text-sm font-medium">Tamanho do texto</p>
          <AjusteZoom />
        </div>
      )}
    </div>
  );
}
