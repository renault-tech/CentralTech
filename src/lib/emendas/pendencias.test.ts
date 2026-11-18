import { describe, expect, it } from "vitest";

import { situacaoConciliacao } from "@/lib/emendas/conciliacao";
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

  it("fase da LOA concluída não conta como andamento da emenda", () => {
    const loa = { fase: { chave: "loa", nome: "LOA", derivacao: "loa", etapa: "indicada" }, situacao: "concluida", origem: "derivada", data: "2025-12-23", documento: null, observacao: null, resumo: "", alertas: [] };
    const fases = [loa] as unknown as EntradaPendencias["fases"];
    expect(regras({ fases })).toContain("nao_iniciada");
  });

  it("empenho parcial já é andamento: some o aviso de 'sem andamento'", () => {
    const movs = [{ emenda_id: "e1", tipo: "empenho", numero: "10", data: "2026-05-01" }];
    expect(regras({ movimentos: movs, emenda: { ...emenda, empenhado: 300 } })).not.toContain("nao_iniciada");
    expect(regras()).toContain("nao_iniciada");
  });

  it("termo ou processo de compra já cadastrado também é andamento", () => {
    const base = { numero_termo: null, vigencia_fim: null, data_publicacao_extrato: null, conta_bancaria: null };
    expect(regras({ execucao: { ...base, processo_licitatorio: "122/2026" } })).not.toContain("nao_iniciada");
    expect(regras({ execucao: { ...base, processo_id: "abc" } })).not.toContain("nao_iniciada");
    expect(regras({ execucao: { ...base, numero_termo: "174/2026" } })).not.toContain("nao_iniciada");
    expect(regras({ execucao: { ...base, processo_licitatorio: "  " } })).toContain("nao_iniciada");
  });

  it("etapa 'análise' sozinha não é andamento; plano/processo/termo/empenho são", () => {
    expect(regras({ emenda: { ...emenda, etapa: "analise" } })).toContain("nao_iniciada");
    expect(regras({ emenda: { ...emenda, etapa: "plano_trabalho" } })).not.toContain("nao_iniciada");
    expect(regras({ emenda: { ...emenda, etapa: "processo_compra" } })).not.toContain("nao_iniciada");
  });

  it("objeto só com o nome do órgão não é pendência se a descrição traz a finalidade", () => {
    const base = { ...emenda, objeto: "A Casa da Criança" };
    expect(regras({ emenda: base })).toContain("objeto_generico");
    const d = "Reforço da dotação orçamentária para a Casa da Criança, cujo intuito será a aquisição de brinquedos, conforme demanda.";
    expect(regras({ emenda: { ...base, descricao: d } })).not.toContain("objeto_generico");
  });

  it("conciliação com o IPM: saldo não executado, anulação do saldo do empenho e excesso sem fonte", () => {
    const paga = { ...emenda, valor: 1000, empenhado: 987.63, pago: 987.63, etapa: "paga" as const };
    const sit = situacaoConciliacao(paga, null);
    expect(regras({ emenda: paga, conciliacao: sit })).toContain("saldo_nao_executado");
    const reg = situacaoConciliacao(paga, { saldo_registrado_em: "2026-11-18", saldo_valor: 12.37, anulacao_solicitada_em: null, excesso_fonte: null });
    expect(regras({ emenda: paga, conciliacao: reg })).not.toContain("saldo_nao_executado");
    const encerrada = { ...emenda, valor: 1000, empenhado: 1000, pago: 900, etapa: "concluida" as const };
    expect(regras({ emenda: encerrada, conciliacao: situacaoConciliacao(encerrada, null) })).toContain("anular_saldo_empenho");
    const excesso = { ...emenda, valor: 1000, empenhado: 1020, pago: 1020, etapa: "paga" as const };
    expect(regras({ emenda: excesso, conciliacao: situacaoConciliacao(excesso, null) })).toContain("excesso_sem_fonte");
    const comFonte = situacaoConciliacao(excesso, { saldo_registrado_em: null, saldo_valor: null, anulacao_solicitada_em: null, excesso_fonte: "Recursos próprios" });
    const r = regras({ emenda: excesso, conciliacao: comFonte });
    expect(r).not.toContain("excesso_sem_fonte");
    expect(r).not.toContain("empenho_maior");
  });

  it("prazo de exequibilidade vencido sem parecer", () => {
    expect(regras({ exercicio: { prazo_exequibilidade: "2026-03-31" } })).toContain("exequibilidade_vencida");
    expect(regras({ exercicio: { prazo_exequibilidade: "2026-03-31" }, temParecer: true })).not.toContain("exequibilidade_vencida");
    expect(regras({ exercicio: { prazo_exequibilidade: "2026-12-31" } })).not.toContain("exequibilidade_vencida");
  });

  it("convênio sem publicação: mesmo alerta, sem citar a Lei 13.019; vigência encerrada não cobra prestação em 90 dias", () => {
    const ente = { ...emenda, tipo_execucao: "ente" as const };
    const execucao = { numero_termo: "9/2026", vigencia_fim: "2026-01-10", data_publicacao_extrato: null, conta_bancaria: null, instrumento: "convenio" as const };
    const ps = pendencias(entrada({ execucao, emenda: ente }));
    const ext = ps.find((p) => p.regra === "termo_sem_extrato")!;
    expect(ext.titulo).toMatch(/Convênio/);
    expect(ext.detalhe).not.toMatch(/13\.019/);
    expect(ext.base).toMatch(/IN TCE-MG 05\/2025/);
    expect(ps.find((p) => p.regra === "sem_conta")!.detalhe).not.toMatch(/13\.019/);
    const vig = ps.find((p) => p.regra === "vigencia")!;
    expect(vig.detalhe).not.toMatch(/art\. 69/);
    expect(vig.gravidade).toBe("media");
    expect(vig.base).toMatch(/11\.107/);
    const termo = pendencias(entrada({ execucao: { ...execucao, instrumento: "termo_fomento" }, emenda: ente }));
    expect(termo.find((p) => p.regra === "termo_sem_extrato")!.detalhe).toMatch(/13\.019/);
    expect(termo.find((p) => p.regra === "vigencia")!.detalhe).toMatch(/art\. 69/);
  });

  it("categoria do beneficiário × instrumento: consórcio com termo de fomento é sinalizado, convênio não", () => {
    const consorcio = { ...emenda, tipo_execucao: "ente" as const, beneficiario_categoria: "consorcio" as const };
    const exec = (instrumento: "termo_fomento" | "convenio") => ({ numero_termo: null, vigencia_fim: null, data_publicacao_extrato: null, conta_bancaria: null, instrumento });
    const ps = pendencias(entrada({ emenda: consorcio, execucao: exec("termo_fomento") }));
    const p = ps.find((x) => x.regra === "instrumento_incompativel")!;
    expect(p.gravidade).toBe("media");
    expect(p.detalhe).toMatch(/não é organização da sociedade civil/);
    expect(p.base).toMatch(/13\.019/);
    expect(regras({ emenda: consorcio, execucao: exec("convenio") })).not.toContain("instrumento_incompativel");
    // sem execução gravada vale o padrão (termo de fomento) e o alerta aparece
    expect(regras({ emenda: consorcio })).toContain("instrumento_incompativel");
    // OSC com termo de fomento e execução direta não disparam
    expect(regras({ emenda: { ...emenda, beneficiario_categoria: "osc" } })).not.toContain("instrumento_incompativel");
    expect(regras({ emenda: { ...consorcio, tipo_execucao: "direta", modalidade: "direta" } })).not.toContain("instrumento_incompativel");
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

describe("pendências financeiras novas", () => {
  const mov = (tipo: string, data: string | null, numero: string | null = "1") => ({ emenda_id: "e1", tipo, numero, data });
  it("lançamentos sem data viram um assunto cada", () => {
    const r = regras({ movimentos: [mov("empenho", null), mov("pagamento", null), mov("liquidacao", "2026-05-01")] });
    expect(r).toEqual(expect.arrayContaining(["empenho_sem_data", "pagamento_sem_data"]));
    expect(r).not.toContain("liquidacao_sem_data");
  });
  it("pago sem empenho e paga sem pagamento", () => {
    expect(regras({ emenda: { ...emenda, pago: 10, empenhado: 0 } })).toContain("pago_sem_empenho");
    expect(regras({ emenda: { ...emenda, etapa: "paga" } })).toContain("paga_sem_pagamento");
    expect(regras({ emenda: { ...emenda, etapa: "paga", pago: 5, empenhado: 5 } })).not.toContain("paga_sem_pagamento");
  });
});
