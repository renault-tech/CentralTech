"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { COLUNAS_LISTA, CHAVE_COLUNAS_LOCAL, GRUPOS_COLUNAS } from "@/lib/emendas/colunas-lista";
import { CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO } from "@/components/modulo/ui";

/** Lê a escolha guardada neste navegador (null = padrão de cada formato). */
export function lerColunasGuardadas(): string[] | null {
  try {
    const bruto = localStorage.getItem(CHAVE_COLUNAS_LOCAL);
    const lista = bruto ? (JSON.parse(bruto) as string[]) : null;
    return Array.isArray(lista) && lista.length > 0 ? lista : null;
  } catch {
    return null;
  }
}

/** Acrescenta `&cols=` às URLs de exportação de lista (só as que aceitam: PDF da lista e Excel). */
export function comColunas(href: string, cols: string[] | null): string {
  return cols ? `${href}&cols=${encodeURIComponent(cols.join(","))}` : href;
}

/**
 * Cartão "Escolher colunas" aberto pelo menu Exportar: marca o que entra no PDF da lista e no Excel. A escolha fica neste
 * navegador e vale nas próximas exportações; "Voltar ao padrão" a apaga (PDF = resumo legível, Excel = tudo).
 */
export function EscolherColunas({ inicial, aoSalvar, aoFechar }: { inicial: string[] | null; aoSalvar: (cols: string[] | null) => void; aoFechar: () => void }) {
  const [marcadas, setMarcadas] = React.useState<Set<string>>(new Set(inicial ?? COLUNAS_LISTA.filter((c) => c.pdf).map((c) => c.chave)));
  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aoFechar]);

  const alternar = (k: string) =>
    setMarcadas((a) => {
      const n = new Set(a);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  function salvar() {
    const lista = COLUNAS_LISTA.filter((c) => marcadas.has(c.chave)).map((c) => c.chave);
    try {
      localStorage.setItem(CHAVE_COLUNAS_LOCAL, JSON.stringify(lista));
    } catch {
      /* vale só nesta visita */
    }
    aoSalvar(lista);
  }
  function padrao() {
    try {
      localStorage.removeItem(CHAVE_COLUNAS_LOCAL);
    } catch {
      /* ignora */
    }
    aoSalvar(null);
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] grid grid-cols-1 place-items-center overflow-y-auto bg-slate-900/50 p-3" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div role="dialog" aria-modal="true" aria-labelledby="cols-titulo" style={{ backgroundColor: "rgb(var(--surface))" }} className="relative w-full max-w-[34rem] rounded-[1.25rem] border border-slate-200 p-5 shadow-2xl">
        <button type="button" onClick={aoFechar} aria-label="Fechar" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100">
          <X className="h-4 w-4" aria-hidden />
        </button>
        <h2 id="cols-titulo" className="text-lg font-semibold text-cataguases-marinho">Colunas da lista exportada</h2>
        <p className="mt-1 text-[0.8125rem] text-slate-600">Vale para o PDF da lista e para o Excel. Sem escolha, o PDF traz o resumo e o Excel traz tudo. No PDF, acima de uns 14 itens a letra fica miúda.</p>
        <div className="mt-3 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {GRUPOS_COLUNAS.map((g) => (
            <fieldset key={g}>
              <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{g}</legend>
              <div className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {COLUNAS_LISTA.filter((c) => c.grupo === g).map((c) => (
                  <label key={c.chave} className="flex min-h-8 cursor-pointer items-center gap-2 text-[0.8125rem] text-slate-700">
                    <input type="checkbox" checked={marcadas.has(c.chave)} onChange={() => alternar(c.chave)} className="h-4 w-4 accent-[color:var(--modulo-texto)]" />
                    {c.rotulo}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMarcadas(new Set(COLUNAS_LISTA.map((c) => c.chave)))} className="text-[0.8125rem] font-medium text-slate-600 hover:text-cataguases-marinho">Marcar todas</button>
          <button type="button" onClick={padrao} className="text-[0.8125rem] font-medium text-slate-600 hover:text-cataguases-marinho">Voltar ao padrão</button>
          <span className="ml-auto text-xs tabular-nums text-slate-500">{marcadas.size} colunas</span>
          <button type="button" onClick={aoFechar} className={CLASSE_BOTAO_SECUNDARIO}>Cancelar</button>
          <button type="button" onClick={salvar} disabled={marcadas.size === 0} className={CLASSE_BOTAO}>Salvar</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
