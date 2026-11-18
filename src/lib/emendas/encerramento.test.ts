import { describe, expect, it } from "vitest";

import { agrupar, linhasPanorama, pertenceAoCartao, rotuloSituacao, sugerirSituacao, totaisPorCartao, validarEncerramento, type Encerramento, type EmendaPanorama } from "@/lib/emendas/encerramento";

const fin = (valor: number, empenhado: number, pago: number) => ({ valor, empenhado, pago });

describe("validarEncerramento", () => {
  it("exige o documento comprobatório para marcar cumprida", () => {
    expect(validarEncerramento({ situacao: "cumprida", tipo: "direta", financeiro: fin(100, 100, 100), temDocumento: false })).toMatch(/nota fiscal/i);
    expect(validarEncerramento({ situacao: "cumprida", tipo: "osc", financeiro: fin(100, 100, 100), temDocumento: false })).toMatch(/prestação de contas/i);
    expect(validarEncerramento({ situacao: "cumprida", tipo: "direta", financeiro: fin(100, 100, 100), temDocumento: true })).toBeNull();
  });
  it("cumprida exige tudo empenhado e pago; economia cobre o valor sem empenhar", () => {
    expect(validarEncerramento({ situacao: "cumprida", tipo: "direta", financeiro: fin(100, 80, 80), temDocumento: true })).toMatch(/economia/);
    expect(validarEncerramento({ situacao: "cumprida_economia", tipo: "direta", financeiro: fin(100, 80, 80), temDocumento: true })).toBeNull();
    expect(validarEncerramento({ situacao: "cumprida", tipo: "direta", financeiro: fin(100, 100, 60), temDocumento: true })).toMatch(/não pago/);
  });
  it("restos a pagar só com empenho não pago", () => {
    expect(validarEncerramento({ situacao: "restos_a_pagar", tipo: "direta", financeiro: fin(100, 100, 100), temDocumento: false })).toMatch(/não empenhado/);
    expect(validarEncerramento({ situacao: "restos_a_pagar", tipo: "direta", financeiro: fin(100, 100, 40), temDocumento: false })).toBeNull();
    expect(validarEncerramento({ situacao: "restos_a_pagar", tipo: "direta", financeiro: fin(100, 80, 80), temDocumento: false })).not.toBeNull();
  });
  it("não cumprida não exige documento", () => {
    expect(validarEncerramento({ situacao: "nao_cumprida", tipo: "osc", financeiro: fin(100, 0, 0), temDocumento: false })).toBeNull();
  });
  it("devolução só no repasse, completa e dentro do repassado", () => {
    expect(validarEncerramento({ situacao: "cumprida_economia", tipo: "direta", financeiro: fin(100, 100, 100), temDocumento: true, devolucaoValor: 5, devolucaoData: "2026-12-01" })).toMatch(/repasse/);
    expect(validarEncerramento({ situacao: "cumprida_economia", tipo: "osc", financeiro: fin(100, 100, 100), temDocumento: true, devolucaoValor: 5, devolucaoData: null })).toMatch(/valor e a data/);
    expect(validarEncerramento({ situacao: "cumprida_economia", tipo: "osc", financeiro: fin(100, 100, 100), temDocumento: true, devolucaoValor: 150, devolucaoData: "2026-12-01" })).toMatch(/passar/);
    expect(validarEncerramento({ situacao: "cumprida_economia", tipo: "osc", financeiro: fin(100, 100, 100), temDocumento: true, devolucaoValor: 5, devolucaoData: "2026-12-01" })).toBeNull();
  });
});

describe("sugerirSituacao / rótulo", () => {
  it("sugere conforme os números e a etapa", () => {
    expect(sugerirSituacao(fin(100, 100, 100), "paga")).toBe("cumprida");
    expect(sugerirSituacao(fin(100, 80, 80), "paga")).toBe("cumprida_economia");
    expect(sugerirSituacao(fin(100, 100, 40), "concluida")).toBe("restos_a_pagar");
    expect(sugerirSituacao(fin(100, 40, 10), "empenhada")).toBeNull();
    expect(sugerirSituacao(fin(100, 0, 0), "indicada")).toBeNull();
  });
  it("no repasse a economia é devolução de saldo", () => {
    expect(rotuloSituacao("cumprida_economia", "osc")).toBe("Cumprida com devolução de saldo");
    expect(rotuloSituacao("cumprida_economia", "direta")).toBe("Cumprida com economia");
  });
});

describe("panorama", () => {
  const base = (n: number, o: Partial<EmendaPanorama>): EmendaPanorama => ({ id: `e${n}`, numero: n, objeto: "x", vereador_nome: "V", secretaria_id: "s", secretaria_nome: "Saúde", beneficiario_nome: null, tipo_execucao: "direta", valor: 100, empenhado: 0, pago: 0, etapa: "indicada", situacao: "ativa", ...o });
  const enc = (id: string, situacao: Encerramento["situacao"], extra: Partial<Encerramento> = {}): Encerramento => ({ id, situacao, definida_em: "2026-11-19", observacao: null, devolucao_valor: null, devolucao_data: null, devolucao_documento: null, ...extra });
  const linhas = linhasPanorama(
    [base(1, { empenhado: 100, pago: 100 }), base(2, { empenhado: 80, pago: 80 }), base(3, { empenhado: 100, pago: 30 }), base(4, { empenhado: 40, pago: 10 }), base(5, { situacao: "cancelada" }), base(6, { tipo_execucao: "osc", empenhado: 100, pago: 100 })],
    [enc("e1", "cumprida"), enc("e2", "cumprida_economia"), enc("e3", "restos_a_pagar"), enc("e6", "cumprida_economia", { devolucao_valor: 7, devolucao_data: "2026-12-01" })],
    []
  );
  it("ignora canceladas e calcula economia, restos e devolução", () => {
    expect(linhas).toHaveLength(5);
    const m = Object.fromEntries(linhas.map((l) => [l.numero, l]));
    expect(m[2].economia).toBe(20);
    expect(m[3].restos).toBe(70);
    expect(m[6].devolucao).toBe(7);
  });
  it("cada cartão filtra e soma", () => {
    const t = totaisPorCartao(linhas);
    expect(t.cumprida.quantidade).toBe(1);
    expect(t.cumprida_economia.quantidade).toBe(2);
    expect(t.restos_a_pagar).toEqual({ quantidade: 1, valor: 70 });
    expect(t.sem_situacao.quantidade).toBe(1);
    expect(t.sem_empenho_encerrada).toEqual({ quantidade: 1, valor: 20 });
    expect(t.sem_empenho_andamento.quantidade).toBe(1);
    expect(t.a_pagar.valor).toBe(70 + 30);
    expect(pertenceAoCartao(linhas[0], "todas")).toBe(true);
  });
  it("restos a pagar todo pago passa sozinho a cumprida", () => {
    const l = linhasPanorama([base(7, { empenhado: 60, pago: 60 })], [enc("e7", "restos_a_pagar")], []);
    expect(l[0].restosQuitados).toBe(true);
    expect(l[0].encerramento).toBe("cumprida_economia");
    expect(l[0].restos).toBe(0);
    const ainda = linhasPanorama([base(8, { empenhado: 60, pago: 20 })], [enc("e8", "restos_a_pagar")], []);
    expect(ainda[0].restosQuitados).toBe(false);
    expect(ainda[0].restos).toBe(40);
  });
  it("agrupa por secretaria", () => {
    const g = agrupar(linhas, "secretaria");
    expect(g).toHaveLength(1);
    expect(g[0].emendas).toBe(5);
    expect(g[0].cumpridas).toBe(3);
  });
});
