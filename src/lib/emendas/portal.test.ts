import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(f: T) => f }));

const linha = {
  numero: 1, ano: 2026, vereador: "A", partido: "XYZ", unidadeParlamentar: "Câmara Municipal", leiLoa: "Lei 1/2025", municipio: "Cataguases", municipioCnpj: "17.000.000/0001-00",
  objeto: 'Reforma "da" praça; centro', descricao: "Reforma da praça central", localidade: "Centro", valor: 1234.5, saude: false, tipo: "osc" as const,
  secretaria: "S", unidade: "02.01 U", funcional: null, natureza: "3.3.50.43", gnd: "GND 3 — Outras despesas correntes", categoria: "Despesa corrente",
  beneficiario: "Ent", cnpj: "00.000.000/0001-00", etapa: "paga", situacao: "normal" as const, empenhado: 1234.5, liquidado: 0, pago: 1234.5, ultimoPagamento: "2026-05-01",
  movimentos: [{ tipo: "empenho" as const, data: "2026-02-01", valor: 1234.5, numero: "55" }],
  termo: "9/2026", processo: "2026/0062", contrato: null, inicioPrevisto: null, terminoPrevisto: null, vigenciaInicio: null, vigenciaFim: null, extratoPublicadoEm: null,
  conta: "CAIXA 0108 CONTA 1234-5", gestorPrefeitura: "Fulano de Tal", gestorEntidade: null, anuenciaSus: null, identificadorContabil: null, fonteRecurso: null,
  planoMetas: null, planoOutrasFontes: null, documentos: [{ id: "d1", tipo: "plano_trabalho" as const, rotulo: "Plano de trabalho", competencia: null, nome: "plano.pdf" }], impedimento: null,
};

describe("portal", () => {
  it("CSV: BOM, separador ;, vírgula decimal, aspas escapadas, e traz gestor, conta e links dos documentos públicos exigidos pela IN 05/2025", async () => {
    const { paraCsv } = await import("@/lib/emendas/portal");
    const csv = paraCsv([linha], () => "Paga");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Reforma ""da"" praça; centro"');
    expect(csv).toContain(";1234,50;");
    expect(csv).toContain("Fulano de Tal");
    expect(csv).toContain("CAIXA 0108 CONTA 1234-5");
    expect(csv).toContain("/transparencia/emendas/documento/d1");
    expect(csv).not.toMatch(/observa/i);
  });

  it("só publica anexos dos tipos exigidos pela norma", async () => {
    const { TIPOS_DOCUMENTO_PUBLICO } = await import("@/lib/emendas/portal");
    expect([...TIPOS_DOCUMENTO_PUBLICO].sort()).toEqual(["anuencia_sus", "plano_trabalho", "relatorio_gestao"]);
  });
});
