import { describe, expect, it } from "vitest";

import { agruparPorDimensao, contarFiltros, filtrarItens, opcaoEscolhida, opcoesPedidas, type Dimensao, type Medida } from "@/lib/modulo/area-trabalho";

type Item = { id: string; etapa: string; sec: string; valor: number; texto: string };
const itens: Item[] = [
  { id: "1", etapa: "a", sec: "Saúde", valor: 100, texto: "Troca de embreagem" },
  { id: "2", etapa: "b", sec: "Saúde", valor: 50, texto: "Revisão geral" },
  { id: "3", etapa: "c", sec: "Educação", valor: 30, texto: "Freios" },
  { id: "4", etapa: "a", sec: "Educação", valor: 20, texto: "Suspensão" },
];
const etapa: Dimensao<Item> = {
  chave: "etapa", rotulo: "Etapa", param: "sit", valores: (i) => [{ chave: i.etapa, rotulo: i.etapa.toUpperCase() }],
  aliases: { abertas: ["a", "b"], todas: [] }, padrao: "abertas", ordem: ["c", "b", "a"],
};
const secretaria: Dimensao<Item> = { chave: "sec", rotulo: "Secretaria", param: "sec", valores: (i) => [{ chave: i.sec, rotulo: i.sec }] };
const dims = [etapa, secretaria];
const lerDe = (o: Record<string, string>) => (p: string) => o[p] ?? null;
const busca = (q: string) => ({ texto: (i: Item) => i.texto, q });

describe("filtrarItens", () => {
  it("aplica o padrão da dimensão quando o parâmetro está vazio", () => {
    expect(filtrarItens(itens, dims, lerDe({}), null).map((i) => i.id)).toEqual(["1", "2", "4"]);
  });
  it("'todas' (apelido vazio) tira o filtro", () => {
    expect(filtrarItens(itens, dims, lerDe({ sit: "todas" }), null)).toHaveLength(4);
  });
  it("combina dimensões", () => {
    expect(filtrarItens(itens, dims, lerDe({ sit: "a", sec: "Educação" }), null).map((i) => i.id)).toEqual(["4"]);
  });
  it("ignora a dimensão pedida (para o gráfico dela mostrar todas as opções)", () => {
    expect(filtrarItens(itens, dims, lerDe({ sit: "a", sec: "Saúde" }), null, ["sit"]).map((i) => i.id)).toEqual(["1", "2"]);
  });
  it("busca sem acento e sem maiúsculas", () => {
    expect(filtrarItens(itens, dims, lerDe({ sit: "todas" }), busca("SUSPENSAO")).map((i) => i.id)).toEqual(["4"]);
  });
  it("um item em várias opções casa com qualquer uma", () => {
    const tags: Dimensao<{ t: string[] }> = { chave: "t", rotulo: "T", param: "t", valores: (i) => i.t.map((x) => ({ chave: x, rotulo: x })) };
    expect(filtrarItens([{ t: ["x", "y"] }, { t: ["z"] }], [tags], lerDe({ t: "y" }), null)).toHaveLength(1);
  });
});

describe("opções pedidas", () => {
  it("padrão, apelido e valor direto", () => {
    expect(opcoesPedidas(etapa, lerDe({}))).toEqual(["a", "b"]);
    expect(opcoesPedidas(etapa, lerDe({ sit: "todas" }))).toBeNull();
    expect(opcoesPedidas(etapa, lerDe({ sit: "c" }))).toEqual(["c"]);
    expect(opcoesPedidas(secretaria, lerDe({}))).toBeNull();
  });
  it("só conta como escolhida a opção explícita", () => {
    expect(opcaoEscolhida(etapa, lerDe({}))).toBe("");
    expect(opcaoEscolhida(etapa, lerDe({ sit: "abertas" }))).toBe("");
    expect(opcaoEscolhida(etapa, lerDe({ sit: "c" }))).toBe("c");
  });
});

describe("agruparPorDimensao", () => {
  const valor: Medida<Item> = { chave: "valor", rotulo: "R$", titulo: "Valor", valor: (i) => i.valor, dinheiro: true };
  it("conta e soma a medida, na ordem fixa da dimensão", () => {
    const g = agruparPorDimensao(itens, etapa, valor);
    expect(g.map((x) => [x.chave, x.n, x.soma])).toEqual([["c", 1, 30], ["b", 1, 50], ["a", 2, 120]]);
  });
  it("sem ordem fixa, vem pelo maior número", () => {
    expect(agruparPorDimensao(itens, secretaria).map((x) => x.chave)).toEqual(["Educação", "Saúde"]);
  });
});

describe("contarFiltros", () => {
  it("não conta o padrão, conta a busca", () => {
    expect(contarFiltros(dims, lerDe({}), "")).toBe(0);
    expect(contarFiltros(dims, lerDe({ sec: "Saúde" }), "freio")).toBe(2);
  });
});
