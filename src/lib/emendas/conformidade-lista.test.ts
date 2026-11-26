import { describe, expect, it } from "vitest";

import { descreverFiltrosConformidade, filtrarConformidade, rotuloCodigo, type LinhaConformidade } from "./conformidade-lista";
import { porMotivo } from "./painel-pendencias";

const L = (o: Partial<LinhaConformidade> & { id: string; numero: number }): LinhaConformidade => ({ objeto: "Compra de equipamentos", secretaria: "Saúde", tipo: "osc", executada: false, faltas: [], ...o });
const nomes = new Map([["XIV", "Gestor responsável"], ["VIII", "Termo e extrato"]]);
const F0 = { i: "", s: "", t: "", x: "", q: "" };

describe("lista de conformidade (filtros iguais na tela e nos arquivos)", () => {
  const linhas = [L({ id: "a", numero: 1, faltas: ["XIV"], executada: true }), L({ id: "b", numero: 2, faltas: ["XIV", "VIII"], secretaria: "Educação" }), L({ id: "c", numero: 3 })];
  it("só entram emendas com item faltando e cada filtro recorta", () => {
    expect(filtrarConformidade(linhas, F0, nomes).map((l) => l.numero)).toEqual([1, 2]);
    expect(filtrarConformidade(linhas, { ...F0, i: "VIII" }, nomes).map((l) => l.numero)).toEqual([2]);
    expect(filtrarConformidade(linhas, { ...F0, s: "Saúde" }, nomes).map((l) => l.numero)).toEqual([1]);
    expect(filtrarConformidade(linhas, { ...F0, x: "1" }, nomes).map((l) => l.numero)).toEqual([1]);
    expect(filtrarConformidade(linhas, { ...F0, q: "gestor" }, nomes).map((l) => l.numero)).toEqual([1, 2]);
  });
  it("descreve os filtros em palavras", () => {
    expect(descreverFiltrosConformidade(F0, nomes, (t) => t)).toBe("Nenhum filtro");
    expect(descreverFiltrosConformidade({ ...F0, i: "XIV", s: "Saúde" }, nomes, (t) => t)).toBe("Item: Art. 7º, XIV · Gestor responsável · Secretaria: Saúde");
    expect(rotuloCodigo("art5")).toBe("Art. 5º");
  });
});

describe("motivos da publicidade no gráfico de Pendências", () => {
  it("não repete o assunto, como na Conformidade", () => {
    const l = { emendaId: "e", numero: 1, regra: "publicidade_incompleta", titulo: "Publicidade incompleta", motivos: [{ chave: "publicidade_incompleta:XIV", rotulo: "Art. 7º, XIV · Gestor responsável" }] };
    const g = porMotivo([l as never], true);
    expect(g[0].rotulo).toBe("Art. 7º, XIV · Gestor responsável");
  });
});
