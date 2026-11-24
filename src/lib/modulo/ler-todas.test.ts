import { describe, expect, it } from "vitest";

import { lerTodasEmParalelo, TAMANHO_PAGINA, type BuscaPagina } from "@/lib/modulo/ler-todas";

function tabela(n: number, comContagem = true) {
  const linhas = Array.from({ length: n }, (_, i) => ({ id: i }));
  const chamadas: { de: number; ate: number; count?: string }[] = [];
  const buscar: BuscaPagina<{ id: number }> = async (de, ate, opcoes) => {
    chamadas.push({ de, ate, count: opcoes.count });
    return { data: linhas.slice(de, ate + 1), error: null, count: comContagem && opcoes.count ? n : null };
  };
  return { linhas, chamadas, buscar };
}
const falhou = (onde: string, erro: unknown): never => {
  throw new Error(`${onde}: ${String(erro)}`);
};

describe("lerTodasEmParalelo", () => {
  it("tabela pequena: uma ida só", async () => {
    const t = tabela(10);
    expect(await lerTodasEmParalelo(t.buscar, falhou, "x")).toEqual(t.linhas);
    expect(t.chamadas).toHaveLength(1);
  });

  it("tabela vazia", async () => {
    const t = tabela(0);
    expect(await lerTodasEmParalelo(t.buscar, falhou, "x")).toEqual([]);
  });

  it("várias páginas: junta tudo, na ordem, pedindo o total só na primeira", async () => {
    const t = tabela(TAMANHO_PAGINA * 2 + 620);
    const r = await lerTodasEmParalelo(t.buscar, falhou, "x");
    expect(r).toEqual(t.linhas);
    expect(t.chamadas).toHaveLength(3);
    expect(t.chamadas.filter((c) => c.count === "exact")).toHaveLength(1);
  });

  it("múltiplo exato do tamanho da página não perde nem repete linha", async () => {
    const t = tabela(TAMANHO_PAGINA * 2);
    const r = await lerTodasEmParalelo(t.buscar, falhou, "x");
    expect(r).toHaveLength(TAMANHO_PAGINA * 2);
    expect(new Set(r.map((l) => l.id)).size).toBe(TAMANHO_PAGINA * 2);
  });

  it("sem o total na resposta, lê em série e termina certo", async () => {
    const t = tabela(TAMANHO_PAGINA + 5, false);
    expect(await lerTodasEmParalelo(t.buscar, falhou, "x")).toEqual(t.linhas);
  });

  it("erro numa página das paralelas é repassado", async () => {
    const t = tabela(TAMANHO_PAGINA * 2 + 1);
    const buscar: BuscaPagina<{ id: number }> = async (de, ate, o) => (de >= TAMANHO_PAGINA * 2 ? { data: null, error: "boom" } : t.buscar(de, ate, o));
    await expect(lerTodasEmParalelo(buscar, falhou, "contas")).rejects.toThrow("contas: boom");
  });
});
