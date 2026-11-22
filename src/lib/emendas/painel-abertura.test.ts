import { describe, expect, it } from "vitest";

import { diasEntre, montarPainel, quandoFoi, type EntradaPainel } from "./painel-abertura";

const em = (id: string, numero: number, valor: number, empenhado: number, pago: number, extra: Record<string, unknown> = {}) =>
  ({ id, numero, valor, empenhado, pago, saude: false, situacao: "normal", remanejada: false, modalidade: "repasse", tipo_execucao: "osc", vereador_id: "v1", secretaria_nome: "Saúde", etapa: "indicada", ...extra }) as never;

const base = (over: Partial<EntradaPainel> = {}): EntradaPainel => ({
  ano: 2026,
  hoje: "2026-11-22",
  emendas: [],
  resumos: {},
  movimentos: [],
  vereadores: [{ id: "v1", numero: 1, nome: "Fulana" }],
  cotaPorVereador: 100,
  saudeMinimoPct: 50,
  prazoExequibilidade: null,
  execucoes: [],
  contagens: { propostasPendentes: 0, executadasIncompletas: 0, relatoriosGestao: 0, semSituacao: 0, paradas: 0 },
  portalPublicado: null,
  gestor: true,
  ...over,
});

describe("painel de abertura", () => {
  it("parte o total em pago, empenhado a pagar e sem empenhar, e ignora canceladas", () => {
    const p = montarPainel(base({ emendas: [em("a", 1, 100, 80, 50), em("b", 2, 200, 0, 0), em("c", 3, 999, 0, 0, { situacao: "cancelada" })] }));
    expect(p.quantidade).toBe(2);
    expect(p.total).toBe(300);
    expect(p.pago).toBe(50);
    expect(p.aPagar).toBe(30);
    expect(p.semEmpenhar).toBe(20 + 200);
    expect(p.pago + p.aPagar + p.semEmpenhar).toBe(p.total);
  });

  it("classifica a situação financeira como o filtro da lista", () => {
    const p = montarPainel(base({ emendas: [em("a", 1, 100, 100, 100), em("b", 2, 100, 100, 40), em("c", 3, 100, 60, 0), em("d", 4, 100, 0, 0)] }));
    expect(p.situacoes.map((s) => s.quantidade)).toEqual([1, 1, 1, 1]);
  });

  it("monta a lista de atenção só com o que tem quantidade, mais grave primeiro", () => {
    const p = montarPainel(
      base({ emendas: [em("a", 1, 100, 0, 0)], resumos: { a: { gravidade: "alta", abertas: 2 } as never }, contagens: { propostasPendentes: 3, executadasIncompletas: 0, relatoriosGestao: 0, semSituacao: 0, paradas: 0 } })
    );
    expect(p.atencao.map((a) => a.chave)).toEqual(["altas", "propostas"]);
    expect(p.atencao[0].href).toContain("g=alta");
  });

  it("só mostra o portal quando ele não está publicado", () => {
    expect(montarPainel(base({ portalPublicado: false })).atencao.map((a) => a.chave)).toContain("portal");
    expect(montarPainel(base({ portalPublicado: true })).atencao.map((a) => a.chave)).not.toContain("portal");
    expect(montarPainel(base({ portalPublicado: null })).atencao.map((a) => a.chave)).not.toContain("portal");
  });

  it("calcula o ritmo necessário para fechar o ano", () => {
    const p = montarPainel(
      base({
        emendas: [em("a", 1, 1000, 1000, 300)],
        movimentos: [{ emenda_id: "a", tipo: "pagamento", data: "2026-11-10", valor: 80 }, { emenda_id: "a", tipo: "pagamento", data: "2026-03-10", valor: 220 }],
      })
    );
    expect(p.curva.fracaoHoje).toBeCloseTo(0.3);
    expect(p.curva.semanasRestantes).toBeCloseTo(39 / 7, 5);
    expect(p.curva.necessarioSemanal).toBeCloseTo(700 / (39 / 7), 5);
    expect(p.curva.mediaSemanal).toBeCloseTo(80 / 8);
    expect(p.curva.pontos).toHaveLength(11);
    expect(p.curva.pontos[10].fracao).toBeCloseTo(0.3);
    expect(p.curva.projecaoFim).toBeCloseTo((300 + 10 * (39 / 7)) / 1000);
  });

  it("não projeta o ano que já acabou", () => {
    const p = montarPainel(base({ ano: 2025, emendas: [em("a", 1, 100, 100, 100)] }));
    expect(p.curva.necessarioSemanal).toBeNull();
    expect(p.curva.projecaoFim).toBeNull();
    expect(p.curva.pontos).toHaveLength(12);
  });

  it("conta a emenda na primeira macro-etapa ainda não concluída e aponta o gargalo", () => {
    const fases = (...estados: ("feita" | "pendente")[]) => ({ fases: estados.map((estado, i) => ({ nome: ["Análise técnica", "Termo de parceria", "Empenho", "Pagamento"][i], estado, alerta: false })) });
    const p = montarPainel(
      base({
        emendas: [em("a", 1, 10, 0, 0), em("b", 2, 10, 0, 0), em("c", 3, 10, 0, 0)],
        resumos: { a: fases("feita", "pendente", "pendente", "pendente") as never, b: fases("feita", "pendente", "pendente", "pendente") as never, c: fases("feita", "feita", "feita", "pendente") as never },
      })
    );
    expect(p.funil.find((f) => f.chave === "formalizacao")!.quantidade).toBe(2);
    expect(p.funil.find((f) => f.chave === "pagamento")!.quantidade).toBe(1);
    expect(p.gargalo).toEqual({ nome: "Formalização", quantidade: 2 });
  });

  it("marca o vereador abaixo do mínimo de Saúde", () => {
    const p = montarPainel(base({ emendas: [em("a", 1, 100, 0, 0, { saude: true }), em("b", 2, 100, 0, 0, { vereador_id: "v2" })], vereadores: [{ id: "v1", numero: 1, nome: "A" }, { id: "v2", numero: 2, nome: "B" }], cotaPorVereador: 100 }));
    expect(p.vereadores.find((v) => v.id === "v1")!.saudeOk).toBe(true);
    expect(p.vereadores.find((v) => v.id === "v2")!.saudeOk).toBe(false);
    expect(p.saude.fracao).toBeCloseTo(0.5);
    expect(p.saude.ok).toBe(true);
  });

  it("lista a atividade mais recente primeiro e os prazos em ordem, com o fim do exercício", () => {
    const p = montarPainel(
      base({
        emendas: [em("a", 7, 100, 100, 100)],
        movimentos: [
          { emenda_id: "a", tipo: "empenho", data: "2026-11-01", valor: 100 },
          { emenda_id: "a", tipo: "pagamento", data: "2026-11-21", valor: 100 },
          { emenda_id: "a", tipo: "pagamento", data: "2026-12-30", valor: 5 },
        ],
        execucoes: [{ emenda_id: "a", vigencia_fim: "2026-11-26" }, { emenda_id: "a", vigencia_fim: "2027-05-01" }],
      })
    );
    expect(p.atividade.map((x) => x.tipo)).toEqual(["pagamento", "empenho"]);
    expect(p.atividade[0].quando).toBe("ontem");
    expect(p.prazos.map((x) => x.dias)).toEqual([4, 39]);
    expect(p.prazos[0].titulo).toBe("Vigência do termo termina");
  });

  it("dias entre datas e rótulo de quando", () => {
    expect(diasEntre("2026-11-22", "2026-12-31")).toBe(39);
    expect(diasEntre("2026-11-22", "2026-11-18")).toBe(-4);
    expect(quandoFoi("2026-11-22", "2026-11-22")).toBe("hoje");
    expect(quandoFoi("2026-11-22", "2026-11-15")).toBe("há 7 dias");
    expect(quandoFoi("2026-11-22", "2026-09-01")).toBe("há 2 meses");
  });
});
