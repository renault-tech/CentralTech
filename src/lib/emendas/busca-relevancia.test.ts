import { describe, expect, it } from "vitest";

import { pontuarBusca } from "@/lib/emendas/painel-lista";

const emenda = (numero: number, objeto = "Aquisição de materiais", outros: string[] = []) => ({ numero, objeto, outros });

describe("pontuarBusca", () => {
  it("o número exato vale mais que o que começa com ele, que vale mais que o que o contém", () => {
    const exato = pontuarBusca(emenda(70), "70");
    const comeca = pontuarBusca(emenda(701), "70");
    const contem = pontuarBusca(emenda(170), "70");
    expect(exato).toBeGreaterThan(comeca);
    expect(comeca).toBeGreaterThan(contem);
  });

  it("depois dos números vêm o objeto e os outros campos, começo de palavra antes de meio de palavra", () => {
    const objetoInicio = pontuarBusca(emenda(5, "Reforma da quadra"), "quadra");
    const outro = pontuarBusca(emenda(6, "Compra de bolas", ["Quadra Municipal"]), "quadra");
    const meio = pontuarBusca(emenda(7, "Subquadras"), "quadra");
    expect(objetoInicio).toBeGreaterThan(outro);
    expect(outro).toBeGreaterThan(meio);
    expect(meio).toBeGreaterThan(0);
  });

  it("sem texto, nada muda; sem correspondência, zero", () => {
    expect(pontuarBusca(emenda(1), "")).toBe(0);
    expect(pontuarBusca(emenda(1), "zzz")).toBe(0);
  });

  it("ordenar por pontos coloca a 70 no topo, seguida das que mais se parecem", () => {
    const lista = [emenda(7), emenda(170), emenda(701), emenda(70), emenda(370)];
    const ordem = lista
      .map((e, i) => ({ e, i, p: pontuarBusca(e, "70") }))
      .filter((x) => x.p > 0)
      .sort((a, b) => b.p - a.p || a.i - b.i)
      .map((x) => x.e.numero);
    expect(ordem).toEqual([70, 701, 170, 370]);
  });
});
