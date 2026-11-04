import { describe, expect, it } from "vitest";

import {
  candidatosModelo,
  escolherAno,
  escolherMarca,
  lerLista,
  lerPreco,
  pontuarModelo,
  precoParaNumero,
  tipoFipeSugerido,
} from "@/lib/frotas/fipe-parse";

describe("preço", () => {
  it("lê o valor em reais", () => {
    expect(precoParaNumero("R$ 72.000,00")).toBe(72000);
    expect(precoParaNumero("R$ 1.234.567,89")).toBe(1234567.89);
    expect(precoParaNumero("")).toBeNull();
  });
  it("lê a resposta da consulta (formato v2 e v1)", () => {
    expect(lerPreco({ price: "R$ 72.000,00", referenceMonth: "novembro de 2026 ", codeFipe: "001267-0", model: "Argo" })).toEqual({
      valor: 72000,
      referencia: "novembro de 2026",
      codigoFipe: "001267-0",
      modelo: "Argo",
    });
    expect(lerPreco({ Valor: "R$ 10.500,00", MesReferencia: "outubro de 2026", CodigoFipe: "x", Modelo: "Y" })?.valor).toBe(10500);
    expect(lerPreco({ erro: "x" })).toBeNull();
    expect(lerPreco(null)).toBeNull();
  });
});

describe("listas", () => {
  it("aceita a lista direta e a embrulhada", () => {
    expect(lerLista([{ code: "59", name: "VW - VolksWagen" }])).toEqual([{ codigo: "59", nome: "VW - VolksWagen" }]);
    expect(lerLista({ modelos: [{ codigo: 5940, nome: "Argo 1.0" }], anos: [] })).toEqual([{ codigo: "5940", nome: "Argo 1.0" }]);
    expect(lerLista({ anos: [{ codigo: "2018-1", nome: "2018 Gasolina" }] })).toEqual([{ codigo: "2018-1", nome: "2018 Gasolina" }]);
    expect(lerLista("lixo")).toEqual([]);
    expect(lerLista([null, { code: 1 }])).toEqual([]);
  });
});

describe("escolha de tipo, marca, modelo e ano", () => {
  it("sugere o tipo pela classificação; máquina não tem FIPE", () => {
    expect(tipoFipeSugerido({ classificacao: "leve" })).toBe("carros");
    expect(tipoFipeSugerido({ classificacao: null })).toBe("carros");
    expect(tipoFipeSugerido({ classificacao: "moto" })).toBe("motos");
    expect(tipoFipeSugerido({ classificacao: "pesado" })).toBe("caminhoes");
    expect(tipoFipeSugerido({ classificacao: "maquina" })).toBeNull();
  });

  const marcas = [
    { codigo: "59", nome: "VW - VolksWagen" },
    { codigo: "23", nome: "GM - Chevrolet" },
    { codigo: "21", nome: "Fiat" },
    { codigo: "56", nome: "Mercedes-Benz" },
  ];
  it("acha a marca com o prefixo que a FIPE usa", () => {
    expect(escolherMarca(marcas, "Volkswagen")?.codigo).toBe("59");
    expect(escolherMarca(marcas, "Chevrolet")?.codigo).toBe("23");
    expect(escolherMarca(marcas, "Mercedes-Benz")?.codigo).toBe("56");
    expect(escolherMarca(marcas, "Lada")).toBeNull();
    expect(escolherMarca(marcas, null)).toBeNull();
  });

  const modelos = [
    { codigo: "1", nome: "Argo Drive 1.0 6V Flex" },
    { codigo: "2", nome: "Argo HGT 1.8 16V Flex Aut." },
    { codigo: "3", nome: "Uno Mille Way Economy 1.0 Fire Flex 8V 4p" },
    { codigo: "4", nome: "Palio Fire 1.0" },
  ];
  it("ordena os modelos pelo que mais se parece com o cadastro", () => {
    expect(pontuarModelo("ARGO 1.0", "Argo Drive 1.0 6V Flex")).toBe(1);
    expect(pontuarModelo("ARGO 1.0", "Palio Fire 1.0")).toBeCloseTo(1 / 3);
    expect(candidatosModelo(modelos, "UNO MILLE WAY ECON")[0].codigo).toBe("3");
    // "Argo HGT" (mesmo nome) vem antes de "Palio 1.0" (só o número em comum).
    expect(candidatosModelo(modelos, "ARGO 1.0").map((m) => m.codigo)).toEqual(["1", "2", "4", "3"]);
    expect(candidatosModelo(modelos, "Ônibus")).toEqual([]);
  });

  const anos = [
    { codigo: "2018-1", nome: "2018 Gasolina" },
    { codigo: "2018-3", nome: "2018 Diesel" },
    { codigo: "2017-1", nome: "2017 Gasolina" },
  ];
  it("escolhe o ano pelo ano do modelo e pelo combustível", () => {
    expect(escolherAno(anos, 2017, "gasolina")?.codigo).toBe("2017-1");
    expect(escolherAno(anos, 2018, "diesel_s10")?.codigo).toBe("2018-3");
    expect(escolherAno(anos, 2018, "gasolina")?.codigo).toBe("2018-1");
    expect(escolherAno(anos, 2018, null)?.codigo).toBe("2018-1");
    expect(escolherAno(anos, 1999, "flex")).toBeNull();
    expect(escolherAno(anos, null, "flex")).toBeNull();
  });
});
