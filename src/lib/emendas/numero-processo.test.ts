import { describe, expect, it } from "vitest";

import { interpretarNumeroProcesso } from "@/lib/emendas/numero-processo";

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
