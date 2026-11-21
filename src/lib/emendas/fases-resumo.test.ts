import { describe, expect, it } from "vitest";

import { consolidarFases, indiceDaProxima, macroDaFase, proximoPasso, type FaseLinha } from "@/lib/emendas/fases-resumo";

const f = (nome: string, estado: FaseLinha["estado"] = "pendente", alerta = false): FaseLinha => ({ nome, estado, alerta });
const base = { valor: 20000, empenhado: 0, pago: 0, situacao: "normal", impedimentos_abertos: 0 };

describe("macroDaFase", () => {
  it("agrupa as fases de cada tipo", () => {
    expect(macroDaFase("Indicada na LOA")).toBe("planejamento");
    expect(macroDaFase("Análise de viabilidade técnica")).toBe("planejamento");
    expect(macroDaFase("Processo de compra ou licitação")).toBe("formalizacao");
    expect(macroDaFase("Plano de trabalho")).toBe("formalizacao");
    expect(macroDaFase("Termo de fomento")).toBe("formalizacao");
    expect(macroDaFase("Envio para pagamento")).toBe("pagamento");
    expect(macroDaFase("Empenho")).toBe("empenho");
    expect(macroDaFase("Prestação de contas")).toBe("prestacao");
    expect(macroDaFase("Encerramento")).toBe("encerramento");
  });
});

describe("consolidarFases", () => {
  const osc = [f("Indicada na LOA", "feita"), f("Análise de viabilidade técnica", "feita"), f("Plano de trabalho", "feita"), f("Termo de fomento"), f("Empenho"), f("Pagamento"), f("Prestação de contas"), f("Encerramento")];
  it("reduz 8 fases a 6 macro-etapas em ordem fixa", () => {
    const m = consolidarFases(osc);
    expect(m.map((x) => x.nome)).toEqual(["Planejamento", "Formalização", "Empenho", "Pagamento", "Prestação de contas", "Encerramento"]);
    expect(m[0].estado).toBe("feita");
    expect(m[1].estado).toBe("andamento"); // plano feito, termo a fazer
    expect(m[1].fases).toHaveLength(2);
    expect(indiceDaProxima(m)).toBe(1);
  });
  it("só mostra as macro-etapas que o fluxo tem", () => {
    expect(consolidarFases([f("Indicada na LOA", "feita"), f("Empenho"), f("Pagamento")]).map((x) => x.chave)).toEqual(["planejamento", "empenho", "pagamento"]);
  });
  it("propaga o alerta ao grupo", () => {
    expect(consolidarFases([f("Empenho", "andamento", true)])[0].alerta).toBe(true);
  });
});

describe("proximoPasso", () => {
  const direta = consolidarFases([f("Indicada na LOA", "feita"), f("Análise de viabilidade técnica", "feita"), f("Processo de compra ou licitação", "feita"), f("Empenho", "andamento"), f("Pagamento", "andamento"), f("Encerramento")]);
  it("emenda 161: faltam centavos para empenhar", () => {
    const p = proximoPasso({ ...base, empenhado: 19999.4, pago: 73.99 }, direta);
    expect(p.titulo).toContain("Fechar o empenho");
    expect(p.titulo).toContain("0,60");
    expect(p.acao).toBe("empenho");
    expect(p.atalho?.aba).toBe("financeiro");
  });
  it("empenho completo e pago incompleto manda pagar", () => {
    const p = proximoPasso({ ...base, empenhado: 20000, pago: 5000 }, direta);
    expect(p.acao).toBe("pagamento");
    expect(p.titulo).toContain("15.000,00");
  });
  it("sem dinheiro lançado, o passo é a próxima macro-etapa", () => {
    const p = proximoPasso(base, consolidarFases([f("Indicada na LOA", "feita"), f("Análise de viabilidade técnica"), f("Empenho")]));
    expect(p.titulo).toBe("Próximo: Planejamento");
    expect(p.texto).toContain("Análise de viabilidade técnica");
    expect(p.acao).toBe("andamento");
  });
  it("formalização aponta para os documentos", () => {
    const p = proximoPasso(base, consolidarFases([f("Indicada na LOA", "feita"), f("Plano de trabalho"), f("Empenho")]));
    expect(p.atalho?.aba).toBe("documentacao");
  });
  it("impedida, cancelada e concluída", () => {
    expect(proximoPasso({ ...base, impedimentos_abertos: 1 }, direta).titulo).toBe("Emenda impedida");
    expect(proximoPasso({ ...base, situacao: "cancelada" }, direta).titulo).toBe("Emenda cancelada");
    const feitas = consolidarFases([f("Indicada na LOA", "feita"), f("Encerramento", "feita")]);
    expect(proximoPasso({ ...base, empenhado: 20000, pago: 20000 }, feitas).titulo).toBe("Todas as etapas concluídas");
  });
  it("empenho acima do valor não oferece ação de lançamento", () => {
    expect(proximoPasso({ ...base, empenhado: 20100 }, direta).acao).toBeNull();
  });
});
