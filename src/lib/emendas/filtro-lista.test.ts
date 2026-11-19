import { describe, expect, it } from "vitest";

import { filtrarEmendasLista, lerFiltrosLista } from "@/lib/emendas/filtro-lista";
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

describe("lista de emendas: filtros", () => {
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
