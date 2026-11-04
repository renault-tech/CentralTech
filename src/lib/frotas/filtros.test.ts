import { describe, expect, it } from "vitest";

import { filtrarManutencoes, filtrarNotas, filtrarVeiculos, lerFiltroNotas, lerFiltroVeiculos } from "@/lib/frotas/filtros";
import type { Manutencao, NotaCombustivel, Veiculo } from "@/types/frotas";

const HOJE = "2026-11-04";
const nomes = { secretarias: new Map([["edu", "Educação"], ["su", "Serviços Urbanos"]]), fornecedores: new Map([["p1", "Posto Alfa"]]) };

const nota = (id: string, sec: string, extra: Partial<NotaCombustivel> = {}): NotaCombustivel => ({
  id,
  secretaria_id: sec,
  fornecedor_id: null,
  numero_nf: `NF-${id}`,
  periodo_inicio: "2026-10-01",
  periodo_fim: "2026-10-15",
  data_emissao: "2026-10-15",
  valor: 100,
  enviada_secretaria_em: null,
  retornou_em: null,
  enviada_contabilidade_em: null,
  observacoes: null,
  criado_em: "",
  atualizado_em: "",
  ...extra,
});

describe("filtrarNotas", () => {
  const notas = [
    nota("1", "edu", { enviada_secretaria_em: "2026-10-20" }),
    nota("2", "su", { fornecedor_id: "p1", enviada_secretaria_em: "2026-10-20", retornou_em: "2026-10-28", enviada_contabilidade_em: "2026-10-29" }),
    nota("3", "su", { enviada_secretaria_em: "2026-08-20", retornou_em: "2026-08-28", enviada_contabilidade_em: "2026-08-29", periodo_inicio: "2026-08-01" }),
  ];
  it("por padrão esconde o que já está na Contabilidade há mais de 30 dias", () => {
    expect(filtrarNotas(notas, {}, HOJE, nomes).map((n) => n.id)).toEqual(["1", "2"]);
    expect(filtrarNotas(notas, { situacao: "todas" }, HOJE, nomes)).toHaveLength(3);
  });
  it("filtra por etapa, secretaria, quinzena e texto (sem acento)", () => {
    expect(filtrarNotas(notas, { situacao: "com_secretaria" }, HOJE, nomes).map((n) => n.id)).toEqual(["1"]);
    expect(filtrarNotas(notas, { secretaria: "su", situacao: "todas" }, HOJE, nomes)).toHaveLength(2);
    expect(filtrarNotas(notas, { quinzena: "2026-08-01", situacao: "todas" }, HOJE, nomes).map((n) => n.id)).toEqual(["3"]);
    expect(filtrarNotas(notas, { q: "educacao" }, HOJE, nomes).map((n) => n.id)).toEqual(["1"]);
    expect(filtrarNotas(notas, { q: "alfa" }, HOJE, nomes).map((n) => n.id)).toEqual(["2"]);
    expect(filtrarNotas(notas, { q: "nf-3", situacao: "todas" }, HOJE, nomes).map((n) => n.id)).toEqual(["3"]);
  });
});

const veic = (id: string, extra: Partial<Veiculo> = {}) => ({ id, placa: id.toUpperCase(), modelo: "Gol", marca: "Volkswagen", patrimonio: null, secretaria_id: "edu", situacao: "ativo", vinculo: "proprio", ...extra }) as Veiculo;

describe("filtrarVeiculos", () => {
  const lista = [veic("a"), veic("b", { situacao: "inativo", secretaria_id: "su" }), veic("c", { vinculo: "alugado", modelo: "Spin", marca: "Chevrolet" })];
  it("combina os filtros", () => {
    expect(filtrarVeiculos(lista, { situacao: "inativo" }, new Set()).map((v) => v.id)).toEqual(["b"]);
    expect(filtrarVeiculos(lista, { vinculo: "alugado" }, new Set()).map((v) => v.id)).toEqual(["c"]);
    expect(filtrarVeiculos(lista, { q: "chev" }, new Set()).map((v) => v.id)).toEqual(["c"]);
    expect(filtrarVeiculos(lista, { secretaria: "su" }, new Set()).map((v) => v.id)).toEqual(["b"]);
    expect(filtrarVeiculos(lista, { revisar: true }, new Set(["a", "c"])).map((v) => v.id)).toEqual(["a", "c"]);
  });
});

const man = (id: string, extra: Partial<Manutencao> = {}) =>
  ({
    id,
    veiculo_id: "a",
    secretaria_id: "edu",
    servico: "Embreagem",
    status_analise: "a_analisar",
    orcamento_recebido_em: "2026-11-02",
    analisado_em: null,
    oc_numero: null,
    oc_emitida_em: null,
    oc_enviada_em: null,
    nf_numero: null,
    nf_emissao: null,
    docs_retornaram_em: null,
    enviada_contabilidade_em: null,
    ...extra,
  }) as Manutencao;

describe("filtrarManutencoes", () => {
  const veiculos = new Map([["a", veic("a")]]);
  const lista = [
    man("1"),
    man("2", { status_analise: "liberado", analisado_em: "2026-11-03", oc_numero: "9/2026", oc_enviada_em: "2026-11-04" }),
    man("3", { status_analise: "recusado", analisado_em: "2026-11-03" }),
    man("4", { status_analise: "liberado", analisado_em: "2026-10-01", oc_numero: "8/2026", oc_enviada_em: "2026-10-02", nf_numero: "x", nf_emissao: "2026-10-03", docs_retornaram_em: "2026-10-04", enviada_contabilidade_em: "2026-10-05" }),
  ];
  const ctx = { veiculos, secretarias: new Map([["edu", "Educação"]]) };
  it("por padrão mostra só o que está em andamento", () => {
    expect(filtrarManutencoes(lista, {}, ctx).map((m) => m.id)).toEqual(["1", "2"]);
    expect(filtrarManutencoes(lista, { situacao: "todas" }, ctx)).toHaveLength(4);
    expect(filtrarManutencoes(lista, { situacao: "concluidas" }, ctx).map((m) => m.id)).toEqual(["4"]);
    expect(filtrarManutencoes(lista, { situacao: "recusadas" }, ctx).map((m) => m.id)).toEqual(["3"]);
    expect(filtrarManutencoes(lista, { situacao: "aguardando" }, ctx).map((m) => m.id)).toEqual(["2"]);
  });
  it("busca por OC, placa ou serviço", () => {
    expect(filtrarManutencoes(lista, { q: "9/2026", situacao: "todas" }, ctx).map((m) => m.id)).toEqual(["2"]);
    expect(filtrarManutencoes(lista, { q: "embreagem", situacao: "todas" }, ctx)).toHaveLength(4);
  });
});

describe("leitura da URL", () => {
  it("ignora valores fora da lista", () => {
    expect(lerFiltroNotas({ sit: "hackeado", quinz: "x" })).toEqual({ q: undefined, secretaria: undefined, quinzena: undefined, situacao: undefined });
    expect(lerFiltroVeiculos({ sit: "inativo", rev: "1", vinc: ["alugado", "x"] })).toMatchObject({ situacao: "inativo", revisar: true, vinculo: "alugado" });
  });
});
