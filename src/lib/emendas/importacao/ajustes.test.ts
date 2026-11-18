import { describe, expect, it } from "vitest";

import { compararPlanilha, novoDoRemanejamento, type EmendaCadastrada } from "@/lib/emendas/importacao/ajustes";
import type { LinhaImportacao } from "@/lib/emendas/importacao/planilha";

const linha = (numero: number, o: Partial<LinhaImportacao> = {}): LinhaImportacao =>
  ({ numero, numero_vereador: 1, vereador_numero: 1, vereador_nome: "V", objeto: "Compra de equipamentos", descricao: "d", valor: 1000, beneficiario: "Escola A", unidade_codigo: "02.01", unidade_nome: "Educação", saude: false, funcional: null, natureza: null, dotacao_texto: null, ficha: null, status_original: null, etapa: "indicada", empenho: null, data_pagamento: null, pendencias: [], remanejamento: null, ...o }) as LinhaImportacao;
const cad = (numero: number, o: Partial<EmendaCadastrada> = {}): EmendaCadastrada => ({ id: `id${numero}`, numero, situacao: "normal", valor: 1000, objeto: "Compra de equipamentos", ficha: null, dotacao_texto: null, beneficiario_nome: "Escola A", ...o });

describe("compararPlanilha", () => {
  it("separa novas, alteradas, iguais e ausentes", () => {
    const r = compararPlanilha([linha(1), linha(2, { valor: 1500 }), linha(9)], [cad(1), cad(2), cad(3)]);
    expect(r.novas).toEqual([9]);
    expect(r.alteradas.map((a) => a.numero)).toEqual([2]);
    expect(r.iguais).toBe(1);
    expect(r.ausentes.map((a) => a.numero)).toEqual([3]);
  });
  it("detecta valor, objeto, ficha e beneficiário; ignora caixa e espaços", () => {
    const r = compararPlanilha([linha(1, { valor: 900, objeto: "compra  de EQUIPAMENTOS novos", ficha: "2.087.0201 - EP02", beneficiario: "escola a" })], [cad(1)]);
    const campos = r.alteradas[0].mudancas.map((m) => m.campo);
    expect(campos).toEqual(["valor", "objeto", "ficha"]);
  });
  it("célula vazia não apaga dado cadastrado", () => {
    const r = compararPlanilha([linha(1, { objeto: "", ficha: null, beneficiario: "" })], [cad(1, { ficha: "F1" })]);
    expect(r.alteradas).toHaveLength(0);
    expect(r.iguais).toBe(1);
  });
  it("emenda cancelada que sumiu da planilha não aparece como ausente", () => {
    expect(compararPlanilha([], [cad(5, { situacao: "cancelada" })]).ausentes).toHaveLength(0);
  });
});

describe("novoDoRemanejamento", () => {
  it("monta os campos e recusa objeto curto", () => {
    const { novo, erros } = novoDoRemanejamento([
      { campo: "valor", rotulo: "", antes: "", depois: "R$ 1.500,50" },
      { campo: "ficha", rotulo: "", antes: "", depois: "F2" },
      { campo: "objeto", rotulo: "", antes: "", depois: "curto" },
    ]);
    expect(novo).toEqual({ valor: 1500.5, ficha: "F2" });
    expect(erros).toEqual(["objeto com menos de 15 caracteres"]);
  });
});
