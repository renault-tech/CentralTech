import { describe, expect, it } from "vitest";

import { lerParceria } from "@/lib/emendas/leitor-parceria";

describe("lerParceria", () => {
  it("acha nº do termo e a data da edição do jornal", () => {
    const r = lerParceria("Jornal Oficial - Edição 3.950 de 30 de agosto de 2026\nEXTRATO DE TERMO DE FOMENTO Nº 108/2026\nCataguases, 12 de agosto de 2026");
    expect(r).toEqual({ numeroTermo: "108/2026", dataPublicacao: "2026-08-30" });
  });
  it("não adivinha: data de assinatura sem contexto de publicação fica de fora", () => {
    expect(lerParceria("TERMO DE FOMENTO Nº 5/2026 Cataguases, 12 de agosto de 2026").dataPublicacao).toBeNull();
  });
  it("duas datas de publicação diferentes = ambíguo", () => {
    expect(lerParceria("Publicado na edição de 10/08/2026 e republicado na edição de 12/08/2026").dataPublicacao).toBeNull();
  });
  it("dois números de termo diferentes = ambíguo", () => {
    expect(lerParceria("Termo nº 001/2026 ... Termo nº 002/2026").numeroTermo).toBeNull();
  });
});
