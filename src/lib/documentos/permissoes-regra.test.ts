import { describe, expect, it } from "vitest";

import { padraoDoPerfil, resolverPermissoes } from "@/lib/documentos/permissoes-regra";

describe("permissões de documentos", () => {
  it("padrão por perfil", () => {
    expect(padraoDoPerfil("gestor")).toEqual({ enviar: true, analisar: true });
    expect(padraoDoPerfil("operador")).toEqual({ enviar: true, analisar: false });
    expect(padraoDoPerfil("consulta")).toEqual({ enviar: false, analisar: false });
    expect(padraoDoPerfil(null)).toEqual({ enviar: false, analisar: false });
  });
  it("ajuste por pessoa vence o padrão", () => {
    expect(resolverPermissoes("operador", { pode_enviar: false, pode_analisar: true })).toEqual({ enviar: false, analisar: true });
    expect(resolverPermissoes("gestor", { pode_enviar: null, pode_analisar: false })).toEqual({ enviar: true, analisar: false });
  });
  it("administrador nunca perde", () => {
    expect(resolverPermissoes("admin", { pode_enviar: false, pode_analisar: false })).toEqual({ enviar: true, analisar: true });
  });
});
