import { describe, expect, it } from "vitest";

import {
  CATALOGO_PADRAO,
  alertas,
  brlCurto,
  cumpreSaude,
  curvaPagamentos,
  diasAteFimDoAno,
  etapasEmOrdem,
  indicadores,
  modalidadePorNatureza,
  porVereador,
  posicaoNaTrilha,
  proximasEtapas,
  situacaoVigencia,
  trilha,
  validarFluxo,
  valorPorGrupo,
} from "@/lib/emendas/regras";
import type { CatalogoEtapas } from "@/lib/emendas/regras";
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
    tipo_execucao: null,
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

describe("fluxo de fases editável", () => {
  const cat: CatalogoEtapas = {
    etapas: {
      ...CATALOGO_PADRAO.etapas,
      vistoria: { chave: "vistoria", nome: "Vistoria", cor: "#BBAAEE", grupo: 1 },
    },
    fluxos: {
      repasse: [
        { chave: "indicada", ativa: true },
        { chave: "analise", ativa: true },
        { chave: "vistoria", ativa: true },
        { chave: "plano_trabalho", ativa: false },
        { chave: "empenhada", ativa: true },
        { chave: "liquidada", ativa: true },
        { chave: "paga", ativa: true },
        { chave: "prestacao_contas", ativa: true },
        { chave: "concluida", ativa: true },
      ],
      direta: CATALOGO_PADRAO.fluxos.direta,
    },
  };

  it("a trilha só tem fases ativas, na ordem do fluxo", () => {
    expect(trilha("repasse", cat)).toEqual(["indicada", "analise", "vistoria", "empenhada", "liquidada", "paga", "prestacao_contas", "concluida"]);
    expect(trilha("direta", cat)).toEqual(trilha("direta"));
  });

  it("fase desativada com emenda nela usa a posição da última fase ativa antes", () => {
    expect(posicaoNaTrilha("repasse", "vistoria", cat)).toBe(2);
    expect(posicaoNaTrilha("repasse", "plano_trabalho", cat)).toBe(2);
    expect(posicaoNaTrilha("repasse", "paga", cat)).toBe(5);
  });

  it("as próximas fases saltam as desativadas", () => {
    expect(proximasEtapas("repasse", "analise", cat)).toEqual(["vistoria", "empenhada", "liquidada", "paga", "prestacao_contas", "concluida"]);
    expect(proximasEtapas("repasse", "plano_trabalho", cat)).toEqual(["empenhada", "liquidada", "paga", "prestacao_contas", "concluida"]);
  });

  it("une os dois fluxos numa lista só e esconde desativadas sem uso", () => {
    const chaves = etapasEmOrdem(cat).map((e) => e.chave);
    expect(chaves.indexOf("analise")).toBeLessThan(chaves.indexOf("vistoria"));
    expect(chaves.indexOf("analise")).toBeLessThan(chaves.indexOf("processo_compra"));
    expect(chaves.indexOf("empenhada")).toBeGreaterThan(chaves.indexOf("vistoria"));
    expect(chaves.indexOf("empenhada")).toBeGreaterThan(chaves.indexOf("processo_compra"));
  });

  it("fase desativada só aparece se houver emenda nela", () => {
    expect(etapasEmOrdem(cat).map((e) => e.chave)).not.toContain("plano_trabalho");
    expect(etapasEmOrdem(cat, new Set(["plano_trabalho"])).map((e) => e.chave)).toContain("plano_trabalho");
  });

  it("o catálogo padrão reproduz as trilhas de origem", () => {
    expect(trilha("repasse")).toEqual([
      "indicada", "analise", "plano_trabalho", "termo_parceria", "empenhada", "liquidada", "envio_pagamento", "paga",
      "prestacao_contas", "concluida",
    ]);
    expect(trilha("direta")).toEqual(["indicada", "analise", "processo_compra", "empenhada", "liquidada", "envio_pagamento", "paga", "concluida"]);
  });
});

describe("validarFluxo", () => {
  const base = (chaves: string[]) => chaves.map((chave) => ({ chave, nome: chave === "indicada" ? "Indicada" : chave, ativa: true }));
  const ok = base(["indicada", "analise", "empenhada", "liquidada", "paga", "concluida"]);

  it("aceita o fluxo mínimo e fases novas no meio", () => {
    expect(validarFluxo(ok)).toBeNull();
    expect(validarFluxo([...ok.slice(0, 2), { chave: null, nome: "Vistoria técnica", ativa: true }, ...ok.slice(2)])).toBeNull();
  });

  it("recusa tirar, desativar ou reordenar fases fixas", () => {
    expect(validarFluxo(ok.filter((i) => i.chave !== "liquidada"))).toMatch(/fixas/);
    expect(validarFluxo(ok.map((i) => (i.chave === "paga" ? { ...i, ativa: false } : i)))).toMatch(/desativadas/);
    expect(validarFluxo([ok[0], ok[3], ok[2], ...ok.slice(4)])).toMatch(/ordem/);
    expect(validarFluxo(ok.map((i) => (i.chave === "paga" ? { ...i, remover: true } : i)))).toMatch(/removidas/);
  });

  it("Indicada fica primeiro e Concluída por último", () => {
    expect(validarFluxo([ok[1], ok[0], ...ok.slice(2)])).toMatch(/primeira/);
    expect(validarFluxo([...ok.slice(0, 5), { chave: null, nome: "Arquivamento", ativa: true }, ok[5]])).toBeNull();
    expect(validarFluxo([...ok, { chave: null, nome: "Arquivamento", ativa: true }])).toMatch(/última/);
  });

  it("recusa nome curto e nomes repetidos entre as ativas", () => {
    expect(validarFluxo([...ok.slice(0, 2), { chave: null, nome: "A", ativa: true }, ...ok.slice(2)])).toMatch(/2 a 60/);
    expect(
      validarFluxo([...ok.slice(0, 2), { chave: null, nome: "ANALISE", ativa: true }, ...ok.slice(2)])
    ).toMatch(/mesmo nome/);
  });
});

describe("situacaoVigencia", () => {
  it("sem fim de vigência não diz nada", () => {
    expect(situacaoVigencia(null, "2026-10-21")).toBeNull();
  });
  it("encerrada pede acompanhar a prestação de contas", () => {
    expect(situacaoVigencia("2026-09-30", "2026-10-21")).toEqual({
      texto: "Vigência encerrada em 30/09/2026 — acompanhar a prestação de contas",
      alerta: true,
    });
  });
  it("avisa nos últimos 30 dias", () => {
    expect(situacaoVigencia("2026-10-21", "2026-10-21")?.texto).toBe("Vigência termina hoje");
    expect(situacaoVigencia("2026-10-22", "2026-10-21")?.texto).toBe("Vigência termina em 1 dia");
    expect(situacaoVigencia("2026-11-20", "2026-10-21")).toEqual({ texto: "Vigência termina em 30 dias", alerta: true });
  });
  it("vigência longa não é alerta", () => {
    expect(situacaoVigencia("2027-03-20", "2026-10-21")).toEqual({ texto: "Em vigência até 20/03/2027", alerta: false });
  });
});

describe("curvaPagamentos: pagamentos sem data", () => {
  it("conta a quantidade e o valor que ficam fora da curva", () => {
    const r = curvaPagamentos([{ data: "2026-02-10", valor: 100 }, { data: null, valor: 50 }, { data: null, valor: 25 }], 2026);
    expect(r.semData).toBe(75);
    expect(r.qtdSemData).toBe(2);
    expect(r.acumulado[11]).toBe(100);
  });
});
