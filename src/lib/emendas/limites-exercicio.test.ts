import { describe, expect, it } from "vitest";

import { calcularLimites } from "./limites-exercicio";

const base = { rcl: null, percentualTeto: 2, percentualRestos: 0.5, restosValorManual: null, aprovadoLoa: null, somaEmendas: 5157490.05 };

describe("limites do exercício", () => {
  it("sem a RCL não inventa teto nem limite de restos", () => {
    const l = calcularLimites(base);
    expect(l.baseRcl).toBeNull();
    expect(l.tetoValor).toBeNull();
    expect(l.restosTeto).toBeNull();
    expect(l.acimaDoTeto).toBeNull();
  });
  it("com a RCL calcula teto e restos e acusa o que a Câmara aprovou acima do teto", () => {
    const l = calcularLimites({ ...base, rcl: 200000000 });
    expect(l.tetoValor).toBe(4000000);
    expect(l.tetoDescricao).toBe("2% da RCL");
    expect(l.restosTeto).toBe(1000000);
    expect(l.restosDescricao).toBe("0,5% da RCL");
    expect(l.acimaDoTeto).toBeCloseTo(1157490.05, 2);
  });
  it("valor aprovado da lei prevalece sobre a soma das emendas", () => {
    const l = calcularLimites({ ...base, rcl: 200000000, aprovadoLoa: 4000000 });
    expect(l.aprovadoOrigem).toBe("lei");
    expect(l.acimaDoTeto).toBe(0);
  });
  it("restos em R$ manual vale mesmo sem RCL e substitui o percentual", () => {
    expect(calcularLimites({ ...base, restosValorManual: 900000 })).toMatchObject({ restosTeto: 900000, restosOrigem: "manual" });
    expect(calcularLimites({ ...base, rcl: 100, restosValorManual: 50 }).restosTeto).toBe(50);
  });
});
