import { describe, expect, it } from "vitest";

import { lerValor, valorParaCampo } from "@/lib/frotas/entrada";

describe("lerValor", () => {
  it("entende os formatos brasileiros e o ponto decimal", () => {
    expect(lerValor("R$ 1.234,56")).toBe(1234.56);
    expect(lerValor("1234,56")).toBe(1234.56);
    expect(lerValor("1234.56")).toBe(1234.56);
    expect(lerValor("48.312,70")).toBe(48312.7);
    expect(lerValor("900")).toBe(900);
  });
  it("vazio é nulo e lixo é NaN", () => {
    expect(lerValor("  ")).toBeNull();
    expect(Number.isNaN(lerValor("abc"))).toBe(true);
    expect(Number.isNaN(lerValor("12,3,4"))).toBe(true);
  });
  it("volta para o campo com duas casas", () => {
    expect(valorParaCampo(4850)).toBe("4850,00");
    expect(valorParaCampo(null)).toBe("");
  });
});
