import { describe, expect, it } from "vitest";

import { acharImovel, montarPrevia, planejarGravacao, type DecisoesImportacao, type Existentes } from "./plano-contas";
import type { AbaLida, LinhaPlanilha } from "./planilha-contas";

const linha = (aba: string, n: number, codigo: string, setor: string, endereco: string, valores: (number | null)[], ignorada: string | null = null): LinhaPlanilha => ({
  aba, linhaNumero: n, projeto: null, codigo, codigo2: null, setor, endereco, valores: [...valores, ...Array(12 - valores.length).fill(null)], ignorada,
});

const abas: AbaLida[] = [
  {
    nome: "SAÚDE", blocos: 1, semValores: 0,
    linhas: [
      linha("SAÚDE", 5, "100", "CEO - Centro Odontológico", "José Almeida Kneip 294", [10, 20, 30]),
      linha("SAÚDE", 6, "200", "UBS Centro", "Rua Principal S/N", [5, null, 7]),
      linha("SAÚDE", 7, "300", "Dívida", "Praça X, 1", [1, 1], "Parcela de dívida"),
    ],
  },
  { nome: "SEDEGI", blocos: 1, semValores: 0, linhas: [linha("SEDEGI", 5, "400", "Sine 01", "Av. José Maria, 60", [9])] },
];

const ex: Existentes = {
  secretarias: [{ id: "sec-saude", nome: "Saúde" }],
  imoveis: [{ id: "im-ceo", nome: "CEO Centro Odontologico", endereco: "x", secretaria_id: "sec-saude" }, { id: "im-ubs", nome: "UBS", endereco: "Rua Principal S/N", secretaria_id: "sec-saude" }],
  unidades: [{ id: "un-100", imovel_id: "im-ceo", tipo: "luz", numero: " 100 " }, { id: "un-agua", imovel_id: "im-ceo", tipo: "agua", numero: "200" }],
  contas: [{ unidade_id: "un-100", referencia: "2026-01-01" }],
};

describe("acharImovel", () => {
  it("casa por nome igual (sem acento) e não por endereço genérico", () => {
    expect(acharImovel("CEO Centro Odontológico", "qualquer", "sec-saude", ex.imoveis)).toBe("im-ceo");
    expect(acharImovel("Outro nome", "Rua Principal S/N", "sec-saude", ex.imoveis)).toBeNull();
    expect(acharImovel("CEO Centro Odontológico", "qualquer", null, ex.imoveis)).toBeNull();
  });
  it("casa por endereço específico quando o nome difere", () => {
    expect(acharImovel("Posto", "Rua Doze, 33 Centro", "s", [{ id: "i", nome: "Zé", endereco: "rua doze, 33 centro", secretaria_id: "s" }])).toBe("i");
  });
});

describe("montarPrevia", () => {
  const p = montarPrevia(abas, "luz", 2026, ex);
  it("reconhece unidade existente (código com espaços), nova e ignorada", () => {
    expect(p[0].linhas.map((l) => l.situacao)).toEqual(["unidade_existente", "nova", "ignorada"]);
  });
  it("conta meses novos e já lançados da unidade existente", () => {
    expect(p[0].linhas[0]).toMatchObject({ unidadeId: "un-100", mesesComValor: 3, mesesNovos: 2, mesesJaLancados: 1 });
  });
  it("sugere a secretaria pela aba e deixa SEDEGI sem sugestão", () => {
    expect(p[0].secretariaSugerida).toBe("sec-saude");
    expect(p[1].secretariaSugerida).toBeNull();
  });
  it("água e luz têm unidades separadas (mesmo código não se cruza)", () => {
    expect(montarPrevia(abas, "agua", 2026, ex)[0].linhas[1].situacao).toBe("unidade_existente");
    expect(montarPrevia(abas, "luz", 2026, ex)[0].linhas[1].situacao).toBe("nova");
  });
});

describe("planejarGravacao", () => {
  const dec: DecisoesImportacao = {
    tipo: "luz", ano: 2026, vinculo: "proprio",
    abas: { SAÚDE: "sec-saude", SEDEGI: "novo" },
    linhas: { "SAÚDE#5": { incluir: true, imovelId: null }, "SAÚDE#6": { incluir: true, imovelId: "im-ubs" }, "SAÚDE#7": { incluir: true, imovelId: null }, "SEDEGI#5": { incluir: true, imovelId: null } },
  };
  const plano = planejarGravacao(abas, dec, ex);
  it("não regrava conta de mês já lançado e conta o que pulou", () => {
    expect(plano.contasJaLancadas).toBe(1);
    expect(plano.contas.filter((c) => c.linha === "SAÚDE#5").map((c) => c.referencia)).toEqual(["2026-02-01", "2026-03-01"]);
  });
  it("liga a unidade nova ao imóvel escolhido e cria imóvel para a que não tem", () => {
    expect(plano.unidadesNovas.find((u) => u.linha === "SAÚDE#6")).toMatchObject({ imovel: { id: "im-ubs" } });
    expect(plano.imoveisNovos).toHaveLength(1);
    expect(plano.imoveisNovos[0]).toMatchObject({ nome: "Sine 01", secretaria: "novo:SEDEGI" });
  });
  it("cria a secretaria da aba escolhida como 'novo' uma única vez", () => {
    expect(plano.secretariasNovas).toEqual(["SEDEGI"]);
  });
  it("linha ignorada nunca entra, mesmo marcada", () => {
    expect(plano.contas.some((c) => c.linha === "SAÚDE#7")).toBe(false);
  });
  it("aba não importada ('') é pulada", () => {
    const p = planejarGravacao(abas, { ...dec, abas: { SAÚDE: "", SEDEGI: "" } }, ex);
    expect(p.contas).toEqual([]);
    expect(p.linhasImportadas).toBe(0);
  });
  it("imóvel escolhido que não existe é recusado com aviso", () => {
    const p = planejarGravacao(abas, { ...dec, linhas: { ...dec.linhas, "SAÚDE#6": { incluir: true, imovelId: "fantasma" } } }, ex);
    expect(p.avisos.some((a) => /não existe mais/.test(a))).toBe(true);
    expect(p.contas.some((c) => c.linha === "SAÚDE#6")).toBe(false);
  });
  it("código repetido na planilha: só a primeira linha entra", () => {
    const dupl: AbaLida[] = [{ nome: "X", blocos: 1, semValores: 0, linhas: [linha("X", 1, "9", "A", "Rua A, 1 Centro", [1]), linha("X", 2, "9", "B", "Rua B, 2 Centro", [2])] }];
    const p = planejarGravacao(dupl, { tipo: "luz", ano: 2026, vinculo: "proprio", abas: { X: "sec-saude" }, linhas: { "X#1": { incluir: true, imovelId: null }, "X#2": { incluir: true, imovelId: null } } }, ex);
    expect(p.linhasImportadas).toBe(1);
    expect(p.avisos[0]).toMatch(/já apareceu/);
  });
  it("duas unidades do mesmo setor e endereço viram um imóvel só", () => {
    const duas: AbaLida[] = [{ nome: "X", blocos: 1, semValores: 0, linhas: [linha("X", 1, "81", "Prefeitura", "Rua A, 1 Centro", [1]), linha("X", 2, "82", "PREFEITURA", "Rua A, 1 Centro", [2])] }];
    const p = planejarGravacao(duas, { tipo: "luz", ano: 2026, vinculo: "proprio", abas: { X: "sec-saude" }, linhas: { "X#1": { incluir: true, imovelId: null }, "X#2": { incluir: true, imovelId: null } } }, ex);
    expect(p.imoveisNovos).toHaveLength(1);
    expect(p.unidadesNovas).toHaveLength(2);
  });
});
