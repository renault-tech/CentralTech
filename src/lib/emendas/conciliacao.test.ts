import { describe, expect, it } from "vitest";

import { situacaoConciliacao } from "@/lib/emendas/conciliacao";

const base = { valor: 86916.33, empenhado: 86903.96, pago: 86903.96, etapa: "paga" };

describe("situacaoConciliacao", () => {
  it("emenda paga com empenho menor que o valor: saldo não executado exato, sem arredondar", () => {
    const s = situacaoConciliacao(base, null);
    expect(s.saldoNaoExecutado).toBe(12.37);
    expect(s.saldoEmpenho).toBe(0);
    expect(s.mostrar).toBe(true);
    expect(s.saldoRegistrado).toBe(false);
  });
  it("saldo registrado só vale enquanto o valor do saldo não muda", () => {
    const c = { saldo_registrado_em: "2026-11-18", saldo_valor: 12.37, anulacao_solicitada_em: null, excesso_fonte: null };
    expect(situacaoConciliacao(base, c).saldoRegistrado).toBe(true);
    expect(situacaoConciliacao({ ...base, empenhado: 86900, pago: 86900 }, c).saldoRegistrado).toBe(false);
  });
  it("execução em andamento (empenho parcial, nada pago): não mostra nada", () => {
    const s = situacaoConciliacao({ valor: 10000, empenhado: 4000, pago: 0, etapa: "empenhada" }, null);
    expect(s.mostrar).toBe(false);
    expect(s.saldoNaoExecutado).toBe(0);
  });
  it("pagamento igual ao empenho, mas a emenda ainda em empenho: pode vir novo empenho, não mostra", () => {
    expect(situacaoConciliacao({ valor: 7000, empenhado: 83.76, pago: 83.76, etapa: "empenhada" }, null).mostrar).toBe(false);
  });
  it("saldo do empenho a anular só aparece com a execução encerrada ou com anulação solicitada", () => {
    const e = { valor: 10000, empenhado: 10000, pago: 9500, etapa: "paga" };
    expect(situacaoConciliacao(e, null).saldoEmpenho).toBe(0);
    expect(situacaoConciliacao({ ...e, etapa: "concluida" }, null).saldoEmpenho).toBe(500);
    expect(situacaoConciliacao(e, { saldo_registrado_em: null, saldo_valor: null, anulacao_solicitada_em: "2026-11-18", excesso_fonte: null }).saldoEmpenho).toBe(500);
  });
  it("excesso pede a fonte de recurso", () => {
    const s = situacaoConciliacao({ valor: 1000, empenhado: 1020, pago: 1020, etapa: "paga" }, null);
    expect(s.excesso).toBe(20);
    expect(s.fonteExcessoInformada).toBe(false);
    expect(situacaoConciliacao({ valor: 1000, empenhado: 1020, pago: 1020, etapa: "paga" }, { saldo_registrado_em: null, saldo_valor: null, anulacao_solicitada_em: null, excesso_fonte: "Recursos próprios — ficha 123" }).fonteExcessoInformada).toBe(true);
  });
});
