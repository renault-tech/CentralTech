import { describe, expect, it } from "vitest";

import { custosFipe, filtrarCustos, inicioDoPeriodo, periodoValido } from "@/lib/frotas/custos";
import { PARAMETROS_PADRAO } from "@/lib/frotas/regras";
import type { Manutencao, Veiculo } from "@/types/frotas";

const HOJE = "2026-11-04";

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


const entrada = (veiculos: Veiculo[], manutencoes: Manutencao[], periodo: "12m" | "24m" | "ano" | "tudo" = "12m") => ({
  hoje: HOJE,
  veiculos,
  manutencoes,
  params: PARAMETROS_PADRAO,
  periodo,
});

describe("período", () => {
  it("valida e calcula o início", () => {
    expect(periodoValido("xx")).toBe("12m");
    expect(periodoValido("tudo")).toBe("tudo");
    expect(inicioDoPeriodo("12m", HOJE)).toBe("2025-11-04");
    expect(inicioDoPeriodo("ano", HOJE)).toBe("2026-01-01");
    expect(inicioDoPeriodo("tudo", HOJE)).toBeNull();
  });
});

describe("custosFipe", () => {
  it("separa período e total, ano a ano, e calcula % do valor", () => {
    const v = veiculo("a", { valor_referencia: 20000 });
    const { linhas, resumo } = custosFipe(
      entrada(
        [v],
        [
          manutencao("a", { orcamento_valor: 1000, orcamento_recebido_em: "2026-09-01", analisado_em: "2026-09-02" }),
          manutencao("a", { orcamento_valor: 3000, orcamento_recebido_em: "2024-02-01", analisado_em: "2024-02-02" }),
        ]
      )
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].custoPeriodo).toBe(1000);
    expect(linhas[0].custoTotal).toBe(4000);
    expect(linhas[0].pctPeriodo).toBe(5);
    expect(linhas[0].pctTotal).toBe(20);
    expect(linhas[0].porAno.map((x) => x.ano)).toEqual(["2026", "2024"]);
    expect(resumo.valorFrota).toBe(20000);
    expect(resumo.pctFrota).toBe(5);
  });

  it("ignora serviço não liberado e mostra sem valor à parte (alugado não tem valor)", () => {
    const { linhas, resumo } = custosFipe(
      entrada(
        [veiculo("a", { valor_referencia: null }), veiculo("b", { vinculo: "alugado", valor_referencia: 50000 }), veiculo("c")],
        [manutencao("a"), manutencao("b"), manutencao("c", { status_analise: "a_analisar" })]
      )
    );
    expect(linhas.map((l) => l.veiculo.id).sort()).toEqual(["a", "b"]);
    expect(resumo.semValor).toBe(2);
    expect(resumo.gastoSemValor).toBe(2000);
    expect(resumo.pctFrota).toBeNull();
  });

  it("nível por % do período", () => {
    const v = veiculo("a", { valor_referencia: 10000 });
    const { linhas, resumo } = custosFipe(entrada([v], [manutencao("a", { orcamento_valor: 11000 })]));
    expect(linhas[0].nivel).toBe("critico");
    expect(resumo.critico).toBe(1);
  });
});

describe("filtrarCustos", () => {
  const vs = [veiculo("a", { placa: "AAA-1111", valor_referencia: 10000 }), veiculo("b", { placa: "BBB-2222", valor_referencia: null, secretaria_id: "edu" })];
  const { linhas } = custosFipe(entrada(vs, [manutencao("a", { orcamento_valor: 500 }), manutencao("b", { orcamento_valor: 9000 })]));
  it("ordena com valor primeiro e filtra", () => {
    expect(filtrarCustos(linhas, {}).map((l) => l.veiculo.id)).toEqual(["a", "b"]);
    expect(filtrarCustos(linhas, { nivel: "sem_valor" }).map((l) => l.veiculo.id)).toEqual(["b"]);
    expect(filtrarCustos(linhas, { secretaria: "edu" }).map((l) => l.veiculo.id)).toEqual(["b"]);
    expect(filtrarCustos(linhas, { q: "aaa" }).map((l) => l.veiculo.id)).toEqual(["a"]);
  });
});
