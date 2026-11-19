import { describe, expect, it } from "vitest";

import { agruparLista, classeFinanceira, faixaFinanceira, filtrarEmendasLista, lerFiltrosLista, somar } from "@/lib/emendas/painel-lista";
import type { EmendaResumo } from "@/types/emendas";

const base = {
  ano: 2026, numero_vereador: 1, descricao: "", saude: false, modalidade: "repasse", tipo_execucao: "osc", etapa: "indicada", situacao: "normal",
  etapa_atualizada_em: "", criado_em: "", atualizado_em: "", funcional_programatica: null, natureza_despesa: null, dotacao_texto: null, ficha: null,
  vereador_id: "v1", vereador_numero: 1, vereador_nome: "Ana", beneficiario_id: null, beneficiario_nome: "Casa Azul", beneficiario_cnpj: null,
  beneficiario_categoria: "osc", unidade_id: "u", unidade_codigo: "02.01", unidade_nome: "U", secretaria_id: "s1", secretaria_nome: "Saúde",
  empenhado: 0, liquidado: 0, pago: 0, ultimo_pagamento: null, remanejada: false, impedimentos_abertos: 0,
};
const e = (o: Partial<EmendaResumo> & { id: string; numero: number }): EmendaResumo => ({ objeto: "Reforma", valor: 1000, ...base, ...o }) as unknown as EmendaResumo;
const L = [
  e({ id: "a", numero: 1, valor: 1000, empenhado: 1000, pago: 1000, etapa: "paga", saude: true }),
  e({ id: "b", numero: 2, valor: 500, empenhado: 500, pago: 200, vereador_id: "v2", secretaria_id: "s2", secretaria_nome: "Educação" }),
  e({ id: "c", numero: 3, valor: 300, tipo_execucao: "direta", modalidade: "direta", objeto: "Ônibus escolar" }),
  e({ id: "d", numero: 4, valor: 200, empenhado: 200, situacao: "impedida" }),
];
const pend = { a: { abertas: 0, regras: [] }, b: { abertas: 2, regras: ["vigencia", "sem_conta"] }, c: { abertas: 1, regras: ["vigencia"] }, d: { abertas: 0, regras: [] } };
const F = lerFiltrosLista(() => "");
const nums = (xs: EmendaResumo[]) => xs.map((x) => x.numero);

describe("lista de emendas: filtros do dashboard", () => {
  it("sem filtro devolve tudo; cada filtro corta e `ignorar` tira só o próprio", () => {
    expect(filtrarEmendasLista(L, pend, F)).toHaveLength(4);
    expect(nums(filtrarEmendasLista(L, pend, { ...F, v: "v2" }))).toEqual([2]);
    expect(nums(filtrarEmendasLista(L, pend, { ...F, t: "direta" }))).toEqual([3]);
    expect(nums(filtrarEmendasLista(L, pend, { ...F, etapa: "paga" }))).toEqual([1]);
    expect(nums(filtrarEmendasLista(L, pend, { ...F, sd: "1" }))).toEqual([1]);
    expect(nums(filtrarEmendasLista(L, pend, { ...F, sd: "0" }))).toEqual([2, 3, 4]);
    expect(nums(filtrarEmendasLista(L, pend, { ...F, situacao: "impedida" }))).toEqual([4]);
    expect(nums(filtrarEmendasLista(L, pend, { ...F, p: "1" }))).toEqual([2, 3]);
    expect(nums(filtrarEmendasLista(L, pend, { ...F, pe: "vigencia" }))).toEqual([2, 3]);
    expect(nums(filtrarEmendasLista(L, pend, { ...F, pe: "sem_conta" }))).toEqual([2]);
    expect(nums(filtrarEmendasLista(L, pend, { ...F, fin: "paga" }))).toEqual([1]);
    expect(nums(filtrarEmendasLista(L, pend, { ...F, v: "v2", t: "direta" }, ["v"]))).toEqual([3]);
  });

  it("busca ignora acento e caixa; lista de números do alerta restringe", () => {
    expect(nums(filtrarEmendasLista(L, pend, lerFiltrosLista(() => "", "onibus ESCOLAR")))).toEqual([3]);
    expect(nums(filtrarEmendasLista(L, pend, lerFiltrosLista((k) => (k === "numeros" ? "1,4" : ""))))).toEqual([1, 4]);
  });
});

describe("lista de emendas: números do dashboard", () => {
  it("classe financeira é exclusiva e a faixa respeita o valor de cada emenda", () => {
    expect(L.map(classeFinanceira)).toEqual(["paga", "paga_parcial", "sem_empenho", "empenhada_sem_pagamento"]);
    const f = faixaFinanceira(L);
    expect(f).toEqual({ pago: 1200, aPagar: 500, semEmpenho: 300 });
    expect(f.pago + f.aPagar + f.semEmpenho).toBe(2000);
    // empenho acima do valor e pago acima do empenhado não estouram a faixa
    expect(faixaFinanceira([e({ id: "x", numero: 9, valor: 100, empenhado: 150, pago: 120 })])).toEqual({ pago: 100, aPagar: 0, semEmpenho: 0 });
  });

  it("totais e agrupamento: uma emenda pode cair em mais de um grupo (pendências por assunto)", () => {
    expect(somar(L, pend)).toEqual({ n: 4, valor: 2000, empenhado: 1700, pago: 1200, comPendencia: 2 });
    const porVer = agruparLista(L, pend, (x) => [{ chave: x.vereador_id, rotulo: x.vereador_nome }]);
    expect(porVer.find((g) => g.chave === "v1")).toMatchObject({ n: 3, valor: 1500, pago: 1000, comPendencia: 1 });
    const porAssunto = agruparLista(L, pend, (x) => (pend[x.id as keyof typeof pend]?.regras ?? []).map((r) => ({ chave: r, rotulo: r })));
    expect(porAssunto.find((g) => g.chave === "vigencia")).toMatchObject({ n: 2, valor: 800 });
    expect(porAssunto.reduce((s, g) => s + g.n, 0)).toBe(3);
  });
});
