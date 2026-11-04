import { describe, expect, it } from "vitest";

import { analisarOrcamento, calcularAlertas, calcularIndicadores, calcularPainel, custoPorVeiculo, gastoPorSecretaria, secretariasSemNf } from "@/lib/frotas/analise";
import { PARAMETROS_PADRAO } from "@/lib/frotas/regras";
import type { Manutencao, NotaCombustivel, SecretariaFrotas, Veiculo } from "@/types/frotas";

const HOJE = "2026-11-04";

const sec = (id: string, nome: string, extra: Partial<SecretariaFrotas> = {}): SecretariaFrotas => ({
  id,
  nome,
  controla_combustivel: true,
  ativa: true,
  criado_em: "",
  ...extra,
});

const SECRETARIAS = [sec("edu", "Educação"), sec("su", "Serviços Urbanos"), sec("fazenda", "Fazenda"), sec("gab", "Gabinete")];

function veiculo(id: string, parcial: Partial<Veiculo> = {}): Veiculo {
  return {
    id,
    placa: id.toUpperCase(),
    modelo: "Modelo",
    marca: null,
    ano_fabricacao: 2016,
    ano_modelo: 2016,
    combustivel: "flex",
    classificacao: "leve",
    patrimonio: null,
    vinculo: "proprio",
    secretaria_id: "su",
    setor: null,
    situacao: "ativo",
    motivo_situacao: null,
    finalidade: null,
    locadora_id: null,
    fipe_tipo: null,
    fipe_marca_id: null,
    fipe_modelo_id: null,
    fipe_ano_id: null,
    fipe_codigo: null,
    fipe_referencia: null,
    valor_referencia: 20000,
    valor_fonte: "fipe",
    valor_referencia_em: null,
    revisao_ignorada: [],
    observacoes: null,
    origem: null,
    criado_em: "",
    atualizado_em: "",
    ...parcial,
  };
}

let seq = 0;
function manutencao(veiculo_id: string, parcial: Partial<Manutencao> = {}): Manutencao {
  seq += 1;
  return {
    id: `m${seq}`,
    veiculo_id,
    secretaria_id: "su",
    fornecedor_id: null,
    servico: "Embreagem",
    descricao: null,
    orcamento_valor: 1000,
    orcamento_recebido_em: "2026-09-01",
    status_analise: "liberado",
    analisado_em: "2026-09-02",
    analise_obs: null,
    oc_numero: null,
    oc_valor: null,
    oc_emitida_em: null,
    nf_numero: null,
    nf_emissao: null,
    nf_valor: null,
    enviada_contabilidade_em: null,
    observacoes: null,
    criado_em: "",
    atualizado_em: "",
    ...parcial,
  };
}

function nota(secretaria_id: string, periodo_inicio: string, valor: number, parcial: Partial<NotaCombustivel> = {}): NotaCombustivel {
  seq += 1;
  return {
    id: `n${seq}`,
    secretaria_id,
    fornecedor_id: null,
    numero_nf: String(seq),
    periodo_inicio,
    periodo_fim: periodo_inicio.endsWith("-01") ? periodo_inicio.slice(0, 8) + "15" : periodo_inicio.slice(0, 8) + "28",
    data_emissao: periodo_inicio,
    valor,
    enviada_secretaria_em: null,
    retornou_em: null,
    enviada_contabilidade_em: null,
    observacoes: null,
    criado_em: "",
    atualizado_em: "",
    ...parcial,
  };
}

const entrada = (parcial: Partial<Parameters<typeof custoPorVeiculo>[0]> = {}) => ({
  hoje: HOJE,
  veiculos: [] as Veiculo[],
  manutencoes: [] as Manutencao[],
  notas: [] as NotaCombustivel[],
  secretarias: SECRETARIAS,
  params: PARAMETROS_PADRAO,
  ...parcial,
});

describe("custo × valor do veículo", () => {
  it("compara os 12 meses com o valor e classifica", () => {
    const v = veiculo("gol", { valor_referencia: 14000 });
    const linhas = custoPorVeiculo(entrada({ veiculos: [v], manutencoes: [manutencao("gol", { orcamento_valor: 15700 })] }));
    expect(linhas).toHaveLength(1);
    expect(Math.round(linhas[0].pct12m)).toBe(112);
    expect(linhas[0]).toMatchObject({ nivel: "critico", parecer: "avaliar_baixa" });
  });

  it("separa o gasto de 12 meses do total, e ignora recusados e a analisar", () => {
    const v = veiculo("kombi", { valor_referencia: 10000 });
    const linhas = custoPorVeiculo(
      entrada({
        veiculos: [v],
        manutencoes: [
          manutencao("kombi", { orcamento_valor: 4000, analisado_em: "2024-01-10", orcamento_recebido_em: "2024-01-05" }),
          manutencao("kombi", { orcamento_valor: 6000 }),
          manutencao("kombi", { orcamento_valor: 9000, status_analise: "recusado" }),
          manutencao("kombi", { orcamento_valor: 9000, status_analise: "a_analisar", analisado_em: null }),
        ],
      })
    );
    expect(linhas[0]).toMatchObject({ custo12m: 6000, custoTotal: 10000, nivel: "atencao" });
  });

  it("usa a NF, depois a OC, depois o orçamento liberado", () => {
    const v = veiculo("a", { valor_referencia: 10000 });
    const m = manutencao("a", { orcamento_valor: 1000, oc_numero: "1/2026", oc_valor: 900, nf_numero: "9", nf_emissao: "2026-09-20", nf_valor: 850 });
    expect(custoPorVeiculo(entrada({ veiculos: [v], manutencoes: [m] }))[0].custo12m).toBe(850);
  });

  it("alerta enquanto a NF estiver acima da OC, e some quando for corrigida", () => {
    const v = veiculo("a", { valor_referencia: 10000 });
    const acima = manutencao("a", { oc_numero: "1/2026", oc_valor: 199, nf_numero: "9", nf_emissao: "2026-09-20", nf_valor: 205 });
    const alerta = calcularAlertas(entrada({ veiculos: [v], manutencoes: [acima] })).find((a) => a.codigo === "nf_acima_oc");
    expect(alerta).toMatchObject({ nivel: "critico" });
    expect(alerta?.itens).toHaveLength(1);
    const ok = { ...acima, nf_valor: 199 };
    expect(calcularAlertas(entrada({ veiculos: [v], manutencoes: [ok] })).some((a) => a.codigo === "nf_acima_oc")).toBe(false);
  });

  it("deixa de fora alugado, sem valor e sem gasto", () => {
    const veiculos = [veiculo("alug", { vinculo: "alugado" }), veiculo("semvalor", { valor_referencia: null, valor_fonte: null }), veiculo("semgasto")];
    const manutencoes = [manutencao("alug"), manutencao("semvalor")];
    expect(custoPorVeiculo(entrada({ veiculos, manutencoes }))).toEqual([]);
  });

  it("ordena do mais comprometido para o menos", () => {
    const veiculos = [veiculo("baixo", { valor_referencia: 100000 }), veiculo("alto", { valor_referencia: 2000 })];
    const manutencoes = [manutencao("baixo", { orcamento_valor: 1000 }), manutencao("alto", { orcamento_valor: 1500 })];
    expect(custoPorVeiculo(entrada({ veiculos, manutencoes })).map((l) => l.veiculo.id)).toEqual(["alto", "baixo"]);
  });
});

describe("gasto por secretaria e indicadores", () => {
  it("soma combustível (NFs) e manutenção dos últimos 12 meses", () => {
    const notas = [nota("edu", "2026-10-01", 30000), nota("edu", "2026-10-16", 20000), nota("edu", "2024-01-01", 99999)];
    const manutencoes = [manutencao("x", { secretaria_id: "edu", orcamento_valor: 5000 })];
    const gastos = gastoPorSecretaria(entrada({ notas, manutencoes }));
    expect(gastos).toEqual([{ id: "edu", nome: "Educação", combustivel: 50000, manutencao: 5000 }]);
    const ind = calcularIndicadores(entrada({ notas, manutencoes, veiculos: [veiculo("a", { ano_modelo: 2016 }), veiculo("b", { ano_modelo: 2024 })] }));
    expect(ind).toMatchObject({ combustivel12m: 50000, manutencao12m: 5000, idadeMedia: 6 });
  });
});

describe("alertas automáticos", () => {
  it("avisa secretaria sem NF na quinzena anterior", () => {
    const notas = [nota("edu", "2026-10-16", 1000), nota("su", "2026-10-16", 1000)];
    const sem = secretariasSemNf(SECRETARIAS, notas, "2026-10-16").map((s) => s.nome);
    expect(sem).toEqual(["Fazenda", "Gabinete"]);
    const alerta = calcularAlertas(entrada({ notas })).find((a) => a.codigo === "sem_nf_quinzena");
    expect(alerta).toMatchObject({ nivel: "critico", itens: ["Fazenda", "Gabinete"] });
  });

  it("não cobra NF de secretaria que não controla combustível", () => {
    const secretarias = [sec("edu", "Educação", { controla_combustivel: false })];
    expect(secretariasSemNf(secretarias, [], "2026-10-16")).toEqual([]);
  });

  it("acha veículo acima de 50% e de 100%", () => {
    const veiculos = [veiculo("gol", { valor_referencia: 14000 }), veiculo("kombi", { valor_referencia: 22000 })];
    const manutencoes = [manutencao("gol", { orcamento_valor: 15700 }), manutencao("kombi", { orcamento_valor: 12540 })];
    const alertas = calcularAlertas(entrada({ veiculos, manutencoes, notas: [nota("edu", "2026-10-16", 1), nota("su", "2026-10-16", 1), nota("fazenda", "2026-10-16", 1), nota("gab", "2026-10-16", 1)] }));
    expect(alertas.find((a) => a.codigo === "pct_atencao")?.itens).toEqual(["GOL", "KOMBI"]);
    expect(alertas.find((a) => a.codigo === "pct_critico")?.itens).toEqual(["GOL"]);
  });

  it("acha veículo inativo com gasto recente", () => {
    const v = veiculo("parado", { situacao: "inativo" });
    const alertas = calcularAlertas(entrada({ veiculos: [v], manutencoes: [manutencao("parado", { analisado_em: "2026-10-20", orcamento_recebido_em: "2026-10-18" })] }));
    expect(alertas.find((a) => a.codigo === "inativo_com_gasto")?.itens).toEqual(["PARADO"]);
  });

  it("acha reincidência (3 manutenções em 6 meses)", () => {
    const v = veiculo("a");
    const manutencoes = ["2026-06-10", "2026-08-10", "2026-10-10"].map((d) => manutencao("a", { analisado_em: d, orcamento_recebido_em: d }));
    expect(calcularAlertas(entrada({ veiculos: [v], manutencoes })).find((a) => a.codigo === "reincidencia")?.itens).toEqual(["A"]);
    expect(calcularAlertas(entrada({ veiculos: [v], manutencoes: manutencoes.slice(0, 2) })).find((a) => a.codigo === "reincidencia")).toBeUndefined();
  });

  it("acha orçamento acima da média de serviços parecidos", () => {
    const veiculos = [veiculo("a"), veiculo("b"), veiculo("c")];
    const historico = [3900, 4300, 4100].map((v, i) => manutencao(["a", "b", "c"][i], { servico: "Embreagem", orcamento_valor: v }));
    const novo = manutencao("a", { servico: "embreagem", orcamento_valor: 4850, status_analise: "a_analisar", analisado_em: null, orcamento_recebido_em: "2026-11-02" });
    const alerta = calcularAlertas(entrada({ veiculos, manutencoes: [...historico, novo] })).find((a) => a.codigo === "orcamento_acima_media");
    expect(alerta?.itens).toEqual(["A · embreagem"]);
    // 4.600 é só 12% acima da média de 4.100: dentro do limite de 15%.
    const ok = { ...novo, orcamento_valor: 4600 };
    expect(calcularAlertas(entrada({ veiculos, manutencoes: [...historico, ok] })).find((a) => a.codigo === "orcamento_acima_media")).toBeUndefined();
  });

  it("acha combustível 20% acima da média das quinzenas anteriores", () => {
    const quinzenas = ["2026-10-01", "2026-09-16", "2026-09-01", "2026-08-16"];
    const notas = [...quinzenas.map((q) => nota("edu", q, 1000)), nota("edu", "2026-10-16", 1300)];
    expect(calcularAlertas(entrada({ notas })).find((a) => a.codigo === "combustivel_acima_media")?.itens).toEqual(["Educação"]);
    const baixo = [...quinzenas.map((q) => nota("edu", q, 1000)), nota("edu", "2026-10-16", 1100)];
    expect(calcularAlertas(entrada({ notas: baixo })).find((a) => a.codigo === "combustivel_acima_media")).toBeUndefined();
  });
});

describe("painel de pendências", () => {
  it("conta e ordena pelo que está parado há mais tempo", () => {
    const notas = [
      nota("edu", "2026-09-30", 1000, { data_emissao: "2026-09-30", enviada_secretaria_em: "2026-10-12" }),
      nota("su", "2026-10-01", 1000, { data_emissao: "2026-10-15", enviada_secretaria_em: "2026-10-30" }),
      nota("gab", "2026-10-01", 1000, { data_emissao: "2026-10-15", enviada_secretaria_em: "2026-10-20", retornou_em: "2026-10-28" }),
      nota("fazenda", "2026-10-01", 1000, { data_emissao: "2026-10-15", enviada_secretaria_em: "2026-10-20", retornou_em: "2026-10-28", enviada_contabilidade_em: "2026-10-29" }),
    ];
    const veiculos = [veiculo("hlf6885")];
    const manutencoes = [
      manutencao("hlf6885", { oc_numero: "1841/2026", oc_emitida_em: "2026-10-15" }),
      manutencao("hlf6885", { status_analise: "a_analisar", analisado_em: null, orcamento_recebido_em: "2026-11-02" }),
      manutencao("hlf6885", { oc_numero: "1/2026", nf_numero: "5", nf_emissao: "2026-10-10", nf_valor: 100, enviada_contabilidade_em: "2026-10-12" }),
    ];
    const p = calcularPainel(entrada({ notas, manutencoes, veiculos }));

    expect(p.nfsAguardando.map((i) => [i.secretaria, i.dias, i.nivel])).toEqual([
      ["Educação", 23, "critico"],
      ["Serviços Urbanos", 5, "ok"],
    ]);
    expect(p.cartoes).toMatchObject({
      nfsEmAndamento: 3,
      nfsAguardando: 2,
      nfsAguardandoComAlerta: 1,
      manutComOc: 1,
      manutAguardandoNf: 1,
      manutAguardandoNfComAlerta: 1,
      orcamentos: 1,
      orcamentoMaisAntigo: 2,
      paraContabilidade: 1,
    });
    expect(p.manutencoesAguardando[0]).toMatchObject({ secretaria: "Serviços Urbanos", referencia: "1841/2026", dias: 20, nivel: "critico" });
    expect(p.orcamentos[0]).toMatchObject({ referencia: "Embreagem", dias: 2, valor: 1000 });
  });

  it("controla a quinzena anterior", () => {
    const notas = [nota("edu", "2026-10-16", 1), nota("su", "2026-10-16", 1), nota("fazenda", "2026-10-01", 1)];
    const p = calcularPainel(entrada({ notas }));
    expect(p.quinzena).toMatchObject({ rotulo: "16 a 31/10/2026", recebidas: 2, esperadas: 4, semNf: ["Fazenda", "Gabinete"] });
  });
});

describe("análise de um orçamento", () => {
  it("compara com o valor do veículo, o histórico e os serviços parecidos", () => {
    const v = veiculo("argo", { valor_referencia: 72000 });
    const outros = [veiculo("b"), veiculo("c"), veiculo("d")];
    const orcamento = manutencao("argo", { servico: "Embreagem", orcamento_valor: 4850, status_analise: "a_analisar", analisado_em: null, orcamento_recebido_em: "2026-11-02" });
    const manutencoes = [
      orcamento,
      manutencao("argo", { servico: "Troca de pneus", orcamento_valor: 2100, analisado_em: "2026-08-10", orcamento_recebido_em: "2026-08-05" }),
      manutencao("argo", { servico: "Freios", orcamento_valor: 1100, analisado_em: "2026-03-10", orcamento_recebido_em: "2026-03-05" }),
      manutencao("b", { servico: "embreagem", orcamento_valor: 3900, analisado_em: "2026-06-10", orcamento_recebido_em: "2026-06-05" }),
      manutencao("c", { servico: "Embreagem", orcamento_valor: 4300, analisado_em: "2026-07-10", orcamento_recebido_em: "2026-07-05" }),
      manutencao("d", { servico: "Embreagem", orcamento_valor: 4100, analisado_em: "2026-09-10", orcamento_recebido_em: "2026-09-05" }),
    ];
    const a = analisarOrcamento(orcamento, entrada({ veiculos: [v, ...outros], manutencoes }));
    expect(a.valorReferencia).toBe(72000);
    expect(a.gasto12m).toBe(3200);
    expect(a.historico.map((h) => h.servico)).toEqual(["Troca de pneus", "Freios"]);
    expect(a.pctComEste).toBeCloseTo(11.18, 1);
    expect(a.pctEste).toBeCloseTo(6.74, 1);
    expect(a.nivel).toBe("ok");
    expect(a.parecidos).toHaveLength(3);
    expect(a.mediaParecidos).toBe(4100);
    expect(a.acimaDaMediaPct).toBeCloseTo(18.3, 1);
  });

  it("sem valor de referência ou sem amostras, não inventa percentual", () => {
    const v = veiculo("sem", { valor_referencia: null, valor_fonte: null });
    const m = manutencao("sem", { servico: "Embreagem", status_analise: "a_analisar", analisado_em: null });
    const a = analisarOrcamento(m, entrada({ veiculos: [v], manutencoes: [m] }));
    expect(a).toMatchObject({ valorReferencia: null, pctComEste: null, mediaParecidos: null, acimaDaMediaPct: null, nivel: "ok" });
  });
});
