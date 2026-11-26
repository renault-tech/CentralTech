import { describe, expect, it } from "vitest";

import { COLUNAS_LISTA, colunasDoArquivo } from "@/lib/emendas/colunas-lista";

describe("colunasDoArquivo", () => {
  it("sem escolha: PDF usa o resumo e Excel usa tudo", () => {
    expect(colunasDoArquivo(null, "pdf").every((c) => c.pdf)).toBe(true);
    expect(colunasDoArquivo("", "xlsx")).toHaveLength(COLUNAS_LISTA.length);
  });
  it("com escolha: respeita as chaves, na ordem do catálogo, ignorando as desconhecidas", () => {
    expect(colunasDoArquivo("pago,xyz,numero", "pdf").map((c) => c.chave)).toEqual(["numero", "pago"]);
  });
  it("escolha só com chaves inválidas cai no padrão", () => {
    expect(colunasDoArquivo("xyz", "xlsx")).toHaveLength(COLUNAS_LISTA.length);
  });
  it("chaves únicas", () => {
    expect(new Set(COLUNAS_LISTA.map((c) => c.chave)).size).toBe(COLUNAS_LISTA.length);
  });
});
