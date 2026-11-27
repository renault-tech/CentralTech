import { describe, expect, it } from "vitest";

import { cifrar, decifrar } from "@/lib/documentos/cripto";

describe("cripto", () => {
  const seg = "uma-chave-bem-longa-para-teste";
  it("volta ao texto original", () => {
    const c = cifrar("1//refresh-token", seg);
    expect(c).not.toContain("refresh");
    expect(decifrar(c, seg)).toBe("1//refresh-token");
  });
  it("cada cifra é diferente", () => {
    expect(cifrar("x", seg)).not.toBe(cifrar("x", seg));
  });
  it("recusa chave errada e dado adulterado", () => {
    const c = cifrar("segredo", seg);
    expect(() => decifrar(c, "outra-chave-bem-longa-aqui")).toThrow();
    const partes = c.split(".");
    partes[3] = Buffer.from("adulterado").toString("base64url");
    expect(() => decifrar(partes.join("."), seg)).toThrow();
  });
  it("recusa chave curta", () => {
    expect(() => cifrar("x", "curta")).toThrow();
  });
});
