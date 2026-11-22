import { describe, expect, it } from "vitest";

import { montarPainelFrotas, quandoFoi } from "@/lib/frotas/painel-abertura";
import { PARAMETROS_PADRAO } from "@/lib/frotas/regras";
import type { Manutencao, NotaCombustivel, SecretariaFrotas, Veiculo } from "@/types/frotas";

const HOJE = "2026-11-22"; // quinzena de hoje: 16–30/11; a anterior: 01–15/11

const sec = (id: string, nome: string, extra: Partial<SecretariaFrotas> = {}): SecretariaFrotas => ({ id, nome, controla_combustivel: true, ativa: true, criado_em: "", ...extra });
const SECRETARIAS = [sec("edu", "Educação"), sec("su", "Serviços Urbanos"), sec("saude", "Saúde")];

function veiculo(id: string, p: Partial<Veiculo> = {}): Veiculo {
  return {
    id, placa: id.toUpperCase(), modelo: "Modelo", marca: null, ano_fabricacao: 2016, ano_modelo: 2016, combustivel: "flex", classificacao: "leve", patrimonio: null,
    vinculo: "proprio", secretaria_id: "su", setor: null, situacao: "ativo", motivo_situacao: null, finalidade: null, locadora_id: null, fipe_tipo: null, fipe_marca_id: null,
    fipe_modelo_id: null, fipe_ano_id: null, fipe_codigo: null, fipe_referencia: null, valor_referencia: 20000, valor_fonte: "fipe", valor_referencia_em: null,
    revisao_ignorada: [], observacoes: null, origem: null, criado_em: "", atualizado_em: "", ...p,
  };
}

let seq = 0;
function manutencao(veiculo_id: string, p: Partial<Manutencao> = {}): Manutencao {
  seq += 1;
  return {
    id: `m${seq}`, veiculo_id, secretaria_id: "su", fornecedor_id: null, servico: "Embreagem", descricao: null, orcamento_valor: 1000, orcamento_recebido_em: "2026-11-01",
    status_analise: "liberado", analisado_em: "2026-11-02", analise_obs: null, oc_numero: null, oc_valor: null, oc_emitida_em: null, nf_numero: null, nf_emissao: null, nf_valor: null,
    enviada_contabilidade_em: null, observacoes: null, criado_em: "", atualizado_em: "", ...p,
  };
}

function nota(secretaria_id: string, periodo_inicio: string, valor: number, p: Partial<NotaCombustivel> = {}): NotaCombustivel {
  seq += 1;
  return {
    id: `n${seq}`, secretaria_id, fornecedor_id: null, numero_nf: String(seq), periodo_inicio, periodo_fim: periodo_inicio, data_emissao: periodo_inicio, valor,
    enviada_secretaria_em: null, retornou_em: null, enviada_contabilidade_em: null, observacoes: null, criado_em: "", atualizado_em: "", ...p,
  };
}

const monta = (p: { veiculos?: Veiculo[]; manutencoes?: Manutencao[]; notas?: NotaCombustivel[] } = {}) =>
  montarPainelFrotas({ hoje: HOJE, veiculos: p.veiculos ?? [], manutencoes: p.manutencoes ?? [], notas: p.notas ?? [], secretarias: SECRETARIAS, params: PARAMETROS_PADRAO });

describe("painel de abertura de Frotas", () => {
  it("divide o dinheiro em aberto pelas quatro etapas da manutenção", () => {
    const p = monta({
      veiculos: [veiculo("a"), veiculo("b"), veiculo("c"), veiculo("d")],
      manutencoes: [
        manutencao("a", { status_analise: "a_analisar", analisado_em: null, orcamento_valor: 4800 }),
        manutencao("b", { orcamento_valor: 3600 }), // liberada, sem OC
        manutencao("c", { oc_numero: "10", oc_valor: 14200, oc_emitida_em: "2026-11-03" }),
        manutencao("d", { oc_numero: "11", oc_valor: 5000, oc_emitida_em: "2026-11-03", nf_numero: "9", nf_emissao: "2026-11-10", nf_valor: 5100 }),
        manutencao("d", { status_analise: "recusado", orcamento_valor: 99999 }), // recusada não entra
      ],
    });
    expect(p.segmentos.map((s) => [s.chave, s.valor, s.quantidade])).toEqual([
      ["a_analisar", 4800, 1],
      ["liberada", 3600, 1],
      ["oc_emitida", 14200, 1],
      ["nf_registrada", 5100, 1],
    ]);
    expect(p.emAberto.valor).toBe(27700);
    expect(p.emAberto.manutencoes).toBe(4);
  });

  it("conta NFs de combustível ainda não entregues à Contabilidade e o tempo médio parado", () => {
    const p = monta({
      notas: [
        nota("edu", "2026-11-01", 5000, { enviada_secretaria_em: "2026-11-12" }), // com a secretaria há 10 dias
        nota("saude", "2026-11-01", 7000, { enviada_secretaria_em: "2026-11-12", retornou_em: "2026-11-20" }), // assinada há 2 dias
        nota("su", "2026-10-16", 4000, { enviada_secretaria_em: "2026-10-18", retornou_em: "2026-10-20", enviada_contabilidade_em: "2026-11-15" }), // concluída
      ],
    });
    expect(p.emAberto.nfs).toBe(2);
    expect(p.emAberto.tempoMedio).toBe(6); // (10 + 2) / 2
    expect(p.combEtapas.find((e) => e.chave === "com_secretaria")?.quantidade).toBe(1);
    expect(p.combEtapas.find((e) => e.chave === "assinada")?.valor).toBe(7000);
    expect(p.combEtapas.find((e) => e.chave === "na_contabilidade")?.quantidade).toBe(1);
  });

  it("só lista em 'Precisa da sua atenção' o que tem quantidade e põe o mais grave primeiro", () => {
    const p = monta({
      veiculos: [veiculo("a", { valor_referencia: 10000 }), veiculo("b", { valor_referencia: null, vinculo: "proprio" })],
      manutencoes: [manutencao("a", { orcamento_valor: 12000 })], // 120% do valor → crítico
    });
    const chaves = p.atencao.map((i) => i.chave);
    expect(chaves[0]).toBe("fipe_critico");
    expect(chaves).toContain("sem_fipe");
    expect(chaves).not.toContain("nf_acima_oc");
    expect(p.atencao.every((i) => i.quantidade > 0)).toBe(true);
    // a gravidade nunca volta atrás na ordem
    const peso = { alta: 0, media: 1, info: 2 } as const;
    const pesos = p.atencao.map((i) => peso[i.gravidade]);
    expect(pesos).toEqual([...pesos].sort((x, y) => x - y));
  });

  it("aponta a NF da oficina acima da OC como alerta alto", () => {
    const p = monta({
      veiculos: [veiculo("a")],
      manutencoes: [manutencao("a", { oc_numero: "1", oc_valor: 1000, oc_emitida_em: "2026-11-02", nf_numero: "2", nf_emissao: "2026-11-05", nf_valor: 1380 })],
    });
    const item = p.atencao.find((i) => i.chave === "nf_acima_oc");
    expect(item?.quantidade).toBe(1);
    expect(item?.gravidade).toBe("alta");
  });

  it("confere a quinzena anterior e leva ao filtro dela", () => {
    const p = monta({ notas: [nota("edu", "2026-11-01", 1000), nota("su", "2026-11-01", 1000)] });
    expect(p.quinzena.inicio).toBe("2026-11-01");
    expect(p.quinzena.esperadas).toBe(3);
    expect(p.quinzena.recebidas).toBe(2);
    expect(p.quinzena.semNf).toEqual(["Saúde"]);
    expect(p.atencao.find((i) => i.chave === "sem_nf_quinzena")?.href).toBe("/frotas/combustivel?quinz=2026-11-01");
  });

  it("gasto por mês: 12 meses terminando no corrente, manutenção pela data do custo e combustível pelo início da quinzena", () => {
    const p = monta({
      veiculos: [veiculo("a")],
      manutencoes: [manutencao("a", { orcamento_valor: 800, analisado_em: "2026-10-05", orcamento_recebido_em: "2026-10-01" })],
      notas: [nota("edu", "2026-11-01", 2500), nota("edu", "2025-11-01", 999)], // a de 2025 está fora da janela
    });
    expect(p.meses).toHaveLength(12);
    expect(p.meses[0].referencia).toBe("2025-12");
    expect(p.meses[11].referencia).toBe("2026-11");
    expect(p.meses.find((m) => m.referencia === "2026-10")?.manutencao).toBe(800);
    expect(p.meses[11].combustivel).toBe(2500);
    expect(p.meses.reduce((a, m) => a + m.combustivel, 0)).toBe(2500);
  });

  it("últimos movimentos: mais recentes primeiro, no máximo 6, com 'hoje' e 'ontem'", () => {
    const p = monta({
      veiculos: [veiculo("a")],
      manutencoes: [manutencao("a", { status_analise: "a_analisar", analisado_em: null, orcamento_recebido_em: "2026-11-22" })],
      notas: [
        nota("edu", "2026-11-01", 1000, { data_emissao: "2026-11-21" }),
        ...Array.from({ length: 8 }, (_, i) => nota("su", "2026-10-16", 100, { data_emissao: `2026-10-0${i + 1}` })),
      ],
    });
    expect(p.movimentos.length).toBe(6);
    expect(p.movimentos[0].quando).toBe("hoje");
    expect(p.movimentos[1].quando).toBe("ontem");
    const datas = p.movimentos.map((m) => m.data);
    expect(datas).toEqual([...datas].sort().reverse());
  });

  it("frota: conta por vínculo e por secretaria, e as que pedem revisão", () => {
    const p = monta({ veiculos: [veiculo("a"), veiculo("b", { vinculo: "convenio", secretaria_id: "edu" }), veiculo("c", { vinculo: "alugado", secretaria_id: "edu" })] });
    expect(p.veiculos).toMatchObject({ total: 3, proprio: 1, convenio: 1, alugado: 1 });
    expect(p.porSecretaria[0]).toMatchObject({ nome: "Educação", quantidade: 2 });
  });

  it("devolve os limites dos alertas para a legenda", () => {
    expect(monta().limites).toEqual({ diasAtencao: 10, diasCritico: 15, pctAtencao: 50, pctCritico: 100 });
  });
});

describe("quandoFoi", () => {
  it("hoje, ontem e há N dias", () => {
    expect(quandoFoi("2026-11-22", HOJE)).toBe("hoje");
    expect(quandoFoi("2026-11-21", HOJE)).toBe("ontem");
    expect(quandoFoi("2026-11-15", HOJE)).toBe("há 7 dias");
  });
});
