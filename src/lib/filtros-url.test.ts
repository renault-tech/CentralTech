import { describe, expect, it } from "vitest";

import { montarUrlComParametros } from "./filtros-url";

describe("montarUrlComParametros", () => {
  it("descarta vazios e mantém o caminho limpo sem filtros", () => {
    expect(montarUrlComParametros("/frotas/veiculos", { q: "", sec: undefined, rev: null })).toBe("/frotas/veiculos");
  });
  it("codifica os valores", () => {
    expect(montarUrlComParametros("/frotas/combustivel", { q: "NF 12/3", sit: "assinada" })).toBe("/frotas/combustivel?q=NF+12%2F3&sit=assinada");
  });
});
