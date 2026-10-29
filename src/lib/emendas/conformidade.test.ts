import { describe, expect, it } from "vitest";

import { avaliarArt7, bancoOficial, chaveDaConta, contasRepetidas, faltas, gndDaNatureza, relatoriosDeGestao } from "@/lib/emendas/conformidade";
import type { EmendaResumo } from "@/types/emendas";

const emenda = {
  id: "e1", ano: 2026, numero: 1, objeto: "Repasse ao Hospital de Cataguases para custeio de leitos", descricao: "Repasse ao Hospital de Cataguases para custeio de leitos de UTI adulto e manutenção dos equipamentos",
  valor: 100000, saude: true, modalidade: "repasse", tipo_execucao: "osc", etapa: "paga", secretaria_nome: "Saúde", beneficiario_nome: "Hospital", beneficiario_cnpj: "00.000.000/0001-00",
  natureza_despesa: "3.3.50.43", empenhado: 100000, pago: 50000,
} as unknown as EmendaResumo;
const base = { emenda, execucao: null, partido: null, exercicio: null, documentos: [], movimentos: [] };

describe("natureza da despesa", () => {
  it("deriva GND e categoria", () => {
    expect(gndDaNatureza("3.3.90.39")).toMatchObject({ gnd: "3", categoria: "corrente" });
    expect(gndDaNatureza("4.4.90.52")).toMatchObject({ gnd: "4", categoria: "capital" });
    expect(gndDaNatureza("x")).toBeNull();
  });
});

describe("contas", () => {
  it("reconhece banco oficial e a mesma conta repetida", () => {
    expect(bancoOficial("CAIXA ECONOMICA - 0108 OP 1292 CONTA 570579526-9")).toBe(true);
    expect(bancoOficial("SICOOB 4149 CONTA 71902-1")).toBe(false);
    expect(bancoOficial("")).toBeNull();
    expect(chaveDaConta("CAIXA ECONOMICA 0108 CONTA 570579526-9")).toBe(chaveDaConta("Caixa Econômica - 0108 OP 1292 Conta 570579526-9"));
    const rep = contasRepetidas([
      { id: "a", conta_bancaria: "CAIXA ECONOMICA 0108 CONTA 570579526-9" },
      { id: "b", conta_bancaria: "CAIXA 0108 OP 1292 CONTA 570579526-9" },
      { id: "c", conta_bancaria: "BANCO DO BRASIL 0025-6 CONTA 62791-7" },
    ]);
    expect([...rep].sort()).toEqual(["a", "b"]);
  });
});

describe("art. 7º da IN 05/2025", () => {
  it("lista o que falta quando nada foi preenchido", () => {
    const codigos = faltas(avaliarArt7(base)).map((i) => i.codigo);
    for (const c of ["I", "II", "VI", "VII", "VIII", "IX", "XII", "XIII", "XIV", "XVI", "XVII", "art5"]) expect(codigos).toContain(c);
    expect(codigos).not.toContain("IV");
    expect(codigos).not.toContain("XV");
  });
  it("fica completo quando tudo está informado", () => {
    const itens = avaliarArt7({
      ...base,
      partido: "XYZ",
      exercicio: { numero_lei_loa: "5.000/2025", municipio_nome: "Cataguases", municipio_cnpj: "17.000.000/0001-00", unidade_parlamentar: "Câmara Municipal" },
      execucao: {
        localidade: "Cataguases", inicio_previsto: "2026-03-01", termino_previsto: "2026-12-31", numero_termo: "027/2026", processo_licitatorio: "2026/0062",
        plano_metas: "Atender 20 leitos", gestor_pmc: "Fulano de Tal", gestor_osc: "Beltrana", conta_bancaria: "CAIXA 0108 CONTA 1234-5", anuencia_sus: "sim", identificador_contabil: "EMD-001",
      },
      documentos: [{ tipo: "plano_trabalho", competencia: null }],
      movimentos: [{ tipo: "empenho", data: "2026-02-01" }, { tipo: "pagamento", data: "2026-03-01" }],
    });
    expect(faltas(itens)).toEqual([]);
  });
  it("saúde exige anuência e direta não exige conta", () => {
    const direta = { ...emenda, tipo_execucao: "direta", saude: false, modalidade: "direta" } as EmendaResumo;
    const itens = avaliarArt7({ ...base, emenda: direta });
    expect(itens.find((i) => i.codigo === "XVI")?.aplica).toBe(false);
    expect(itens.find((i) => i.codigo === "XVII")?.aplica).toBe(false);
  });
});

describe("relatório de gestão", () => {
  const pag = [{ tipo: "pagamento", data: "2026-03-10" }];
  it("não cobra no mesmo ano e avisa perto de 30/06", () => {
    expect(relatoriosDeGestao(pag, [], "2026-10-29")).toEqual([]);
    expect(relatoriosDeGestao(pag, [], "2027-05-15")).toMatchObject([{ competencia: 2026, situacao: "a_vencer" }]);
  });
  it("vence depois de 30/06 e some quando entregue", () => {
    expect(relatoriosDeGestao(pag, [], "2027-07-01")).toMatchObject([{ competencia: 2026, situacao: "vencido" }]);
    expect(relatoriosDeGestao(pag, [{ tipo: "relatorio_gestao", competencia: 2026 }], "2027-07-01")).toEqual([]);
  });
});
