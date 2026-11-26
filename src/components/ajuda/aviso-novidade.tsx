"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, Columns2, X } from "lucide-react";

import { marcarAvisoVisto } from "@/lib/actions/boas-vindas";

/**
 * Aviso de novidade, mostrado uma única vez por pessoa (a chave vai para `hub.preferencias_usuario.avisos_vistos`, então vale em qualquer
 * navegador e nos três apps; o navegador guarda uma cópia). Quem ainda não viu nem a tela de boas-vindas não recebe o aviso (já aprende
 * tudo nela): a chave é só marcada em silêncio. **Novo aviso = nova `CHAVE` e novo texto aqui; a chave antiga fica no banco, inofensiva.**
 */
const CHAVE = "alca-expandir-2026-11";
const CHAVE_LOCAL = `aviso-${CHAVE}`;

const ITENS = [
  "A alça entre a lista e o detalhe: arraste (ou use as setinhas e o teclado) para dar mais espaço a um dos dois. A sua escolha fica guardada neste navegador.",
  "“Expandir”, no cabeçalho do detalhe, leva o detalhe à tela toda, agora em todos os módulos. Esc volta à lista.",
  "A área de trabalho passou a aproveitar a altura inteira da janela, sem faixa vazia embaixo, e o detalhe se reorganiza em mais colunas quando há espaço.",
];

export function AvisoNovidade({ vistos, boasVindasVistas }: { vistos: string[]; boasVindasVistas: boolean }) {
  const [aberto, setAberto] = React.useState(false);
  const cartao = React.useRef<HTMLDivElement>(null);
  const jaVisto = vistos.includes(CHAVE);

  React.useEffect(() => {
    if (jaVisto) return;
    try {
      if (localStorage.getItem(CHAVE_LOCAL) === "1") return;
    } catch {
      /* sem armazenamento: vale o banco */
    }
    if (!boasVindasVistas) {
      void marcarAvisoVisto(CHAVE); // pessoa nova: a tela de boas-vindas já cobre isto
      return;
    }
    const t = setTimeout(() => setAberto(true), 1400);
    return () => clearTimeout(t);
  }, [jaVisto, boasVindasVistas]);

  const fechar = React.useCallback(() => {
    setAberto(false);
    try {
      localStorage.setItem(CHAVE_LOCAL, "1");
    } catch {
      /* ignora */
    }
    void marcarAvisoVisto(CHAVE);
  }, []);

  React.useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    cartao.current?.querySelector<HTMLElement>("[data-principal]")?.focus();
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      if (e.key === "Tab") {
        e.preventDefault();
        cartao.current?.querySelector<HTMLElement>("[data-principal]")?.focus();
      }
    };
    document.addEventListener("keydown", aoTecla);
    return () => {
      document.removeEventListener("keydown", aoTecla);
      anterior?.focus?.();
    };
  }, [aberto, fechar]);

  if (!aberto || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[85] grid grid-cols-1 place-items-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div ref={cartao} role="dialog" aria-modal="true" aria-labelledby="novidade-titulo" style={{ backgroundColor: "rgb(var(--surface))" }} className="relative w-full max-w-[30rem] rounded-[1.25rem] border border-slate-200 p-6 shadow-2xl sm:p-7">
        <button type="button" onClick={fechar} aria-label="Fechar" className="absolute right-3 top-3 grid h-11 w-11 grid-cols-1 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-cataguases-marinho">
          <X className="h-5 w-5" aria-hidden />
        </button>
        <span className="grid h-11 w-11 grid-cols-1 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--modulo,#E9A63B)_14%,transparent)] text-[color:var(--modulo-tinta,#0F766E)]" aria-hidden>
          <Columns2 className="h-6 w-6" />
        </span>
        <p className="mt-3 text-[0.75rem] font-semibold uppercase tracking-[0.09em] text-slate-500">Novidade</p>
        <h2 id="novidade-titulo" className="mt-1 text-[1.25rem] font-semibold leading-tight tracking-[-0.02em] text-cataguases-marinho text-balance">
          Mais espaço para o detalhe, do seu jeito
        </h2>
        <ul className="mt-4 space-y-2.5">
          {ITENS.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[0.875rem] leading-snug text-slate-700">
              <Check className="mt-0.5 h-4 w-4 flex-none text-[color:var(--modulo-tinta,#0F766E)]" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <button type="button" data-principal onClick={fechar} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[color:var(--modulo-texto,#0C1D33)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500">
          Entendi
        </button>
      </div>
    </div>,
    document.body
  );
}
