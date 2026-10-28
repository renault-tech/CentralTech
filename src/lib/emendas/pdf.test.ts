import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { montarPdfTabelas } from "@/lib/emendas/pdf";

describe("montarPdfTabelas", () => {
  it("gera um PDF válido, com várias páginas quando há muitas linhas e acentos", () => {
    const linhas = Array.from({ length: 120 }, (_, i) => [i + 1, "Antônio Gilmar de Oliveira", "Repasse ao Hospital de Cataguases para custeio de leitos — “UTI” ≥ 10", 1234.5 * (i + 1)]);
    const pdf = montarPdfTabelas({
      titulo: "Emendas impositivas - 2026",
      subtitulo: "teste",
      tabelas: [{ titulo: "Emendas", colunas: ["Nº", "Vereador", "Objeto", "Valor"], monetarias: [3], linhas, total: ["", "", "Total", 999] }],
    });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    const paginas = (new TextDecoder("latin1").decode(pdf).match(/\/Type\s*\/Page\b/g) ?? []).length;
    expect(paginas).toBeGreaterThan(2);
  });
});
