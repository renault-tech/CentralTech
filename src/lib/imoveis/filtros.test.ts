import { describe, expect, it } from "vitest";

import { filtrarImoveis, lerFiltroImoveis } from "./filtros";
import type { Imovel } from "@/types/imoveis";

const im = (id: string, nome: string, o: Partial<Imovel> = {}) => ({ id, nome, endereco: "Rua X", secretaria_id: "s1", situacao: "ativo", ...o }) as Imovel;
const lista = [im("1", "CRAS Centro"), im("2", "Posto de Saúde Vila Reis", { secretaria_id: "s2" }), im("3", "Garagem", { situacao: "entregue" })];

describe("filtros de imóveis", () => {
  it("lê a URL e ignora situação inválida", () => {
    expect(lerFiltroImoveis({ q: " cras ", sit: "xyz", sec: "s1", alerta: "1" })).toEqual({ q: "cras", secretaria: "s1", situacao: null, alerta: true });
  });
  it("busca sem acento nem maiúsculas", () => {
    expect(filtrarImoveis(lista, { q: "saude", secretaria: null, situacao: null, alerta: false }, new Set()).map((i) => i.id)).toEqual(["2"]);
  });
  it("combina secretaria, situação e só com alerta", () => {
    expect(filtrarImoveis(lista, { q: "", secretaria: "s1", situacao: null, alerta: false }, new Set()).map((i) => i.id)).toEqual(["1", "3"]);
    expect(filtrarImoveis(lista, { q: "", secretaria: null, situacao: "entregue", alerta: false }, new Set()).map((i) => i.id)).toEqual(["3"]);
    expect(filtrarImoveis(lista, { q: "", secretaria: null, situacao: null, alerta: true }, new Set(["2"])).map((i) => i.id)).toEqual(["2"]);
  });
});
