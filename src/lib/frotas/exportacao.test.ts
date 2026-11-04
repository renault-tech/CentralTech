import { describe, expect, it } from "vitest";

import { opcoesExportar } from "@/lib/frotas/exportacao";

describe("opcoesExportar", () => {
  it("monta um link por relatório e formato, levando os filtros da tela", () => {
    const o = opcoesExportar([{ r: "combustivel", rotulo: "NFs de combustível", formatos: ["xlsx", "csv"] }], { q: "educacao", sit: "todas", sec: undefined });
    expect(o.map((x) => x.rotulo)).toEqual(["NFs de combustível · Excel", "NFs de combustível · CSV"]);
    expect(o[0].href).toBe("/frotas/exportar?q=educacao&sit=todas&r=combustivel&formato=xlsx");
  });
  it("a planilha completa não leva filtro", () => {
    const [o] = opcoesExportar([{ r: "completo", rotulo: "Tudo", formatos: ["xlsx"] }], { q: "x" });
    expect(o.href).toBe("/frotas/exportar?r=completo&formato=xlsx");
  });
});
