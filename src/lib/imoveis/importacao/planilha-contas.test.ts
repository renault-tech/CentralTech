import { describe, expect, it } from "vitest";

import { chaveCodigo, enderecoEspecifico, lerPlanilhaContas, numeroDaCelula, secretariaDaAba, type AbaBruta } from "./planilha-contas";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Aba de LUZ como a Energisa: título do bloco, cabeçalho com segundo código sem rótulo e linhas de unidade. */
const luz: AbaBruta = {
  nome: "ADMINISTRAÇÃO ",
  linhas: [
    ["FICHA", null, "NÚMERO EMPENHO", "VALOR EMPENHO"],
    [null, null, "420 / 5060", "25.000,00/7.000,00"],
    [null, null, null, " Atividades administrativas", "Consumo 2026", null, null, null, null, null, null, null, null, null, null, null, "Consumo Total", "Média Mensal"],
    ["CDC", null, "Setor", "Endereço", ...MESES],
    ["1/92228-6 ", "652.000.050-70", "Agencia IPSEMG", "Rua José Almeida Kneipp, 17 ", 908.77, 503.24, 434.21, 27.68, 270.1, 147.08, 183.45, 197.98, 191.76, null, null, null, 2864.27],
    ["1/171719-8", "12.387.050-90", "Posto Telefônico", "Rua Principal S/N", 31.85, 32.05, 31.69, 30.96, 31.1, 32.49, 36.22, 37.35],
    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 3128.0],
    [],
    ["523", null, "433 / 6545", "20000"],
    ["Proj. Atividade", null, null, "Outro bloco da mesma aba", "Consumo 2026"],
    ["CDC", null, "Setor", "Endereço", ...MESES],
    ["1/91003-4", "141.785.050-47", "Almoxarifado", "Av. Brasil, 100", "1.234,56", null, 10],
  ],
};

/** Aba de ÁGUA como a COPASA: Matrícula sem segundo código, e parcelas de dívida na Fazenda. */
const agua: AbaBruta = {
  nome: "FAZENDA",
  linhas: [
    ["FICHA", "NÚMERO EMPENHO", "VALOR EMPENHO"],
    [null, null, "0.006 - Dívida Contratada", "Consumo"],
    ["Proj. Atividade", null, "0.006 - Dívida Contratada", "Consumo", null, null, null, null, null, null, null, null, null, null, null, "Consumo Total"],
    ["Matrícula", "Setor", "Endereço", ...MESES],
    ["10374078", "P.M.C - Sede (VALOR JUROS)", "Praça Santa Rita, 462 - Centro", 7890.31, 7890.31],
    ["10374078", "P.M.C - Sede (VALOR AMORT.) ", "Praça Santa Rita, 462 - Centro", 5220.9, 5220.9],
    ["10380001", "Prefeitura - Sede", "Praça Santa Rita, 462 - Centro", 120.5, 99, 101.1],
  ],
};

describe("lerPlanilhaContas", () => {
  it("lê a aba de luz: dois blocos, segundo código e valores por mês", () => {
    const r = lerPlanilhaContas([luz]);
    expect(r.abas).toHaveLength(1);
    const a = r.abas[0];
    expect(a.nome).toBe("ADMINISTRAÇÃO");
    expect(a.blocos).toBe(2);
    expect(a.linhas).toHaveLength(3);
    expect(a.linhas[0]).toMatchObject({ codigo: "1/92228-6", codigo2: "652.000.050-70", setor: "Agencia IPSEMG", projeto: "Atividades administrativas", linhaNumero: 5 });
    expect(a.linhas[0].valores.slice(0, 3)).toEqual([908.77, 503.24, 434.21]);
    expect(a.linhas[0].valores[10]).toBeNull();
    expect(a.linhas[1].valores.filter((v) => v !== null)).toHaveLength(8);
    expect(a.linhas[2]).toMatchObject({ projeto: "Outro bloco da mesma aba" });
    expect(a.linhas[2].valores.slice(0, 3)).toEqual([1234.56, null, 10]);
  });
  it("ignora a linha de total (sem código) e o título do bloco seguinte", () => {
    const r = lerPlanilhaContas([luz]);
    expect(r.abas[0].linhas.map((l) => l.codigo)).toEqual(["1/92228-6", "1/171719-8", "1/91003-4"]);
    expect(r.abas[0].semValores).toBe(1); // a linha "523 / 433 / 6545 / 20000" (ficha e empenho) não é conta
  });
  it("lê a aba de água (matrícula, sem segundo código) e marca parcelas de dívida como ignoradas", () => {
    const l = lerPlanilhaContas([agua]).abas[0].linhas;
    expect(l).toHaveLength(3);
    expect(l[0]).toMatchObject({ codigo: "10374078", codigo2: null, ignorada: expect.stringContaining("dívida") });
    expect(l[1].ignorada).toBeTruthy();
    expect(l[2]).toMatchObject({ codigo: "10380001", ignorada: null });
    expect(l[2].valores.slice(0, 3)).toEqual([120.5, 99, 101.1]);
  });
  it("aba sem cabeçalho vira aviso, não erro", () => {
    const r = lerPlanilhaContas([{ nome: "Planilha", linhas: [["ENERGISA MARÇO 2026"], ["ADMINIST.", "EDUCAÇÃO"], ["1/92228-6   23", "1/164493-9   20"]] }, luz]);
    expect(r.abas.map((a) => a.nome)).toEqual(["ADMINISTRAÇÃO"]);
    expect(r.avisos[0]).toMatch(/Planilha/);
  });
  it("cabeçalho com meses em maiúsculas também vale", () => {
    const r = lerPlanilhaContas([{ nome: "SERV. URBANOS", linhas: [["CDC", null, "Setor", "Endereço", "JAN", "FEV", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"], ["1/1-1", "x", "Parque", "Estrada S/N", 10, 20]] }]);
    expect(r.abas[0].linhas[0].valores.slice(0, 2)).toEqual([10, 20]);
  });
});

describe("numeroDaCelula", () => {
  it("aceita número, formato brasileiro e ponto decimal", () => {
    expect(numeroDaCelula(12.5)).toBe(12.5);
    expect(numeroDaCelula("1.234,56")).toBe(1234.56);
    expect(numeroDaCelula("R$ 1234.56")).toBe(1234.56);
    expect(numeroDaCelula("")).toBeNull();
    expect(numeroDaCelula("abc")).toBeNull();
    expect(numeroDaCelula(null)).toBeNull();
  });
});

describe("secretariaDaAba", () => {
  const cat = [
    { id: "adm", nome: "Administração" }, { id: "as", nome: "Assistência Social" }, { id: "su", nome: "Serviços Urbanos" },
    { id: "ed", nome: "Educação" }, { id: "es", nome: "Esporte" }, { id: "sa", nome: "Saúde" }, { id: "gb", nome: "Gabinete do Prefeito" },
    { id: "ag", nome: "Agricultura" }, { id: "cu", nome: "Cultura" }, { id: "fa", nome: "Fazenda" }, { id: "ob", nome: "Obras" },
  ];
  it("casa os nomes das abas reais com o catálogo", () => {
    const m = (n: string) => secretariaDaAba(n, cat);
    expect(m("ADMINISTRAÇÃO ")).toBe("adm");
    expect(m("ASS. SOCIAL")).toBe("as");
    expect(m("DES. SOCIAL ")).toBe("as");
    expect(m("SERV. URBANOS")).toBe("su");
    expect(m("SERVIÇOS URB.")).toBe("su");
    expect(m("ESPORTES")).toBe("es");
    expect(m("GABINETE ")).toBe("gb");
    expect(m("SAÚDE")).toBe("sa");
  });
  it("Agricultura não é confundida com Cultura (uma contém a outra)", () => {
    expect(secretariaDaAba("AGRICULTURA", cat)).toBe("ag");
    expect(secretariaDaAba("CULTURA", cat)).toBe("cu");
    expect(secretariaDaAba("FAZENDA ", cat)).toBe("fa");
    expect(secretariaDaAba("OBRAS", cat)).toBe("ob");
  });
  it("aba desconhecida fica sem secretaria (a pessoa escolhe)", () => {
    expect(secretariaDaAba("SEDEGI", cat)).toBeNull();
  });
});

describe("apoio", () => {
  it("chave de código ignora espaços e maiúsculas", () => {
    expect(chaveCodigo(" 1/92228-6 ")).toBe("1/92228-6");
    expect(chaveCodigo("1/85860-5 ")).toBe(chaveCodigo("1/85860-5"));
  });
  it("endereço genérico não serve para casar imóveis", () => {
    expect(enderecoEspecifico("Rua Principal S/N")).toBe(false);
    expect(enderecoEspecifico("Estrada S/N")).toBe(false);
    expect(enderecoEspecifico("Rua José Almeida Kneipp, 17")).toBe(true);
  });
});
