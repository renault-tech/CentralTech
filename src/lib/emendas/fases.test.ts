import { describe, expect, it } from "vitest";

import { datasForaDeOrdem, faseAtual, motivoBloqueioConclusao, progresso, situacaoFases, tipoDaEmenda, type EntradaFases } from "@/lib/emendas/fases";
import type { FaseEmenda, FaseFluxo } from "@/types/emendas";

const f = (chave: string, etapa: string, ordem: number, derivacao: FaseFluxo["derivacao"] = null): FaseFluxo => ({
  tipo: "osc", chave, nome: chave, etapa, referencia: null, derivacao, ordem, ativa: true,
});
const FASES: FaseFluxo[] = [
  f("indicada", "indicada", 10, "loa"),
  f("analise", "analise", 20, "parecer"),
  f("plano", "plano_trabalho", 30),
  f("termo", "plano_trabalho", 40, "termo"),
  f("empenho", "empenhada", 50, "empenho"),
  f("repasse", "paga", 60, "pagamento"),
  f("prestacao", "prestacao_contas", 70),
];
const base = (o: Partial<EntradaFases> = {}): EntradaFases => ({
  emenda: { tipo_execucao: "osc", modalidade: "repasse", etapa: "indicada", impedimentos_abertos: 0 },
  fases: FASES,
  manuais: new Map(),
  movimentos: [],
  execucao: null,
  exercicio: { data_aprovacao_loa: "2025-12-20" },
  parecer: null,
  ...o,
});
const por = (r: ReturnType<typeof situacaoFases>, k: string) => r.find((x) => x.fase.chave === k)!;
const manual = (chave: string, situacao: FaseEmenda["situacao"], data: string | null = null): FaseEmenda => ({
  emenda_id: "e", chave, situacao, data, documento: null, observacao: null, origem: null, atualizado_por: null, atualizado_em: "",
});

describe("situacaoFases", () => {
  it("indicada vem da LOA do exercício; o resto fica pendente", () => {
    const r = situacaoFases(base());
    expect(por(r, "indicada")).toMatchObject({ situacao: "concluida", origem: "derivada", data: "2025-12-20" });
    expect(por(r, "plano").situacao).toBe("pendente");
    expect(faseAtual(r)?.fase.chave).toBe("analise");
  });

  it("parecer da secretaria conclui a análise; impedimento aberto deixa em andamento", () => {
    expect(por(situacaoFases(base({ parecer: { data: "2026-02-01" } })), "analise")).toMatchObject({ situacao: "concluida", data: "2026-02-01" });
    expect(por(situacaoFases(base({ emenda: { ...base().emenda, impedimentos_abertos: 1 } })), "analise").situacao).toBe("em_andamento");
  });

  it("empenho e pagamento vêm dos movimentos; termo vem da execução", () => {
    const r = situacaoFases(
      base({
        movimentos: [{ tipo: "empenho", data: "2026-03-10" }, { tipo: "empenho", data: "2026-03-01" }, { tipo: "pagamento", data: null }],
        execucao: { numero_termo: "12/2026", vigencia_inicio: "2026-03-05", data_publicacao_extrato: null },
      })
    );
    expect(por(r, "empenho")).toMatchObject({ situacao: "concluida", origem: "derivada", data: "2026-03-01" });
    expect(por(r, "repasse")).toMatchObject({ situacao: "concluida", data: null });
    expect(por(r, "termo")).toMatchObject({ situacao: "concluida", data: "2026-03-05" });
  });

  it("sem movimentos, a etapa atual 'paga' presume empenho e repasse (sem regredir a emenda)", () => {
    const r = situacaoFases(base({ emenda: { ...base().emenda, etapa: "paga" } }));
    expect(por(r, "empenho")).toMatchObject({ situacao: "concluida", origem: "presumida" });
    expect(por(r, "repasse")).toMatchObject({ situacao: "concluida", origem: "presumida" });
    expect(por(r, "plano")).toMatchObject({ situacao: "concluida", origem: "presumida" });
    expect(por(r, "prestacao").situacao).toBe("pendente");
  });

  it("fase manual vale; fase manual da mesma etapa atual não é presumida", () => {
    const emenda = { ...base().emenda, etapa: "plano_trabalho" };
    const r = situacaoFases(base({ emenda, manuais: new Map([["plano", manual("plano", "concluida", "2026-04-01")]]) }));
    expect(por(r, "plano")).toMatchObject({ situacao: "concluida", origem: "manual", data: "2026-04-01" });
    expect(por(r, "termo").situacao).toBe("pendente");
  });

  it("não se aplica sai do total do progresso", () => {
    const r = situacaoFases(base({ manuais: new Map([["prestacao", manual("prestacao", "nao_se_aplica")]]) }));
    expect(progresso(r)).toEqual({ concluidas: 1, total: 6 });
  });
});

describe("datasForaDeOrdem", () => {
  it("aponta a fase cuja data é anterior à da fase que a precede", () => {
    const r = situacaoFases(
      base({
        exercicio: { data_aprovacao_loa: "2025-12-20" },
        manuais: new Map([["plano", manual("plano", "concluida", "2026-05-10")]]),
        movimentos: [{ tipo: "empenho", data: "2026-04-01" }],
      })
    );
    const fora = datasForaDeOrdem(r);
    expect(fora).toHaveLength(1);
    expect(fora[0][1].fase.chave).toBe("empenho");
  });
});

describe("tipoDaEmenda", () => {
  it("usa o tipo gravado; sem tipo, deduz pela modalidade", () => {
    expect(tipoDaEmenda({ tipo_execucao: "ente", modalidade: "direta" })).toBe("ente");
    expect(tipoDaEmenda({ tipo_execucao: null, modalidade: "direta" })).toBe("direta");
    expect(tipoDaEmenda({ tipo_execucao: null, modalidade: "repasse" })).toBe("osc");
  });
});

describe("fases financeiras só fecham com o total", () => {
  const com = (movimentos: EntradaFases["movimentos"]) => situacaoFases(base({ valorEmenda: 1000, movimentos }));
  it("empenho parcial fica em andamento; o total conclui", () => {
    expect(por(com([{ tipo: "empenho", data: "2026-03-01", valor: 400 }]), "empenho")).toMatchObject({ situacao: "em_andamento", origem: "derivada" });
    expect(por(com([{ tipo: "empenho", data: "2026-03-01", valor: 400 }, { tipo: "empenho", data: "2026-03-05", valor: 600 }]), "empenho").situacao).toBe("concluida");
  });
  it("anulação desconta do empenhado", () => {
    const r = com([{ tipo: "empenho", data: "2026-03-01", valor: 1000 }, { tipo: "anulacao", data: "2026-04-01", valor: 1000 }]);
    expect(por(r, "empenho").situacao).toBe("pendente");
  });
  it("pagamento só conclui quando cobre o valor disponível da emenda", () => {
    const e = { tipo: "empenho", data: "2026-03-01", valor: 1000 };
    const parcial = por(com([e, { tipo: "pagamento", data: "2026-05-01", valor: 300 }]), "repasse");
    expect(parcial).toMatchObject({ situacao: "em_andamento", parcial: true });
    expect(parcial.resumo).toContain("Saldo a pagar");
    expect(por(com([e, { tipo: "pagamento", data: "2026-05-01", valor: 1000 }]), "repasse").situacao).toBe("concluida");
  });
  it("empenho parcial e pagamento parcial: as duas fases ficam parciais", () => {
    const r = com([{ tipo: "empenho", data: "2026-03-01", valor: 400 }, { tipo: "pagamento", data: "2026-05-01", valor: 400 }]);
    expect(por(r, "empenho")).toMatchObject({ situacao: "em_andamento", parcial: true });
    expect(por(r, "repasse")).toMatchObject({ situacao: "em_andamento", parcial: true });
  });
  it("excluir o lançamento devolve a fase", () => {
    expect(por(com([]), "empenho").situacao).toBe("pendente");
  });
});

describe("fase única do processo de compra segue o Compras", () => {
  const fases: FaseFluxo[] = [{ tipo: "direta", chave: "processo", nome: "processo", etapa: "processo_compra", referencia: null, derivacao: null, ordem: 30, ativa: true }];
  const calc = (compras: EntradaFases["compras"]) =>
    situacaoFases(base({ emenda: { tipo_execucao: "direta", modalidade: "direta", etapa: "indicada", impedimentos_abertos: 0 }, fases, compras }));
  const proc = { numero: "2026/0062", numero_licitacao: null, status: "em_andamento", criado_em: "2026-03-02T10:00:00Z", contratos: 0, contrato_numero: null };
  it("vincular o processo marca como iniciado", () => {
    expect(por(calc(proc), "processo")).toMatchObject({ situacao: "em_andamento", origem: "derivada" });
    expect(por(calc({ ...proc, numero_licitacao: "136/2026" }), "processo").observacao).toContain("136/2026");
  });
  it("homologado ou com contrato marca como concluído", () => {
    expect(por(calc({ ...proc, status: "concluido" }), "processo")).toMatchObject({ situacao: "concluida", documento: "2026/0062" });
    expect(por(calc({ ...proc, contratos: 1, contrato_numero: "55/2026" }), "processo").situacao).toBe("concluida");
  });
  it("sem vínculo nada é derivado", () => {
    expect(por(calc(null), "processo").situacao).toBe("pendente");
  });
});

describe("conclusão só com todas as outras fases completas", () => {
  const fase = (chave: string, etapa: string): FaseFluxo => ({ tipo: "osc", chave, nome: chave, etapa, referencia: null, derivacao: null, ordem: 10, ativa: true });
  const calc = (manuais: Map<string, FaseEmenda>) =>
    situacaoFases(base({ fases: [fase("plano", "plano_trabalho"), fase("conclusao", "concluida")], manuais }));
  it("bloqueia enquanto houver fase pendente, parcial ou em andamento", () => {
    expect(motivoBloqueioConclusao(calc(new Map()))).toContain("Faltam: plano");
    expect(motivoBloqueioConclusao(calc(new Map([["plano", manual("plano", "em_andamento")]])))).not.toBeNull();
  });
  it("libera com tudo concluído ou não aplicável", () => {
    expect(motivoBloqueioConclusao(calc(new Map([["plano", manual("plano", "concluida", "2026-03-01")]])))).toBeNull();
    expect(motivoBloqueioConclusao(calc(new Map([["plano", manual("plano", "nao_se_aplica")]])))).toBeNull();
  });
});
