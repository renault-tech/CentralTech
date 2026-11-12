import { describe, expect, it } from "vitest";
import { cpfValido, validarDocumento } from "@/lib/emendas/documentos";

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
});
