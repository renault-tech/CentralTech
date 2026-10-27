import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(f: T) => f }));


describe("portal", () => {
  it("mascara a conta deixando só os 4 últimos dígitos", async () => {
    const { mascararConta } = await import("@/lib/emendas/portal");
    expect(mascararConta("Ag 1234-5 / CC 98765-4")).toBe("****7654");
    expect(mascararConta("12")).toBeNull();
    expect(mascararConta(null)).toBeNull();
  });

  it("CSV: BOM, separador ;, vírgula decimal, aspas escapadas e sem campo livre de gestão", async () => {
    const { paraCsv } = await import("@/lib/emendas/portal");
    const linha = {
      numero: 1, ano: 2026, vereador: "A", objeto: 'Reforma "da" praça; centro', valor: 1234.5, saude: false, tipo: "osc" as const,
      secretaria: "S", unidade: "02.01 U", funcional: null, natureza: "3.3.50.43", beneficiario: "Ent", cnpj: "00.000.000/0001-00",
      etapa: "paga", situacao: "normal" as const, empenhado: 1234.5, liquidado: 0, pago: 1234.5, ultimoPagamento: "2026-05-01",
      termo: "9/2026", vigenciaInicio: null, vigenciaFim: null, extratoPublicadoEm: null, contaMascarada: "****1234", impedimento: null,
    };
    const csv = paraCsv([linha], () => "Paga");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Reforma ""da"" praça; centro";1234,50');
    expect(csv).not.toMatch(/gestor|observa/i);
  });
});
