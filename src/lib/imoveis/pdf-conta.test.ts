import { describe, expect, it } from "vitest";

import { detectarTipo, lerContaDoTexto } from "./pdf-conta";
import type { Unidade } from "@/types/imoveis";

const unidades = [
  { id: "uc", tipo: "luz", numero: "UC 3004412908" },
  { id: "mat", tipo: "agua", numero: "Matrícula 0048213" },
] as Pick<Unidade, "id" | "tipo" | "numero">[];

const FATURA_LUZ = `ENERGISA MINAS GERAIS Unidade Consumidora 3004412908 Referência: 10/2026
Vencimento 12/11/2026 Consumo 6.310 kWh Total a pagar R$ 6.280,10`;
const FATURA_AGUA = `SAAE Cataguases - Serviço Autônomo de Água e Esgoto
Matrícula: 48213 Mês de referência: OUT/2026 Consumo: 23 m³ Vencimento: 09/11/2026 Valor total R$ 220,10`;

describe("detectarTipo", () => {
  it("separa água de luz", () => {
    expect(detectarTipo(FATURA_LUZ)).toBe("luz");
    expect(detectarTipo(FATURA_AGUA)).toBe("agua");
    expect(detectarTipo("texto qualquer")).toBeNull();
  });
});

describe("lerContaDoTexto", () => {
  it("lê uma fatura de energia completa", () => {
    expect(lerContaDoTexto(FATURA_LUZ, unidades)).toMatchObject({ unidadeId: "uc", tipo: "luz", referencia: "2026-10-01", consumo: 6310, valor: 6280.1, vencimento: "2026-11-12", encontrados: 4 });
  });
  it("lê uma fatura de água achando a matrícula sem os zeros à esquerda", () => {
    const r = lerContaDoTexto(FATURA_AGUA, unidades);
    expect(r).toMatchObject({ unidadeId: "mat", tipo: "agua", referencia: "2026-10-01", consumo: 23, valor: 220.1, vencimento: "2026-11-09" });
    expect(r.avisos).toEqual([]);
  });
  it("avisa o que não achou em vez de inventar", () => {
    const r = lerContaDoTexto("ENERGISA fatura sem dados úteis", unidades);
    expect(r.unidadeId).toBeNull();
    expect(r.encontrados).toBe(0);
    expect(r.avisos.length).toBeGreaterThanOrEqual(3);
  });
  it("não casa unidade de outro tipo", () => {
    expect(lerContaDoTexto("SAAE água matrícula 3004412908 consumo 10 m³", unidades).unidadeId).toBeNull();
  });
  it("sem rótulo de total usa o maior valor e avisa", () => {
    const r = lerContaDoTexto("ENERGISA UC 3004412908 R$ 15,00 R$ 120,50 kWh", unidades);
    expect(r.valor).toBe(120.5);
    expect(r.avisos.some((a) => /maior valor/i.test(a))).toBe(true);
  });
});
