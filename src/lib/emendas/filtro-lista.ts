/**
 * Filtro da lista de Emendas (puro, testado em `painel-lista.test.ts`). A tabela e as contagens das abas de tipo e
 * dos botões de etapa usam a MESMA função, então o número de cada botão é exatamente o que a lista passa a mostrar.
 */

import { tipoDaEmenda } from "@/lib/emendas/fases";
import { combinaSituacaoFinanceira } from "@/lib/emendas/regras";
import type { EmendaResumo } from "@/types/emendas";

/** O que a lista precisa saber de cada emenda sobre pendências (vem de `resumoDaLinha`). */
export type PendenciasDaLinha = { abertas?: number; regras?: string[] };

export type FiltrosLista = {
  v: string;
  s: string;
  etapa: string;
  t: string;
  p: string;
  situacao: string;
  fin: string;
  sd: string;
  cat: string;
  rem: string;
  pe: string;
  numeros: number[];
  /** Texto da busca já normalizado (sem acento, minúsculo). */
  q: string;
};
export type ChaveLista = "v" | "s" | "etapa" | "t" | "situacao" | "fin" | "sd" | "cat" | "rem" | "pe" | "p";

export function normalizarTexto(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function lerFiltrosLista(get: (k: string) => string | null | undefined, busca = ""): FiltrosLista {
  const v = (k: string) => get(k) ?? "";
  return {
    v: v("v"), s: v("s"), etapa: v("etapa"), t: v("t"), p: v("p"), situacao: v("situacao"), fin: v("fin"),
    sd: v("sd"), cat: v("cat"), rem: v("rem"), pe: v("pe"),
    numeros: v("numeros").split(",").filter(Boolean).map(Number),
    q: normalizarTexto(busca.trim()),
  };
}

/** Emendas que passam nos filtros. `ignorar` tira o próprio filtro de um gráfico, para ele mostrar todas as opções. */
export function filtrarEmendasLista(
  emendas: EmendaResumo[],
  pendencias: Record<string, PendenciasDaLinha | undefined>,
  f: FiltrosLista,
  ignorar: ChaveLista[] = []
): EmendaResumo[] {
  const usa = (k: ChaveLista) => !ignorar.includes(k);
  return emendas.filter(
    (r) =>
      (!usa("p") || !f.p || (pendencias[r.id]?.abertas ?? 0) > 0) &&
      (!usa("pe") || !f.pe || (pendencias[r.id]?.regras ?? []).includes(f.pe)) &&
      (!usa("fin") || !f.fin || combinaSituacaoFinanceira(f.fin, r)) &&
      (!usa("sd") || !f.sd || (f.sd === "1" ? r.saude : !r.saude)) &&
      (!usa("cat") || !f.cat || r.beneficiario_categoria === f.cat) &&
      (!usa("rem") || !f.rem || (f.rem === "1" ? r.remanejada : !r.remanejada)) &&
      (!usa("v") || !f.v || r.vereador_id === f.v) &&
      (!usa("s") || !f.s || r.secretaria_id === f.s) &&
      (!usa("situacao") || !f.situacao || r.situacao === f.situacao) &&
      (!usa("t") || !f.t || tipoDaEmenda(r) === f.t) &&
      (!usa("etapa") || !f.etapa || r.etapa === f.etapa) &&
      (f.numeros.length === 0 || f.numeros.includes(r.numero)) &&
      (!f.q ||
        f.q.split(/\s+/).every((parte) =>
          normalizarTexto([r.numero, r.objeto, r.beneficiario_nome ?? "", r.vereador_nome, r.secretaria_nome, r.unidade_codigo, r.ficha ?? ""].join(" ")).includes(parte)
        ))
  );
}
