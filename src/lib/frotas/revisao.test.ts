import { describe, expect, it } from "vitest";

import { chavePlaca, resumirRevisao, revisarVeiculos } from "@/lib/frotas/revisao";
import type { Veiculo } from "@/types/frotas";

let contador = 0;
function veiculo(parcial: Partial<Veiculo>): Veiculo {
  contador += 1;
  return {
    id: `v${contador}`,
    placa: `AAA-${1000 + contador}`,
    modelo: "Modelo",
    marca: null,
    ano_fabricacao: 2020,
    ano_modelo: 2020,
    combustivel: "flex",
    classificacao: "leve",
    patrimonio: `11200${String(contador).padStart(2, "0")}`,
    vinculo: "proprio",
    secretaria_id: "s1",
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
    valor_referencia: null,
    valor_fonte: null,
    valor_referencia_em: null,
    revisao_ignorada: [],
    observacoes: null,
    origem: null,
    criado_em: "",
    atualizado_em: "",
    ...parcial,
  };
}

describe("chavePlaca", () => {
  it("ignora espaço, hífen e caixa", () => {
    expect(chavePlaca("qqb - 9947")).toBe("QQB9947");
    expect(chavePlaca(null)).toBe("");
  });
});

describe("revisarVeiculos", () => {
  it("não marca nada num cadastro limpo", () => {
    const lista = [veiculo({}), veiculo({})];
    expect(revisarVeiculos(lista).size).toBe(0);
  });

  it("acha a placa repetida entre abas (próprio e convênio)", () => {
    const a = veiculo({ placa: "QQB-9947", vinculo: "proprio" });
    const b = veiculo({ placa: "QQB 9947", vinculo: "convenio" });
    const r = revisarVeiculos([a, b, veiculo({})]);
    expect(r.get(a.id)?.map((x) => x.codigo)).toContain("placa_repetida");
    expect(r.get(b.id)?.map((x) => x.codigo)).toContain("placa_repetida");
    expect(r.size).toBe(2);
  });

  it("acha o patrimônio repetido e diz com quem", () => {
    const a = veiculo({ placa: "QQB-9947", patrimonio: "1120246" });
    const b = veiculo({ placa: "QNN-8947", patrimonio: "1120246" });
    const r = revisarVeiculos([a, b]);
    const aviso = r.get(a.id)?.find((x) => x.codigo === "patrimonio_repetido");
    expect(aviso?.texto).toBe("Patrimônio 1120246 repetido (QNN-8947)");
  });

  it("patrimônio zerado não conta como repetido", () => {
    const a = veiculo({ patrimonio: "0000000" });
    const b = veiculo({ patrimonio: "0000000" });
    const r = revisarVeiculos([a, b]);
    expect(r.get(a.id)?.map((x) => x.codigo)).toEqual(["patrimonio_zerado"]);
  });

  it("patrimônio fora do padrão: longo demais ou igual aos dígitos da placa", () => {
    const longo = veiculo({ placa: "QMV-0393", patrimonio: "1148623210" });
    const placaNoLugar = veiculo({ placa: "PZS-7543", patrimonio: "1127543" });
    const normal = veiculo({ placa: "HLF-2875", patrimonio: "1120099" });
    const maquina = veiculo({ placa: "LW180KV", patrimonio: "35510" });
    const r = revisarVeiculos([longo, placaNoLugar, normal, maquina]);
    expect(r.get(longo.id)?.map((x) => x.codigo)).toEqual(["patrimonio_fora_padrao"]);
    expect(r.get(placaNoLugar.id)?.map((x) => x.codigo)).toEqual(["patrimonio_fora_padrao"]);
    expect(r.has(normal.id)).toBe(false);
    expect(r.has(maquina.id)).toBe(false);
  });

  it("dados faltando: placa, ano e combustível", () => {
    const v = veiculo({ placa: null, ano_fabricacao: null, ano_modelo: null, combustivel: null });
    expect(revisarVeiculos([v]).get(v.id)?.map((x) => x.codigo)).toEqual(["sem_placa", "sem_ano", "sem_combustivel"]);
  });

  it("some quando a pessoa marca como correto", () => {
    const a = veiculo({ placa: "QQB-9947", revisao_ignorada: ["placa_repetida"] });
    const b = veiculo({ placa: "QQB-9947" });
    const r = revisarVeiculos([a, b]);
    expect(r.has(a.id)).toBe(false);
    expect(r.has(b.id)).toBe(true);
  });
});

describe("resumirRevisao", () => {
  it("conta o valor repetido uma vez, não os dois veículos", () => {
    const lista = [
      veiculo({ placa: "QQB-9947", patrimonio: "1120246" }),
      veiculo({ placa: "QQB-9947", patrimonio: "1120999" }),
      veiculo({ placa: "QNN-8947", patrimonio: "1120246" }),
      veiculo({ placa: null }),
      veiculo({ patrimonio: "0000000" }),
    ];
    const resumo = resumirRevisao(lista, revisarVeiculos(lista));
    const por = Object.fromEntries(resumo.map((r) => [r.codigo, r]));
    expect(por.placa_repetida).toMatchObject({ n: 1, rotulo: "placa repetida" });
    expect(por.patrimonio_repetido).toMatchObject({ n: 1, rotulo: "patrimônio repetido" });
    expect(por.sem_placa).toMatchObject({ n: 1, rotulo: "veículo sem placa" });
    expect(por.patrimonio_zerado).toMatchObject({ n: 1 });
  });
});
