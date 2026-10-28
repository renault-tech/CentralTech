import { describe, expect, it } from "vitest";

import { gerarPropostas, lerJsonV1, type EstadoAtualEmenda } from "@/lib/emendas/importacao/json-v1";
import type { FaseFluxo } from "@/types/emendas";

const fase = (chave: string, derivacao: FaseFluxo["derivacao"] = null): FaseFluxo => ({
  tipo: "osc", chave, nome: chave, etapa: "plano_trabalho", referencia: null, derivacao, ordem: 1, ativa: true,
});
const vazio = (): EstadoAtualEmenda => ({
  execucao: null, fases: new Map(), checklist: new Map(), catalogo: [fase("plano"), fase("termo", "termo")], itensChecklist: new Set(["estatuto"]),
});

describe("lerJsonV1", () => {
  it("recusa JSON inválido e formato desconhecido", () => {
    expect(lerJsonV1("{").erro).toMatch(/JSON/);
    expect(lerJsonV1('{"formato":"x"}').erro).toMatch(/Formato/);
    expect(lerJsonV1('{"formato":"centraltech.emendas.execucao/v1","ano":2026,"emendas":[{"numero":1}]}').arquivo?.emendas).toHaveLength(1);
  });
});

describe("gerarPropostas", () => {
  it("campo preenchido no arquivo e vazio no sistema vira proposta; vazio no arquivo é ignorado", () => {
    const p = gerarPropostas({ numero: 1, instrumento: { termo: "12/2026", conta_bancaria: "", vigencia_fim: "data-ruim" } }, vazio());
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ alvo: "execucao", campo: "numero_termo", valorAtual: null, valorProposto: "12/2026" });
  });

  it("valor igual ao atual não gera proposta; diferente guarda o atual", () => {
    const atual = { ...vazio(), execucao: { numero_termo: "12/2026", conta_bancaria: "1-2" } };
    const p = gerarPropostas({ numero: 1, instrumento: { termo: "12/2026", conta_bancaria: "9-9" } }, atual);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ campo: "conta_bancaria", valorAtual: "1-2", valorProposto: "9-9" });
  });

  it("fase derivada é ignorada; fase manual vira proposta e não regride concluída", () => {
    const e = { numero: 1, andamentos: [
      { fase: "termo", status: "concluida", data: "2026-03-01" },
      { fase: "plano", status: "concluida", data: "2026-02-01", documento: "P-1" },
    ] };
    const p = gerarPropostas(e, vazio());
    expect(p.map((x) => x.chave)).toEqual(["plano"]);
    const atual = vazio();
    atual.fases.set("plano", { emenda_id: "e", chave: "plano", situacao: "concluida", data: "2026-01-01", documento: null, observacao: null, origem: null, atualizado_por: null, atualizado_em: "" });
    expect(gerarPropostas({ numero: 1, andamentos: [{ fase: "plano", status: "pendente" }] }, atual)).toHaveLength(0);
  });

  it("checklist: item desconhecido e 'pendente' são ignorados", () => {
    const p = gerarPropostas({ numero: 1, checklist: [{ item: "estatuto", status: "conferido" }, { item: "x", status: "conferido" }, { item: "estatuto", status: "pendente" }] }, vazio());
    expect(p).toHaveLength(1);
    expect(p[0].valorProposto).toEqual({ estado: "conferido" });
  });
});
