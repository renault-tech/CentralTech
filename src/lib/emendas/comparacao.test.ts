import { describe, expect, it } from "vitest";

import { anoParaComparar, compararExercicios, curvaPercentual, pagoAte, totaisDoExercicio, variacao } from "./comparacao";

const e = (valor: number, empenhado: number, pago: number, saude = false, etapa = "paga", situacao = "normal") => ({ valor, empenhado, pago, saude, etapa, situacao }) as never;

describe("comparação entre exercícios", () => {
  it("soma o exercício e ignora emendas canceladas", () => {
    const t = totaisDoExercicio(2026, [e(100, 80, 50, true), e(200, 0, 0, false, "indicada"), e(999, 0, 0, false, "indicada", "cancelada")]);
    expect(t).toMatchObject({ n: 2, valor: 300, empenhado: 80, pago: 50, saude: 100, semAndamento: 1 });
  });

  it("variação: alta, queda, igual e sem base", () => {
    expect(variacao(120, 100)).toMatchObject({ sentido: "alta", relativa: 0.2 });
    expect(variacao(80, 100)).toMatchObject({ sentido: "queda", relativa: -0.2 });
    expect(variacao(100, 100).sentido).toBe("igual");
    expect(variacao(10, 0)).toMatchObject({ sentido: "sem_base", relativa: null });
    expect(variacao(0.6, 0.5, true)).toMatchObject({ sentido: "alta", relativa: null });
  });

  it("compara os sete indicadores, com percentuais em pontos", () => {
    const a = totaisDoExercicio(2027, [e(200, 100, 100, true)]);
    const b = totaisDoExercicio(2026, [e(100, 100, 50, false)]);
    const linhas = compararExercicios(a, b);
    expect(linhas).toHaveLength(7);
    const pago = linhas.find((l) => l.chave === "pct_pago")!;
    expect(pago.atual).toBeCloseTo(0.5);
    expect(pago.anterior).toBeCloseTo(0.5);
    expect(pago.variacao.sentido).toBe("igual");
    expect(linhas.find((l) => l.chave === "valor")!.variacao.relativa).toBe(1);
  });

  it("mesmo período e curva acumulada em fração do indicado", () => {
    const pag = [{ data: "2026-01-10", valor: 10 }, { data: "2026-03-05", valor: 30 }, { data: "2026-11-30", valor: 60 }, { data: null, valor: 5 }, { data: "2025-02-01", valor: 99 }];
    expect(pagoAte(pag, 2026, "03-31")).toBe(40);
    const c = curvaPercentual(pag, 2026, 100);
    expect(c[0]).toBeCloseTo(0.1);
    expect(c[2]).toBeCloseTo(0.4);
    expect(c[11]).toBe(1);
    expect(curvaPercentual(pag, 2026, 0).every((x) => x === 0)).toBe(true);
  });

  it("escolhe o ano de comparação: o pedido válido ou o anterior mais próximo", () => {
    expect(anoParaComparar(2026, [2026])).toBeNull();
    expect(anoParaComparar(2027, [2027, 2026, 2025])).toBe(2026);
    expect(anoParaComparar(2027, [2027, 2026, 2025], "2025")).toBe(2025);
    expect(anoParaComparar(2027, [2027, 2026], "2030")).toBe(2026);
    expect(anoParaComparar(2026, [2026, 2027], "2027")).toBe(2027);
  });
});
