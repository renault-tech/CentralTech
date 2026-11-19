/**
 * Cálculos do dashboard da lista de Emendas (puro, testado em `painel-lista.test.ts`). A tabela e o painel usam
 * o MESMO filtro (`filtrarEmendasLista`), então o que o gráfico mostra é exatamente o que a lista exibe.
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

/**
 * Quanto uma emenda "combina" com o texto buscado (maior = mais perto). Número igual ao digitado vale mais que número que
 * começa com ele, que vale mais que número que o contém; depois vêm as palavras do objeto, do beneficiário e do vereador
 * (começo de palavra antes de meio de palavra). Com várias palavras, somam-se os pontos de cada uma.
 * `q` já vem normalizado (sem acento, minúsculo); sem texto, tudo vale 0 e a ordem original se mantém.
 */
export function pontuarBusca(campos: { numero: number; objeto: string; outros: string[] }, q: string): number {
  const partes = q.split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 0;
  const numero = String(campos.numero);
  const objeto = normalizarTexto(campos.objeto);
  const outros = normalizarTexto(campos.outros.join(" "));
  const comecoDePalavra = (texto: string, parte: string) => texto.startsWith(parte) || texto.includes(` ${parte}`);
  let total = 0;
  for (const parte of partes) {
    if (numero === parte) total += 1000;
    else if (numero.startsWith(parte)) total += 700;
    else if (numero.includes(parte)) total += 450;
    else if (comecoDePalavra(objeto, parte)) total += 300;
    else if (comecoDePalavra(outros, parte)) total += 200;
    else if (objeto.includes(parte)) total += 100;
    else if (outros.includes(parte)) total += 50;
  }
  return total;
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

/** Situação financeira EXCLUSIVA (cada emenda cai em uma só), a ordem de `combinaSituacaoFinanceira` na lista. */
export const CLASSES_FINANCEIRAS = [
  ["paga", "Totalmente paga"],
  ["paga_parcial", "Paga em parte"],
  ["empenhada_sem_pagamento", "Empenhada, sem pagamento"],
  ["sem_empenho", "Sem empenho"],
] as const;

export function classeFinanceira(r: Pick<EmendaResumo, "valor" | "empenhado" | "pago">): (typeof CLASSES_FINANCEIRAS)[number][0] {
  if (r.valor > 0 && r.pago >= r.valor - 0.005) return "paga";
  if (r.pago > 0.005) return "paga_parcial";
  if (r.empenhado > 0.005) return "empenhada_sem_pagamento";
  return "sem_empenho";
}

export type Totais = { n: number; valor: number; empenhado: number; pago: number; comPendencia: number };

export function somar(emendas: EmendaResumo[], pendencias: Record<string, PendenciasDaLinha | undefined>): Totais {
  const t: Totais = { n: 0, valor: 0, empenhado: 0, pago: 0, comPendencia: 0 };
  for (const e of emendas) {
    t.n += 1;
    t.valor += e.valor;
    t.empenhado += e.empenhado;
    t.pago += e.pago;
    if ((pendencias[e.id]?.abertas ?? 0) > 0) t.comPendencia += 1;
  }
  return t;
}

/** Quanto do valor indicado está pago, só empenhado ou ainda sem empenho (cada parte limitada ao valor da emenda). */
export function faixaFinanceira(emendas: EmendaResumo[]): { pago: number; aPagar: number; semEmpenho: number } {
  let pago = 0, aPagar = 0, semEmpenho = 0;
  for (const e of emendas) {
    const p = Math.min(Math.max(e.pago, 0), e.valor);
    const emp = Math.min(Math.max(e.empenhado, 0), e.valor);
    pago += p;
    aPagar += Math.max(0, emp - p);
    semEmpenho += Math.max(0, e.valor - Math.max(emp, p));
  }
  return { pago, aPagar, semEmpenho };
}

export type GrupoLista = Totais & { chave: string; rotulo: string };

/**
 * Agrupa as emendas por uma ou mais chaves (uma emenda pode cair em vários grupos, como nas pendências por
 * assunto; nesse caso a soma passa do total de emendas e a tela avisa).
 */
export function agruparLista(
  emendas: EmendaResumo[],
  pendencias: Record<string, PendenciasDaLinha | undefined>,
  chaves: (e: EmendaResumo) => { chave: string; rotulo: string }[]
): GrupoLista[] {
  const m = new Map<string, GrupoLista>();
  for (const e of emendas) {
    for (const k of chaves(e)) {
      let g = m.get(k.chave);
      if (!g) {
        g = { chave: k.chave, rotulo: k.rotulo, n: 0, valor: 0, empenhado: 0, pago: 0, comPendencia: 0 };
        m.set(k.chave, g);
      }
      g.n += 1;
      g.valor += e.valor;
      g.empenhado += e.empenhado;
      g.pago += e.pago;
      if ((pendencias[e.id]?.abertas ?? 0) > 0) g.comPendencia += 1;
    }
  }
  return Array.from(m.values());
}
