import { describe, expect, it } from "vitest";

import { classificarBusca, interpretarNumeroProcesso, palavrasChave } from "@/lib/emendas/numero-processo";

describe("interpretarNumeroProcesso", () => {
  it("AAAA/NNNN é o número do processo; completa zeros", () => {
    expect(interpretarNumeroProcesso("2026/62")).toEqual({ coluna: "numero", valor: "2026/0062" });
    expect(interpretarNumeroProcesso(" 2026/0062 ")).toEqual({ coluna: "numero", valor: "2026/0062" });
  });
  it("NNN/AAAA é o número da licitação", () => {
    expect(interpretarNumeroProcesso("136/2026")).toEqual({ coluna: "numero_licitacao", valor: "136/2026" });
    expect(interpretarNumeroProcesso("0136/2026")).toEqual({ coluna: "numero_licitacao", valor: "136/2026" });
  });
  it("recusa outros formatos", () => {
    expect(interpretarNumeroProcesso("abc")).toBeNull();
    expect(interpretarNumeroProcesso("12-2026")).toBeNull();
  });
});

describe("sugestão de processos", () => {
  it("tira pistas do objeto da emenda", () => {
    expect(palavrasChave("Aquisição de ambulância para a Secretaria de Saúde")).toEqual(["ambulância", "saúde"]);
  });
  it("classifica o que foi digitado", () => {
    expect(classificarBusca("")).toEqual({ tipo: "vazia" });
    expect(classificarBusca("2026/00")).toEqual({ tipo: "numero", trecho: "2026/00" });
    expect(classificarBusca("62")).toEqual({ tipo: "numero", trecho: "62" });
    expect(classificarBusca("ambulancia uti")).toEqual({ tipo: "texto", palavras: ["ambulancia", "uti"] });
  });
});
