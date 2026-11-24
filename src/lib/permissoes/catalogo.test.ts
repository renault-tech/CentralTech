import { describe, expect, it } from "vitest";
import { alternarPermissao, GRUPOS_COMPRAS, permissaoEfetiva, CHAVES_COMPRAS, MODELOS_COMPRAS, normalizarPermissoes } from "./catalogo";

describe("catálogo de permissões", () => {
  it("ligar editar contratos liga ver contratos", () => {
    const r = alternarPermissao(new Set(), "contratos_editar", true);
    expect([...r].sort()).toEqual(["contratos_editar", "contratos_ver"]);
  });
  it("desligar ver contratos desliga editar", () => {
    const r = alternarPermissao(new Set(["contratos_ver", "contratos_editar", "ver_logs"]), "contratos_ver", false);
    expect([...r]).toEqual(["ver_logs"]);
  });
  it("normalizar acrescenta o que falta", () => {
    expect(normalizarPermissoes(new Set(["contratos_editar"])).has("contratos_ver")).toBe(true);
  });
  it("modelos só usam chaves do catálogo e chaves não se repetem", () => {
    for (const m of MODELOS_COMPRAS) for (const c of m.chaves) expect(CHAVES_COMPRAS).toContain(c);
    expect(new Set(CHAVES_COMPRAS).size).toBe(CHAVES_COMPRAS.length);
  });
  it("permissão efetiva: linha avulsa manda; sem linha vale o perfil", () => {
    const criar = GRUPOS_COMPRAS.flatMap((g) => g.itens).find((i) => i.chave === "criar_processos")!;
    expect(permissaoEfetiva(criar, "coord_compras", new Set(), new Set())).toBe(true);
    expect(permissaoEfetiva(criar, "coord_compras", new Set(), new Set(["criar_processos"]))).toBe(false);
    expect(permissaoEfetiva(criar, "serv_compras", new Set(), new Set())).toBe(false);
    expect(permissaoEfetiva(criar, "serv_compras", new Set(["criar_processos"]), new Set())).toBe(true);
  });
});
