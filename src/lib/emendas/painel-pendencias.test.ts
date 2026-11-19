import { describe, expect, it } from "vitest";

import {
  agruparPendencias,
  documentosFaltando,
  filtrarPendencias,
  indicadores,
  porArea,
  porAssunto,
  porMotivo,
  type EmendaPainel,
  type FiltrosPainel,
  type LinhaDocFaltando,
  type LinhaPendencia,
} from "@/lib/emendas/painel-pendencias";

const F: FiltrosPainel = { t: "", g: "", s: "", r: "", a: "", m: "", j: "", q: "" };
const linha = (o: Partial<LinhaPendencia>): LinhaPendencia => ({
  emendaId: "e1", numero: 1, objeto: "Obra", valor: 1000, tipo: "osc", secretariaId: "s1", secretaria: "Saúde",
  regra: "vigencia:x", gravidade: "media", titulo: "Vigência", detalhe: "", ...o,
});
const L = [
  linha({ emendaId: "e1", numero: 1, gravidade: "alta", regra: "empenho_maior" }),
  linha({ emendaId: "e1", numero: 1, gravidade: "media", regra: "vigencia:a", valor: 1000 }),
  linha({ emendaId: "e2", numero: 2, secretariaId: "s2", secretaria: "Educação", tipo: "direta", valor: 500, gravidade: "baixa", regra: "objeto_generico" }),
  linha({ emendaId: "e3", numero: 3, valor: 200, regra: "vigencia:b", justificativa: "ok" }),
];

describe("painel de pendências", () => {
  it("justificadas ficam fora, a menos que o filtro peça", () => {
    expect(filtrarPendencias(L, F)).toHaveLength(3);
    expect(filtrarPendencias(L, { ...F, j: "1" })).toHaveLength(4);
  });

  it("filtra por tipo, secretaria, gravidade, área e busca; ignorar tira só o próprio filtro", () => {
    expect(filtrarPendencias(L, { ...F, t: "direta" })).toHaveLength(1);
    expect(filtrarPendencias(L, { ...F, s: "s1" })).toHaveLength(2);
    expect(filtrarPendencias(L, { ...F, g: "alta" })).toHaveLength(1);
    expect(filtrarPendencias(L, { ...F, a: "Financeiro" })).toHaveLength(1);
    expect(filtrarPendencias(L, { ...F, q: "educ" })).toHaveLength(1);
    expect(filtrarPendencias(L, { ...F, g: "alta", t: "direta" }, ["g"])).toHaveLength(1);
  });

  it("cada emenda conta uma vez no grupo, com o valor dela", () => {
    const g = agruparPendencias(filtrarPendencias(L, F), (l) => ({ chave: l.secretariaId, rotulo: l.secretaria }));
    const saude = g.find((x) => x.chave === "s1")!;
    expect(saude.total).toBe(2);
    expect(saude.emendas).toBe(1);
    expect(saude.valor).toBe(1000);
    expect(saude.alta + saude.media + saude.baixa).toBe(saude.total);
  });

  it("áreas aparecem na ordem fixa, inclusive as vazias; assuntos vêm do maior para o menor", () => {
    const areas = porArea(filtrarPendencias(L, F));
    expect(areas.map((a) => a.rotulo)).toEqual(["Financeiro", "Prazos e vigência", "Execução", "Publicidade e conta", "Cadastro"]);
    expect(areas.find((a) => a.rotulo === "Execução")!.total).toBe(0);
    expect(porAssunto(filtrarPendencias(L, F))[0].total).toBeGreaterThanOrEqual(1);
  });

  it("indicadores: pendências, emendas afetadas e valor sem contar duas vezes", () => {
    const emendas: EmendaPainel[] = [
      { id: "e1", numero: 1, objeto: "Obra", valor: 1000, tipo: "osc", secretariaId: "s1", secretaria: "Saúde" },
      { id: "e2", numero: 2, objeto: "Obra", valor: 500, tipo: "direta", secretariaId: "s2", secretaria: "Educação" },
      { id: "e3", numero: 3, objeto: "Obra", valor: 200, tipo: "osc", secretariaId: "s1", secretaria: "Saúde" },
      { id: "e4", numero: 4, objeto: "Obra", valor: 300, tipo: "osc", secretariaId: "s1", secretaria: "Saúde" },
    ];
    const i = indicadores(filtrarPendencias(L, F), L, emendas, F);
    expect(i).toMatchObject({ pendencias: 3, altas: 1, emendasAfetadas: 2, emendasNoRecorte: 4, valorAfetado: 1500, valorNoRecorte: 2000, justificadas: 1 });
  });

  it("documentos faltando agrupam por documento e respeitam tipo e secretaria", () => {
    const d = (n: number, doc: string, s = "s1", tipo: "osc" | "ente" = "osc"): LinhaDocFaltando => ({
      emendaId: `e${n}`, numero: n, objeto: "x", valor: 100, tipo, secretariaId: s, secretaria: s, doc, rotulo: doc,
    });
    const docs = [d(2, "termo"), d(1, "termo"), d(1, "plano_trabalho"), d(3, "termo", "s2", "ente")];
    const g = documentosFaltando(docs, F);
    expect(g[0]).toMatchObject({ doc: "termo", valor: 300 });
    expect(g[0].emendas.map((e) => e.numero)).toEqual([1, 2, 3]);
    expect(documentosFaltando(docs, { ...F, s: "s2" })).toHaveLength(1);
    expect(documentosFaltando(docs, { ...F, t: "ente" })[0].emendas).toHaveLength(1);
  });

  it("motivos: filtra, agrupa e conta a pendência em cada motivo que ela tem", () => {
    const M = [
      linha({ emendaId: "e1", numero: 1, regra: "data_fora_de_ordem:paga", titulo: "Datas fora de ordem", motivos: [{ chave: "data_fora_de_ordem:extrato>paga", rotulo: "Pagamento antes do extrato" }] }),
      linha({ emendaId: "e2", numero: 2, regra: "data_fora_de_ordem:paga", titulo: "Datas fora de ordem", motivos: [{ chave: "data_fora_de_ordem:extrato>paga", rotulo: "Pagamento antes do extrato" }] }),
      linha({ emendaId: "e3", numero: 3, regra: "data_fora_de_ordem:empenhada", titulo: "Datas fora de ordem", motivos: [{ chave: "data_fora_de_ordem:termo>empenhada", rotulo: "Empenho antes do termo" }] }),
      linha({ emendaId: "e4", numero: 4, regra: "publicidade_incompleta", titulo: "Publicidade", motivos: [{ chave: "publicidade_incompleta:VIII", rotulo: "Item VIII" }, { chave: "publicidade_incompleta:X", rotulo: "Item X" }] }),
      linha({ emendaId: "e5", numero: 5, regra: "empenho_maior", titulo: "Empenho" }),
    ];
    const g = porMotivo(filtrarPendencias(M, F));
    expect(g.map((x) => [x.chave, x.total])).toEqual([
      ["data_fora_de_ordem:extrato>paga", 2],
      ["data_fora_de_ordem:termo>empenhada", 1],
      ["publicidade_incompleta:VIII", 1],
      ["publicidade_incompleta:X", 1],
    ]);
    expect(porMotivo(M, true)[0].rotulo).toBe("Datas fora de ordem · Pagamento antes do extrato");
    const V = [linha({ emendaId: "e9", numero: 9, regra: "vigencia:a", titulo: "Vigência", motivos: [{ chave: "vigencia:encerrada", rotulo: "Vigência encerrada" }] })];
    expect(porMotivo(V, true)[0].rotulo).toBe("Vigência encerrada");
    expect(filtrarPendencias(M, { ...F, m: "publicidade_incompleta:X" }).map((l) => l.numero)).toEqual([4]);
    expect(filtrarPendencias(M, { ...F, m: "publicidade_incompleta:X" }, ["m"])).toHaveLength(5);
  });
});
