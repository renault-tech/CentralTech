import { describe, expect, it } from "vitest";

import { situacaoFases } from "@/lib/emendas/fases";
import { abertas, maiorGravidade, pendencias, type EntradaPendencias } from "@/lib/emendas/pendencias";
import type { EmendaResumo } from "@/types/emendas";

const emenda: EmendaResumo = {
  id: "e1", ano: 2026, numero: 7, numero_vereador: 1, objeto: "x", descricao: "", valor: 1000, saude: false,
  modalidade: "repasse", tipo_execucao: "osc", etapa: "indicada", situacao: "normal", etapa_atualizada_em: "", criado_em: "",
  atualizado_em: "", funcional_programatica: null, natureza_despesa: null, dotacao_texto: null, ficha: null, vereador_id: "v",
  vereador_numero: 1, vereador_nome: "V", beneficiario_id: null, beneficiario_nome: null, beneficiario_cnpj: null,
  unidade_id: "u", unidade_codigo: "1", unidade_nome: "U", secretaria_id: "s1", secretaria_nome: "Saúde", empenhado: 0,
  liquidado: 0, pago: 0, ultimo_pagamento: null, remanejada: false, impedimentos_abertos: 0,
};
const entrada = (o: Partial<EntradaPendencias> = {}): EntradaPendencias => ({
  emenda, fases: situacaoFases({ emenda, fases: [], manuais: new Map(), movimentos: [], execucao: null, exercicio: null, parecer: null }),
  execucao: null, exercicio: { prazo_exequibilidade: null }, temParecer: false, hoje: "2026-10-27", ...o,
});
const regras = (o?: Partial<EntradaPendencias>) => pendencias(entrada(o)).map((p) => p.regra);

describe("pendencias", () => {
  it("emenda parada na indicada: alta quando faltam ≤ 60 dias", () => {
    const p = pendencias(entrada({ hoje: "2026-11-10" })).find((x) => x.regra === "nao_iniciada")!;
    expect(p.gravidade).toBe("alta");
    expect(pendencias(entrada()).find((x) => x.regra === "nao_iniciada")!.gravidade).toBe("media");
    expect(pendencias(entrada({ hoje: "2026-05-01" })).find((x) => x.regra === "nao_iniciada")!.gravidade).toBe("baixa");
  });

  it("prazo de exequibilidade vencido sem parecer", () => {
    expect(regras({ exercicio: { prazo_exequibilidade: "2026-03-31" } })).toContain("exequibilidade_vencida");
    expect(regras({ exercicio: { prazo_exequibilidade: "2026-03-31" }, temParecer: true })).not.toContain("exequibilidade_vencida");
    expect(regras({ exercicio: { prazo_exequibilidade: "2026-12-31" } })).not.toContain("exequibilidade_vencida");
  });

  it("termo sem extrato e sem conta (só OSC/ente)", () => {
    const execucao = { numero_termo: "9/2026", vigencia_fim: null, data_publicacao_extrato: null, conta_bancaria: null };
    expect(regras({ execucao })).toEqual(expect.arrayContaining(["termo_sem_extrato", "sem_conta"]));
    expect(regras({ execucao, emenda: { ...emenda, tipo_execucao: "direta", modalidade: "direta" } })).not.toContain("termo_sem_extrato");
  });

  it("vigência vencida há mais de 90 dias sem prestação de contas é alta", () => {
    const execucao = { numero_termo: "9", vigencia_fim: "2026-06-01", data_publicacao_extrato: "2026-01-01", conta_bancaria: "x" };
    const p = pendencias(entrada({ execucao, emenda: { ...emenda, etapa: "paga" } })).find((x) => x.regra === "vigencia")!;
    expect(p.gravidade).toBe("alta");
    expect(p.detalhe).toContain("art. 69");
  });

  it("tipo incoerente com a natureza", () => {
    expect(regras({ emenda: { ...emenda, tipo_execucao: "direta", modalidade: "repasse" } })).toContain("tipo_incoerente");
    expect(regras({ emenda: { ...emenda, tipo_execucao: "ente", modalidade: "direta" } })).not.toContain("tipo_incoerente");
  });

  it("valores: empenho acima do valor e pago acima do empenhado", () => {
    expect(regras({ emenda: { ...emenda, etapa: "paga", empenhado: 1500, pago: 1600 } })).toEqual(
      expect.arrayContaining(["empenho_maior", "pago_maior"])
    );
  });

  it("justificativa só vale para a mesma assinatura", () => {
    const e = { ...emenda, etapa: "paga", empenhado: 500, pago: 600 };
    const [p] = pendencias(entrada({ emenda: e }));
    const j = { emenda_id: e.id, regra: p.regra, assinatura: p.assinatura, justificativa: "ok", por: null, em: "" };
    const com = pendencias(entrada({ emenda: e, justificadas: [j] }));
    expect(com.find((x) => x.regra === p.regra)?.justificativa).toBe("ok");
    expect(abertas(com).map((x) => x.regra)).not.toContain(p.regra);
    const mudou = pendencias(entrada({ emenda: { ...e, pago: 700 }, justificadas: [j] }));
    expect(mudou.find((x) => x.regra === p.regra)?.justificativa).toBeUndefined();
  });

  it("cancelada não gera pendência; maiorGravidade ignora justificadas", () => {
    expect(regras({ emenda: { ...emenda, situacao: "cancelada" } })).toEqual([]);
    expect(maiorGravidade([])).toBeNull();
  });
});

describe("objeto pouco descritivo", () => {
  it("marca objeto que só nomeia o órgão e deixa passar o descritivo", () => {
    expect(regras({ emenda: { ...emenda, objeto: "A Secretaria Municipal de Cultura e Turismo" } })).toContain("objeto_generico");
    expect(regras({ emenda: { ...emenda, objeto: "Repasse ao Hospital de Cataguases para custeio de leitos" } })).not.toContain("objeto_generico");
  });
});
