import { describe, expect, it } from "vitest";

import { lerContrato, lerDocumento, lerTitularidade, lerVistoria } from "./pdf-documento";
import type { Unidade } from "@/types/imoveis";

const CONTRATO = `CONTRATO DE LOCAÇÃO Nº 031/2024
LOCADOR: ANTÔNIO CARLOS FERRAZ, brasileiro, inscrito no CPF 482.115.907-07, e LOCATÁRIO: Município de Cataguases.
O prazo da locação é de 36 (trinta e seis) meses, a partir de 19/01/2024. O aluguel mensal é de R$ 4.800,00 (quatro mil e oitocentos reais),
a ser pago até o dia 5 de cada mês. O valor será reajustado anualmente pelo IPCA.`;

const unidades = [{ id: "u1", tipo: "luz", numero: "UC 3004412908" }, { id: "u2", tipo: "agua", numero: "Matrícula 0048213" }] as Pick<Unidade, "id" | "tipo" | "numero">[];

describe("lerContrato", () => {
  it("lê número, valor, vigência por prazo, dia, índice e locador", () => {
    const r = lerContrato(CONTRATO);
    expect(r.tipo).toBe("contrato");
    if (r.tipo !== "contrato") return;
    expect(r.dados).toMatchObject({
      contratoNumero: "031/2024", valorAluguel: 4800, vigenciaInicio: "2024-01-19", vigenciaFim: "2027-01-18", diaVencimento: 5,
      indiceReajuste: "IPCA", proprietarioNome: "ANTÔNIO CARLOS FERRAZ", proprietarioDocumento: "482.115.907-07",
    });
    expect(r.avisos.some((a) => /calculado/i.test(a))).toBe(true);
  });
  it("usa o término explícito quando existe e aceita data por extenso", () => {
    const r = lerContrato("Contrato nº 12/2025. Início em 1º de março de 2025, término 28/02/2028. Aluguel de R$ 2.400,50.");
    if (r.tipo !== "contrato") return;
    expect(r.dados).toMatchObject({ vigenciaInicio: "2025-03-01", vigenciaFim: "2028-02-28", valorAluguel: 2400.5 });
  });
  it("avisa o que não achou e não inventa", () => {
    const r = lerContrato("Documento sem dados úteis.");
    expect(r.dados).toEqual({});
    expect(r.avisos.length).toBeGreaterThanOrEqual(3);
  });
});

describe("lerTitularidade", () => {
  it("acha o tipo, a unidade e a data da troca", () => {
    const r = lerTitularidade("ENERGISA Alteração de titularidade da unidade consumidora 3004412908. Data da alteração: 12/09/2026.", unidades);
    if (r.tipo !== "titularidade") return;
    expect(r.dados).toEqual({ tipo: "luz", unidadeId: "u1", dataTroca: "2026-09-12" });
    expect(r.avisos).toEqual([]);
  });
  it("sem rótulo usa a primeira data e avisa", () => {
    const r = lerTitularidade("SAAE água matrícula 48213 solicitação em 03/10/2026", unidades);
    if (r.tipo !== "titularidade") return;
    expect(r.dados).toMatchObject({ tipo: "agua", unidadeId: "u2", dataTroca: "2026-10-03" });
    expect(r.avisos.some((a) => /primeira data/i.test(a))).toBe(true);
  });
});

describe("lerVistoria", () => {
  it("lê data, vistoriador e conclusão", () => {
    const r = lerVistoria("LAUDO DE VISTORIA Data da vistoria: 10/09/2026 Vistoriador: Paulo Mendes CREA 12345 Conclusão: imóvel em bom estado, com dois reparos de pintura a cargo do locatário.");
    if (r.tipo !== "vistoria") return;
    expect(r.dados.dataVistoria).toBe("2026-09-10");
    expect(r.dados.vistoriador).toBe("Paulo Mendes");
    expect(r.dados.resumo).toContain("bom estado");
  });
});

describe("lerDocumento", () => {
  it("despacha pelo tipo", () => {
    expect(lerDocumento("vistoria", "Data da vistoria: 01/02/2026", unidades).tipo).toBe("vistoria");
    expect(lerDocumento("contrato", CONTRATO, unidades).tipo).toBe("contrato");
  });
});
