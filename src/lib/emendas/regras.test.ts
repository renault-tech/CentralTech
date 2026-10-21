import { describe, expect, it } from "vitest";

import {
  alertas,
  brlCurto,
  cumpreSaude,
  curvaPagamentos,
  diasAteFimDoAno,
  indicadores,
  modalidadePorNatureza,
  porVereador,
  proximasEtapas,
  trilha,
  valorPorGrupo,
} from "@/lib/emendas/regras";
import type { EmendaResumo } from "@/types/emendas";

function emenda(p: Partial<EmendaResumo>): EmendaResumo {
  return {
    id: p.id ?? `id-${p.numero ?? 1}`,
    ano: 2026,
    numero: 1,
    numero_vereador: 1,
    objeto: "x",
    descricao: "x",
    valor: 1000,
    saude: false,
    modalidade: "direta",
    etapa: "indicada",
    situacao: "normal",
    etapa_atualizada_em: "2026-10-01T00:00:00Z",
    criado_em: "2026-01-01T00:00:00Z",
    atualizado_em: "2026-01-01T00:00:00Z",
    funcional_programatica: null,
    natureza_despesa: null,
    dotacao_texto: null,
    ficha: null,
    vereador_id: "v1",
    vereador_numero: 1,
    vereador_nome: "A",
    beneficiario_id: null,
    beneficiario_nome: null,
    beneficiario_cnpj: null,
    unidade_id: "u1",
    unidade_codigo: "02.08",
    unidade_nome: "Saúde",
    secretaria_id: "s1",
    secretaria_nome: "Saúde",
    empenhado: 0,
    liquidado: 0,
    pago: 0,
    ultimo_pagamento: null,
    remanejada: false,
    impedimentos_abertos: 0,
    ...p,
  };
}

describe("modalidade e trilha", () => {
  it("lê a modalidade do 3º grupo da natureza (mesma regra do banco)", () => {
    expect(modalidadePorNatureza("3.3.50.43")).toBe("repasse");
    expect(modalidadePorNatureza("4.4.50.42")).toBe("repasse");
    expect(modalidadePorNatureza("3.3.90.30")).toBe("direta");
    expect(modalidadePorNatureza("3.3.93.39")).toBe("direta");
    expect(modalidadePorNatureza(null)).toBeNull();
  });

  it("repasse tem plano de trabalho e prestação de contas; direta tem processo de compra", () => {
    expect(trilha("repasse")).toContain("prestacao_contas");
    expect(trilha("repasse")).not.toContain("processo_compra");
    expect(trilha("direta")).toContain("processo_compra");
    expect(trilha("direta")).not.toContain("plano_trabalho");
    expect(proximasEtapas("direta", "paga")).toEqual(["concluida"]);
  });
});

describe("indicadores e agregações", () => {
  const rs = [
    emenda({ numero: 1, valor: 200, saude: true, etapa: "paga", pago: 200, empenhado: 200 }),
    emenda({ numero: 2, valor: 100, etapa: "empenhada", empenhado: 100 }),
    emenda({ numero: 3, valor: 50, remanejada: true }),
  ];

  it("soma total, empenhado, pago e Saúde", () => {
    expect(indicadores(rs)).toMatchObject({
      total: 350,
      empenhado: 300,
      pago: 200,
      aExecutar: 150,
      saude: 200,
      quantidadePagas: 1,
      remanejadas: 1,
    });
  });

  it("agrupa valor por grupo de execução", () => {
    expect(valorPorGrupo(rs)).toEqual([50, 0, 100, 200]);
  });

  it("monta uma linha por vereador, ordenada pelo número", () => {
    const linhas = porVereador(rs, [
      { id: "v2", numero: 2, nome: "B" },
      { id: "v1", numero: 1, nome: "A" },
    ]);
    expect(linhas.map((l) => l.numero)).toEqual([1, 2]);
    expect(linhas[0]).toMatchObject({ total: 350, pago: 200, saude: 200 });
    expect(linhas[1].total).toBe(0);
  });

  it("regra dos 50% na Saúde é sobre a cota", () => {
    expect(cumpreSaude(171916.34, 343832.67, 50)).toBe(true);
    expect(cumpreSaude(171000, 343832.67, 50)).toBe(false);
  });
});

describe("curva de pagamentos", () => {
  it("acumula mês a mês e separa os sem data", () => {
    const { acumulado, semData } = curvaPagamentos(
      [
        { data: "2026-03-26", valor: 100 },
        { data: "2026-03-01", valor: 50 },
        { data: "2026-07-10", valor: 10 },
        { data: null, valor: 5 },
        { data: "2025-12-01", valor: 999 },
      ],
      2026
    );
    expect(acumulado[1]).toBe(0);
    expect(acumulado[2]).toBe(150);
    expect(acumulado[6]).toBe(160);
    expect(acumulado[11]).toBe(160);
    expect(semData).toBe(5);
  });
});

describe("alertas", () => {
  it("aponta sem andamento, empenho repetido e pagas sem data", () => {
    const rs = [
      emenda({ id: "a", numero: 1, etapa: "indicada" }),
      emenda({ id: "b", numero: 2, etapa: "paga" }),
      emenda({ id: "c", numero: 3, etapa: "paga" }),
    ];
    const movs = [
      { emenda_id: "b", tipo: "empenho", numero: "6366", data: null },
      { emenda_id: "c", tipo: "empenho", numero: "6366", data: null },
      { emenda_id: "b", tipo: "pagamento", numero: null, data: null },
      { emenda_id: "c", tipo: "pagamento", numero: null, data: "2026-08-05" },
    ];
    const lista = alertas(rs, movs, { hoje: new Date(2026, 9, 20), ano: 2026, diasParado: 30 });
    const por = Object.fromEntries(lista.map((a) => [a.chave, a]));
    expect(por.sem_andamento.numeros).toEqual([1]);
    expect(por.sem_andamento.detalhe).toContain("Faltam 72 dias");
    expect(por.empenho_repetido.quantidade).toBe(1);
    expect(por.sem_data_pagamento.numeros).toEqual([2]);
    expect(por.sem_empenho.quantidade).toBe(0);
  });

  it("conta os dias até 31/12", () => {
    expect(diasAteFimDoAno(new Date(2026, 11, 31), 2026)).toBe(0);
    expect(diasAteFimDoAno(new Date(2027, 0, 5), 2026)).toBe(0);
  });
});

describe("formatação", () => {
  it("abrevia milhões e milhares", () => {
    expect(brlCurto(5157490.05)).toBe("R$ 5,16 mi");
    expect(brlCurto(425000)).toBe("R$ 425 mil");
  });
});
