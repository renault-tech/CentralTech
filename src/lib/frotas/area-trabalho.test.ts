import { describe, expect, it } from "vitest";

import { DIAS_NF_ARQUIVADA, montarLinhasManutencao, montarLinhasNotas, montarLinhasVeiculos } from "@/lib/frotas/area-trabalho";
import { PARAMETROS_PADRAO } from "@/lib/frotas/regras";
import type { Manutencao, NotaCombustivel, SecretariaFrotas, Veiculo } from "@/types/frotas";

const HOJE = "2026-11-22";
const secretarias: SecretariaFrotas[] = [{ id: "su", nome: "Serviços Urbanos", controla_combustivel: true, ativa: true, criado_em: "" }];
const veiculo = (id: string, p: Partial<Veiculo> = {}): Veiculo => ({
  id, placa: id.toUpperCase(), modelo: "Strada", marca: "Fiat", ano_fabricacao: 2020, ano_modelo: 2021, combustivel: "flex", classificacao: "leve", patrimonio: null, vinculo: "proprio",
  secretaria_id: "su", setor: null, situacao: "ativo", motivo_situacao: null, finalidade: null, locadora_id: null, fipe_tipo: null, fipe_marca_id: null, fipe_modelo_id: null, fipe_ano_id: null,
  fipe_codigo: null, fipe_referencia: null, valor_referencia: 40000, valor_fonte: "fipe", valor_referencia_em: null, revisao_ignorada: [], observacoes: null, origem: null, criado_em: "", atualizado_em: "", ...p,
});
let seq = 0;
const manutencao = (veiculo_id: string, p: Partial<Manutencao> = {}): Manutencao => ({
  id: `m${++seq}`, veiculo_id, secretaria_id: "su", fornecedor_id: null, servico: "Freios", descricao: null, orcamento_valor: 2000, orcamento_recebido_em: "2026-11-01", status_analise: "liberado",
  analisado_em: "2026-11-02", analise_obs: null, oc_numero: null, oc_valor: null, oc_emitida_em: null, nf_numero: null, nf_emissao: null, nf_valor: null, enviada_contabilidade_em: null, observacoes: null,
  criado_em: "", atualizado_em: "", ...p,
});
const nota = (p: Partial<NotaCombustivel> = {}): NotaCombustivel => ({
  id: `n${++seq}`, secretaria_id: "su", fornecedor_id: null, numero_nf: "123", periodo_inicio: "2026-11-01", periodo_fim: "2026-11-15", data_emissao: "2026-11-01", valor: 5000,
  enviada_secretaria_em: null, retornou_em: null, enviada_contabilidade_em: null, observacoes: null, criado_em: "", atualizado_em: "", ...p,
});
const base = { hoje: HOJE, veiculos: [veiculo("a")], manutencoes: [] as Manutencao[], notas: [] as NotaCombustivel[], secretarias, params: PARAMETROS_PADRAO };

describe("linhas de manutenção", () => {
  it("calcula etapa, dias parada, nível, valor e passos", () => {
    const [l] = montarLinhasManutencao({ ...base, manutencoes: [manutencao("a", { oc_numero: "9", oc_valor: 2500, oc_emitida_em: "2026-11-05" })], oficinas: [] });
    expect(l.etapa).toBe("oc_emitida");
    expect(l.dias).toBe(17);
    expect(l.nivel).toBe("critico");
    expect(l.valor).toBe(2500);
    expect(l.veiculo).toBe("A · Strada 2021");
    expect(l.passos).toHaveLength(6);
    expect(l.analise?.valorReferencia).toBe(40000);
  });
  it("marca a NF acima da OC e não alerta o que já foi concluído", () => {
    const [l] = montarLinhasManutencao({
      ...base,
      manutencoes: [manutencao("a", { oc_numero: "9", oc_valor: 1000, oc_emitida_em: "2026-10-01", nf_numero: "1", nf_valor: 1300, nf_emissao: "2026-10-10", enviada_contabilidade_em: "2026-10-12" })],
      oficinas: [],
    });
    expect(l.nfAcimaOc).toBe(300);
    expect(l.etapa).toBe("concluida");
    expect(l.nivel).toBe("ok");
  });
});

describe("linhas de veículos", () => {
  it("gasto de 12 meses, últimas manutenções e valor em falta", () => {
    const ls = montarLinhasVeiculos({ ...base, veiculos: [veiculo("a"), veiculo("b", { valor_referencia: null })], manutencoes: [manutencao("a", { orcamento_valor: 700 }), manutencao("a", { orcamento_valor: 300, orcamento_recebido_em: "2024-01-01", analisado_em: "2024-01-02" })] });
    const a = ls.find((l) => l.id === "a")!;
    expect(a.gasto12m).toBe(700);
    expect(a.servicos12m).toBe(1);
    expect(a.ultimas).toHaveLength(2);
    expect(a.ano).toBe("2020/2021");
    expect(ls.find((l) => l.id === "b")!.semValor).toBe(true);
  });
});

describe("linhas de NFs", () => {
  it("separa as arquivadas (na Contabilidade há mais de 30 dias)", () => {
    const ls = montarLinhasNotas({
      ...base,
      postos: [],
      notas: [
        nota({ enviada_secretaria_em: "2026-11-05" }),
        nota({ enviada_secretaria_em: "2026-09-01", retornou_em: "2026-09-02", enviada_contabilidade_em: "2026-09-05" }),
        nota({ enviada_secretaria_em: "2026-11-01", retornou_em: "2026-11-02", enviada_contabilidade_em: "2026-11-15" }),
      ],
    });
    expect(ls.map((l) => l.situacao)).toEqual(["com_secretaria", "arquivada", "na_contabilidade"]);
    expect(ls[0].nivel).toBe("critico"); // 17 dias com a secretaria
    expect(DIAS_NF_ARQUIVADA).toBe(30);
  });
});
