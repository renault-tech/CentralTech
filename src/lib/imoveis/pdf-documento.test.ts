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

describe("lerContrato — campos do cadastro do imóvel", () => {
  const TEXTO = `CONTRATO DE LOCAÇÃO Nº 007/2025
O MUNICÍPIO DE CATAGUASES, por meio da Secretaria Municipal de Educação, CNPJ 18.095.400/0001-70, LOCATÁRIO.
LOCADOR: MARIA DAS GRAÇAS LIMA, brasileira, CPF 123.456.789-09, telefone (32) 99876-5432, e-mail maria.lima@exemplo.com.br,
administrado pela imobiliária Lar Doce Lar Ltda, CNPJ 11.222.333/0001-44.
CLÁUSULA 1ª: O imóvel situado à Rua Coronel Vieira, 204, Centro, nesta cidade, CEP 36770-000, destina-se exclusivamente ao funcionamento de creche municipal.
O prazo é de 24 meses, a partir de 10/03/2025. Aluguel de R$ 3.200,00, a ser pago até o dia 10. Reajuste anual pelo IGP-M.
Os pagamentos serão feitos no Banco do Brasil, agência 1234-5, conta corrente 98765-4.`;
  it("lê endereço com CEP, finalidade, contato, conta, imobiliária, secretaria e próximo reajuste", () => {
    const r = lerContrato(TEXTO, "2026-11-18");
    if (r.tipo !== "contrato") return;
    expect(r.dados).toMatchObject({
      contratoNumero: "007/2025", valorAluguel: 3200, indiceReajuste: "IGP-M", diaVencimento: 10, proximoReajuste: "2027-03-10",
      endereco: "Rua Coronel Vieira, 204, Centro - CEP 36770-000", finalidade: "Funcionamento de creche municipal",
      proprietarioContato: "(32) 99876-5432 · maria.lima@exemplo.com.br", imobiliariaNome: "Lar Doce Lar Ltda", secretariaNome: "Educação",
    });
    expect(r.dados.proprietarioConta).toMatch(/Banco do Brasil.*1234-5.*98765-4/);
  });
  it("não inventa endereço e avisa", () => {
    const r = lerContrato("Contrato nº 1/2025. Aluguel de R$ 1.000,00.", "2026-11-18");
    expect(r.dados).not.toHaveProperty("endereco");
    expect(r.avisos.some((a) => /Endereço/.test(a))).toBe(true);
  });
});
