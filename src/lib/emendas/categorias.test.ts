import { describe, expect, it } from "vitest";

import { CATEGORIAS, INFO_CATEGORIA, categoriaPelaNaturezaJuridica, categoriaPorTipoENome, conflitoInstrumento, sugestaoDaCategoria, tipoDaCategoria } from "@/lib/emendas/categorias";

describe("categorias do beneficiário", () => {
  it("toda categoria tem tipo de cadastro e texto", () => {
    for (const c of CATEGORIAS) {
      expect(INFO_CATEGORIA[c].nome.length).toBeGreaterThan(3);
      expect(["entidade", "orgao_publico", "pessoa_fisica"]).toContain(tipoDaCategoria(c));
    }
  });

  it("a categoria sugere tipo de execução e instrumento", () => {
    expect(sugestaoDaCategoria("osc")).toEqual({ tipoExecucao: "osc", instrumento: "termo_fomento" });
    expect(sugestaoDaCategoria("consorcio")).toEqual({ tipoExecucao: "ente", instrumento: "convenio" });
    expect(sugestaoDaCategoria("saude_sus")).toEqual({ tipoExecucao: "ente", instrumento: "termo_fomento" });
    expect(sugestaoDaCategoria("orgao_municipal")).toEqual({ tipoExecucao: "direta", instrumento: null });
    expect(sugestaoDaCategoria(null)).toEqual({ tipoExecucao: null, instrumento: null });
  });

  it("deduz a categoria da natureza jurídica e do nome", () => {
    expect(categoriaPelaNaturezaJuridica("399-9 - Associação Privada")).toBe("osc");
    expect(categoriaPelaNaturezaJuridica("118-3 - Consórcio Público de Direito Público (Associação Pública)")).toBe("consorcio");
    expect(categoriaPelaNaturezaJuridica("103-5 - Município")).toBe("orgao_municipal");
    expect(categoriaPelaNaturezaJuridica("Hospital de Cataguases")).toBe("saude_sus");
    expect(categoriaPelaNaturezaJuridica("213-1 - Empresário (Individual)")).toBeNull();
    expect(categoriaPorTipoENome("entidade", "Cisum")).toBe("consorcio");
    expect(categoriaPorTipoENome("entidade", "AMAF")).toBe("osc");
    expect(categoriaPorTipoENome("orgao_publico", "Secretaria de Saúde")).toBe("orgao_municipal");
  });

  it("sinaliza (sem bloquear) instrumento incompatível com a categoria", () => {
    expect(conflitoInstrumento("consorcio", "termo_fomento")).toMatch(/não é organização da sociedade civil/);
    expect(conflitoInstrumento("consorcio", null)).not.toBeNull();
    expect(conflitoInstrumento("consorcio", "convenio")).toBeNull();
    expect(conflitoInstrumento("osc", "convenio")).toMatch(/MROSC/);
    expect(conflitoInstrumento("osc", "termo_fomento")).toBeNull();
    expect(conflitoInstrumento("saude_sus", "termo_fomento")).toBeNull();
    expect(conflitoInstrumento(null, "convenio")).toBeNull();
  });
});
