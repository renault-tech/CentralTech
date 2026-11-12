import { describe, expect, it } from "vitest";
import { cpfValido, extrairDaDescricao, validarDocumento } from "@/lib/emendas/documentos";

describe("documentos", () => {
  it("valida CPF pelos dígitos", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
  });
  it("exige CNPJ para entidade e CPF para pessoa física", () => {
    expect(validarDocumento("entidade", "").ok).toBe(false);
    expect(validarDocumento("entidade", "11.222.333/0001-81")).toMatchObject({ ok: true, cnpj: "11.222.333/0001-81", cpf: null });
    expect(validarDocumento("pessoa_fisica", "")).toMatchObject({ ok: false });
    expect(validarDocumento("pessoa_fisica", "52998224725")).toMatchObject({ ok: true, cpf: "529.982.247-25", cnpj: null });
  });
  it("órgão público não exige CNPJ próprio", () => {
    expect(validarDocumento("orgao_publico", "")).toMatchObject({ ok: true, cnpj: null });
  });
  it("tira CNPJ e localidade do texto da emenda", () => {
    const d = "Reforço para repasse ao Esporte Clube Cataguases, CNPJ 01.386.349/0001-76, situado na Rua Dr. Cavalcanti, 114, Bairro Popular, cujo intuito será a construção.";
    expect(extrairDaDescricao(d)).toEqual({ cnpj: "01.386.349/0001-76", localidade: "Rua Dr. Cavalcanti, 114, Bairro Popular" });
    expect(extrairDaDescricao("CNPJ 24.060.184/0001-31 e 27.060.184/0001-31").cnpj).toBe("27.060.184/0001-31");
    expect(extrairDaDescricao("Reforço de dotação.")).toEqual({ cnpj: null, localidade: null });
  });
});
