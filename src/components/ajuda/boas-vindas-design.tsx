"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LayoutDashboard,
  MousePointerClick,
  PanelRightOpen,
  Palette,
  X,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";

import { marcarBoasVindasDesign } from "@/lib/actions/boas-vindas";
import { cn } from "@/lib/utils";

/**
 * Boas-vindas ao novo design: um cartão central, uma única vez por pessoa (o "visto" vai para o banco, então vale em
 * todos os navegadores e em Hub, Compras e Requerimentos; o navegador guarda uma cópia para não repetir se a rede falhar).
 * Cada tela do tour é uma ideia só, com o jeito de usar. Esc ou "Pular" fecham e contam como visto.
 */

type Passo = { icone: LucideIcon; titulo: string; texto: string; dicas: string[] };

export type AppBoasVindas = "hub" | "compras" | "requerimentos";

const CHAVE_LOCAL = "boas-vindas-novo-design-2026-11";

function passos(app: AppBoasVindas): Passo[] {
  const lateral =
    app === "requerimentos"
      ? "Os requerimentos continuam no mesmo lugar, com o painel de prazos logo na abertura."
      : "Os módulos ganharam um menu lateral, agrupado por assunto. Dá para recolher com o botão do menu ou com a tecla [ e ele lembra a sua escolha.";
  return [
    {
      icone: LayoutDashboard,
      titulo: "A Central ganhou um novo visual",
      texto: "Mesmo conteúdo, mesmo lugar, mais claro e mais rápido. Os módulos agora seguem o mesmo padrão, então quem aprende um já sabe usar todos.",
      dicas: [lateral, "O botão “← Central” no alto leva de volta à tela inicial, de qualquer módulo.", "No celular o menu vira uma faixa de abas no topo."],
    },
    {
      icone: MousePointerClick,
      titulo: "Os gráficos agora filtram",
      texto: "Clique numa fatia, barra ou linha de um gráfico e a lista ao lado já mostra só aquilo. Não precisa mais procurar o botão “Filtrar”.",
      dicas: [
        "Cada gráfico tem um seletor para trocar o que ele mostra (por situação, secretaria, prazo…).",
        "Dois gráficos se combinam: filtre num e no outro ao mesmo tempo.",
        "Os filtros ativos aparecem como etiquetas com ✕. Clique no ✕ para tirar um, ou em “Limpar” para tirar todos.",
      ],
    },
    {
      icone: PanelRightOpen,
      titulo: "Lista e detalhe lado a lado",
      texto: "Clique numa linha da lista e o resumo abre ao lado, sem sair da tela e sem perder o filtro. Quem pode editar faz as ações ali mesmo.",
      dicas: [
        "Use as setas do teclado para passar de um item ao outro e Esc para fechar o resumo.",
        "“Expandir” dá mais espaço ao detalhe; no celular ele abre como uma folha por cima da lista.",
        "O que você filtrou fica guardado: ao voltar de um item, a lista está como você deixou.",
      ],
    },
    {
      icone: MessageSquareText,
      titulo: "Passe o mouse para saber mais",
      texto: "Números, barras e etapas têm uma caixa de informação: valores completos, o que cada cor significa e o que falta fazer.",
      dicas: ["A caixa aparece depois de um segundo com o mouse parado, para não atrapalhar quem só está passando.", "Nos painéis de abertura, cada cartão e cada linha leva direto à lista já filtrada."],
    },
    {
      icone: Palette,
      titulo: "Do seu jeito",
      texto: "Ajuste a tela ao seu conforto. As escolhas ficam salvas na sua conta.",
      dicas: [
        "“Aa” no alto aumenta o tamanho das letras (o limite se ajusta ao tamanho da sua tela).",
        "A lua alterna entre modo claro e escuro. Em Minha conta → Aparência você escolhe também o estilo.",
        "O “?” no alto repete o tutorial da tela e “Novidades” mostra tudo o que mudou, com data.",
      ],
    },
  ];
}

export function BoasVindasDesign({ app, jaVisto }: { app: AppBoasVindas; jaVisto: boolean }) {
  const [aberto, setAberto] = React.useState(false);
  const [indice, setIndice] = React.useState(0);
  const cartao = React.useRef<HTMLDivElement>(null);
  const lista = React.useMemo(() => passos(app), [app]);

  React.useEffect(() => {
    if (jaVisto) return;
    try {
      if (localStorage.getItem(CHAVE_LOCAL) === "1") return;
    } catch {
      /* sem armazenamento: vale o banco */
    }
    const t = setTimeout(() => setAberto(true), 700);
    return () => clearTimeout(t);
  }, [jaVisto]);

  const fechar = React.useCallback(() => {
    setAberto(false);
    try {
      localStorage.setItem(CHAVE_LOCAL, "1");
    } catch {
      /* ignora */
    }
    void marcarBoasVindasDesign();
    window.dispatchEvent(new Event("boas-vindas-design-fechada"));
  }, []);

  // Teclado: Esc fecha, setas navegam; o foco fica preso no cartão enquanto ele está aberto.
  React.useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    cartao.current?.querySelector<HTMLElement>("[data-principal]")?.focus();
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") return fechar();
      if (e.key === "ArrowRight") setIndice((i) => Math.min(lista.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(0, i - 1));
      if (e.key !== "Tab" || !cartao.current) return;
      const foco = cartao.current.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (foco.length === 0) return;
      const primeiro = foco[0];
      const ultimo = foco[foco.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoTecla);
    return () => {
      document.removeEventListener("keydown", aoTecla);
      anterior?.focus?.();
    };
  }, [aberto, fechar, lista.length]);

  if (!aberto || typeof document === "undefined") return null;

  const passo = lista[indice];
  const Icone = passo.icone;
  const ultimo = indice === lista.length - 1;

  return createPortal(
    <div data-boas-vindas-design className="fixed inset-0 z-[90] grid grid-cols-1 place-items-center overflow-y-auto bg-slate-900/60 p-3 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div
        ref={cartao}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bv-titulo"
        style={{ backgroundColor: "rgb(var(--surface))" }}
        className="relative w-full max-w-[34rem] overflow-hidden rounded-[1.25rem] border border-slate-200 shadow-2xl motion-safe:animate-[bv-entra_0.28s_ease-out]"
      >
        <div
          className="relative px-6 pb-5 pt-6 text-[#EAF0F9] sm:px-8"
          style={{ background: "radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--modulo, #E9A63B) 55%, transparent), transparent 60%), linear-gradient(135deg, #0C1D33, #12294A)" }}
        >
          <button type="button" onClick={fechar} aria-label="Fechar e não mostrar de novo" className="absolute right-3 top-3 grid grid-cols-1 h-11 w-11 place-items-center rounded-full text-[#AEBBD0] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E9A63B]">
            <X className="h-5 w-5" aria-hidden />
          </button>
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.09em] text-[#AEBBD0]">Novo design · {indice + 1} de {lista.length}</p>
          <span className="mt-3 grid grid-cols-1 h-12 w-12 place-items-center rounded-2xl bg-white/12 text-[#E9A63B]" aria-hidden>
            <Icone className="h-6 w-6" />
          </span>
          <h2 id="bv-titulo" className="mt-3 text-[1.5rem] font-semibold leading-tight tracking-[-0.02em] text-balance">
            {passo.titulo}
          </h2>
        </div>

        <div className="px-6 py-5 sm:px-8">
          <p className="text-[0.9375rem] leading-relaxed text-slate-700">{passo.texto}</p>
          <ul className="mt-4 space-y-2.5">
            {passo.dicas.map((d) => (
              <li key={d} className="flex items-start gap-2.5 text-[0.875rem] leading-snug text-slate-700">
                <Check className="mt-0.5 h-4 w-4 flex-none text-[color:var(--modulo-tinta,#0F766E)]" aria-hidden />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Passos">
            {lista.map((p, i) => (
              <button
                key={p.titulo}
                type="button"
                role="tab"
                aria-selected={i === indice}
                aria-label={`Passo ${i + 1}: ${p.titulo}`}
                onClick={() => setIndice(i)}
                className="grid grid-cols-1 h-6 w-5 place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
              >
                <span className={cn("h-2 rounded-full transition-all", i === indice ? "w-5 bg-[color:var(--modulo-texto,#0C1D33)]" : "w-2 bg-slate-300")} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {indice > 0 ? (
              <button type="button" onClick={() => setIndice(indice - 1)} className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-[0.875rem] font-medium text-slate-700 transition-colors hover:bg-slate-100 sm:h-9">
                <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
              </button>
            ) : (
              <button type="button" onClick={fechar} className="inline-flex h-11 items-center rounded-xl px-3 text-[0.875rem] font-medium text-slate-600 transition-colors hover:bg-slate-100 sm:h-9">
                Pular
              </button>
            )}
            <button
              type="button"
              data-principal
              onClick={() => (ultimo ? fechar() : setIndice(indice + 1))}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-[0.875rem] font-semibold text-white transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 sm:h-9"
              style={{ backgroundColor: "var(--modulo-texto, #0C1D33)" }}
            >
              {ultimo ? "Começar a usar" : "Próximo"}
              {!ultimo && <ArrowRight className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes bv-entra{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    </div>,
    document.body
  );
}
