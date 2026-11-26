import { describe, expect, it } from "vitest";

import { calcularLimites } from "./limites-exercicio";

const base = { rcl: null, percentualTeto: 2, percentualRestos: 0.5, restosValorManual: null, aprovadoLoa: null, somaEmendas: 5157490.05 };

describe("limites do exercício", () => {
  it("sem RCL, deduz a base do aprovado ÷ percentual do teto e marca como derivada", () => {
    const l = calcularLimites(base);
    expect(l.baseDerivada).toBe(true);
    expect(l.baseRcl).toBeCloseTo(257874502.5, 1);
    expect(l.restosTeto).toBeCloseTo(1289372.51, 1);
    expect(l.acimaDoTeto).toBeNull();
  });
  it("com RCL informada usa a RCL e acusa o excesso sobre o teto", () => {
    const l = calcularLimites({ ...base, rcl: 200000000 });
    expect(l.baseDerivada).toBe(false);
    expect(l.tetoValor).toBe(4000000);
    expect(l.restosTeto).toBe(1000000);
    expect(l.acimaDoTeto).toBeCloseTo(1157490.05, 2);
  });
  it("valor aprovado da lei prevalece sobre a soma das emendas", () => {
    const l = calcularLimites({ ...base, aprovadoLoa: 4000000 });
    expect(l.aprovadoOrigem).toBe("lei");
    expect(l.baseRcl).toBe(200000000);
  });
  it("restos em R$ manual substitui o percentual; sem nada, fica nulo", () => {
    expect(calcularLimites({ ...base, restosValorManual: 900000 })).toMatchObject({ restosTeto: 900000, restosOrigem: "manual" });
    expect(calcularLimites({ ...base, percentualRestos: null }).restosTeto).toBeNull();
    expect(calcularLimites({ ...base, percentualTeto: null, rcl: null }).restosTeto).toBeNull();
  });
});
