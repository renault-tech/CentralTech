import { describe, expect, it } from "vitest";

import { buscarCnpj, categoriaDaNatureza, interpretarBrasilApiCnpj } from "@/lib/cnpj";

const exemplo = {
  cnpj: "27060184000131",
  razao_social: "CONSELHO DE DESENVOLVIMENTO COMUNITARIO DO DISTRITO DE CATAGUARINO",
  descricao_tipo_de_logradouro: "RUA",
  logradouro: "DAS FLORES",
  numero: "120",
  complemento: "",
  bairro: "CENTRO",
  municipio: "CATAGUASES",
  uf: "MG",
  cep: "36770000",
  email: "CONTATO@EXEMPLO.ORG",
  ddd_telefone_1: "32999990000",
  natureza_juridica: "Associação Privada",
  codigo_natureza_juridica: "3999",
  descricao_situacao_cadastral: "ATIVA",
  qsa: [{ nome_socio: "MARIA DA SILVA", qualificacao_socio: "Presidente" }],
};

describe("interpretarBrasilApiCnpj", () => {
  it("normaliza nome, endereço, contato e categoria", () => {
    const d = interpretarBrasilApiCnpj(exemplo)!;
    expect(d.cnpj).toBe("27060184000131");
    expect(d.nome).toBe("Conselho de Desenvolvimento Comunitario do Distrito de Cataguarino");
    expect(d.endereco).toContain("Rua das Flores");
    expect(d.endereco).toContain("120");
    expect(d.endereco).toContain("36770-000");
    expect(d.email).toBe("contato@exemplo.org");
    expect(d.representante).toBe("Maria da Silva");
    expect(d.categoria).toBe("osc");
    expect(d.ativa).toBe(true);
  });
  it("recusa resposta sem CNPJ ou sem nome", () => {
    expect(interpretarBrasilApiCnpj({})).toBeNull();
    expect(interpretarBrasilApiCnpj({ cnpj: "123", razao_social: "X" })).toBeNull();
    expect(interpretarBrasilApiCnpj(null)).toBeNull();
  });
  it("situação não ativa fica sinalizada", () => {
    expect(interpretarBrasilApiCnpj({ ...exemplo, descricao_situacao_cadastral: "BAIXADA" })!.ativa).toBe(false);
  });
});

describe("categoriaDaNatureza", () => {
  it("usa o texto e, na falta, o grupo do código", () => {
    expect(categoriaDaNatureza("Consórcio Público de Direito Público", "1015")).toBe("consorcio");
    expect(categoriaDaNatureza("Entidade sem tipo conhecido", "3034")).toBe("osc");
    expect(categoriaDaNatureza("Órgão Público do Poder Executivo Municipal", "1031")).toBe("orgao_municipal");
    expect(categoriaDaNatureza("Sociedade Empresária Limitada", "2062")).toBeNull();
  });
});

describe("buscarCnpj", () => {
  const resposta = (status: number, corpo: unknown) => (async () => ({ status, ok: status >= 200 && status < 300, json: async () => corpo })) as unknown as typeof fetch;
  it("devolve os dados, 'não encontrado' e 'indisponível'", async () => {
    expect((await buscarCnpj("27060184000131", resposta(200, exemplo))).ok).toBe(true);
    expect(await buscarCnpj("27060184000131", resposta(404, {}))).toEqual({ ok: false, motivo: "nao_encontrado" });
    expect(await buscarCnpj("27060184000131", resposta(500, {}))).toEqual({ ok: false, motivo: "indisponivel" });
    const falha = (async () => {
      throw new Error("rede");
    }) as unknown as typeof fetch;
    expect(await buscarCnpj("27060184000131", falha)).toEqual({ ok: false, motivo: "indisponivel" });
  });
});
