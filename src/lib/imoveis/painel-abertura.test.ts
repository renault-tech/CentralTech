import { describe, expect, it } from "vitest";

import { montarPainelImoveis } from "@/lib/imoveis/painel-abertura";
import { calcularPendencias, PARAMETROS_PADRAO, semJustificadas, somarMeses } from "@/lib/imoveis/regras";
import type { Conta, Entrega, Imovel, SecretariaImoveis, Unidade } from "@/types/imoveis";

const HOJE = "2026-11-22";
const par = PARAMETROS_PADRAO;
const SECRETARIAS: SecretariaImoveis[] = [
  { id: "s1", nome: "Saúde", ativa: true, criado_em: "" },
  { id: "s2", nome: "Educação", ativa: true, criado_em: "" },
];

const imovel = (id: string, o: Partial<Imovel> = {}): Imovel => ({
  id, nome: `Imóvel ${id}`, endereco: "Rua A", secretaria_id: "s1", setor: null, finalidade: null, situacao: "ativo", vinculo: "alugado", contrato_numero: null, vigencia_inicio: null,
  vigencia_fim: "2030-01-01", valor_aluguel: 1000, dia_vencimento: 5, indice_reajuste: null, proximo_reajuste: null, imobiliaria_id: null, proprietario_nome: null,
  proprietario_documento: null, proprietario_contato: null, proprietario_conta: null, observacoes: null, revisar_motivo: null, criado_em: "", atualizado_em: "", ...o,
});
const unidade = (id: string, imovel_id: string, tipo: "luz" | "agua" = "luz"): Unidade => ({ id, imovel_id, tipo, numero: `N${id}`, titular: null, ativa: true, criado_em: "", atualizado_em: "" });
const conta = (unidade_id: string, referencia: string, valor: number, o: Partial<Conta> = {}): Conta => ({
  id: `${unidade_id}-${referencia}`, unidade_id, referencia, consumo: null, valor, vencimento: null, pago_em: referencia, observacao: null, origem: "planilha", criado_em: "2026-11-20T10:00:00Z", atualizado_em: "", ...o,
});
const serie = (unidade_id: string, valores: number[], fim = "2026-11-01") => valores.map((v, i) => conta(unidade_id, somarMeses(fim, i - (valores.length - 1)), v));

function monta(p: { imoveis: Imovel[]; unidades: Unidade[]; contas: Conta[]; entregas?: Entrega[] }) {
  const entregas = p.entregas ?? [];
  const todas = calcularPendencias({ imoveis: p.imoveis, unidades: p.unidades, contas: p.contas, entregas, hoje: HOJE, par });
  return montarPainelImoveis({ hoje: HOJE, imoveis: p.imoveis, unidades: p.unidades, contas: p.contas, entregas, secretarias: SECRETARIAS, pendencias: semJustificadas(todas, []), par });
}

describe("painel de abertura de Imóveis", () => {
  it("soma aluguel, luz e água do mês mais recente e compara com a média dos 3 anteriores", () => {
    const p = monta({
      imoveis: [imovel("a", { valor_aluguel: 2000 }), imovel("b", { valor_aluguel: 500 })],
      unidades: [unidade("ua", "a", "luz"), unidade("ub", "b", "agua")],
      contas: [...serie("ua", [100, 100, 100, 100, 110]), ...serie("ub", [50, 50, 50, 50, 60])],
    });
    expect(p.referencia).toBe("2026-11-01");
    expect(p.totais).toEqual({ aluguel: 2500, luz: 110, agua: 60, total: 2670 });
    expect(p.variacaoLuz?.fracao).toBeCloseTo(0.1, 5);
    expect(p.variacaoLuz?.texto).toBe("10% acima da média dos 3 meses anteriores");
    expect(p.variacaoAgua?.fracao).toBeCloseTo(0.2, 5);
  });

  it("sem histórico suficiente não compara", () => {
    const p = monta({ imoveis: [imovel("a")], unidades: [unidade("ua", "a")], contas: [conta("ua", "2026-11-01", 100)] });
    expect(p.variacaoLuz).toBeNull();
    expect(p.variacaoTotal).toBeNull();
  });

  it("usa o mês da conta mais recente, sem passar do mês corrente", () => {
    const p = monta({ imoveis: [imovel("a")], unidades: [unidade("ua", "a")], contas: [conta("ua", "2026-10-01", 80), conta("ua", "2027-01-01", 999)] });
    expect(p.referencia).toBe("2026-10-01");
    expect(p.totais.luz).toBe(80);
  });

  it("conta quanto foi lançado no mês e quem falta, por secretaria", () => {
    const p = monta({
      imoveis: [imovel("a", { secretaria_id: "s1" }), imovel("b", { secretaria_id: "s2" }), imovel("c", { secretaria_id: "s2" })],
      unidades: [unidade("ua", "a"), unidade("ub", "b"), unidade("uc", "c"), unidade("ud", "c", "agua")],
      contas: [conta("ua", "2026-11-01", 100)],
    });
    expect(p.contasDoMes.find((c) => c.tipo === "luz")).toEqual({ tipo: "luz", total: 3, lancadas: 1 });
    expect(p.contasDoMes.find((c) => c.tipo === "agua")).toEqual({ tipo: "agua", total: 1, lancadas: 0 });
    expect(p.semLancamento.unidades).toBe(3);
    expect(p.semLancamento.porSecretaria[0]).toMatchObject({ nome: "Educação", faltam: 3 });
  });

  it("lista as contas fora do padrão com a variação e agrupa a pendência em 'Precisa da sua atenção'", () => {
    const p = monta({
      imoveis: [imovel("a")],
      unidades: [unidade("ua", "a")],
      contas: serie("ua", [100, 100, 100, 100, 100, 100, 200]),
    });
    expect(p.foraDoPadrao).toHaveLength(1);
    expect(p.foraDoPadrao[0].variacao).toBeCloseTo(100, 5);
    expect(p.foraDoPadrao[0]).toMatchObject({ tipo: "luz", base: "valor" });
    const item = p.atencao.find((i) => i.chave === "fora_padrao");
    expect(item).toMatchObject({ quantidade: 1, gravidade: "alta" });
    expect(item?.detalhe).toContain("1 de luz");
  });

  it("só mostra em 'atenção' o que tem quantidade, com o mais grave primeiro", () => {
    const p = monta({
      imoveis: [imovel("a", { vigencia_fim: "2026-11-01" }), imovel("b", { revisar_motivo: "Conferir" })],
      unidades: [],
      contas: [],
    });
    expect(p.atencao.map((i) => i.chave)).toEqual(["contratos", "revisar"]);
    expect(p.atencao[0]).toMatchObject({ gravidade: "alta", quantidade: 1, detalhe: "1 vencido" });
    expect(p.atencao.every((i) => i.quantidade > 0)).toBe(true);
  });

  it("separa os contratos por situação", () => {
    const p = monta({
      imoveis: [
        imovel("a", { vigencia_fim: "2026-11-10" }), // vencido
        imovel("b", { vigencia_fim: "2026-12-10" }), // até 30 dias
        imovel("c", { vigencia_fim: "2027-01-31" }), // dentro de 90
        imovel("d", { vigencia_fim: "2029-01-01" }), // vigente
        imovel("e", { vigencia_fim: null }),
        imovel("f", { vigencia_fim: "2026-11-01", situacao: "entregue" }), // entregue não conta
      ],
      unidades: [],
      contas: [],
    });
    expect(p.contratos).toMatchObject({ vencidos: 1, ate30: 1, ateLimite: 1, vigentes: 1, semFim: 1, limiteDias: 90 });
  });

  it("entregas em andamento: quanto já foi feito e qual é a próxima etapa", () => {
    const e = (o: Partial<Entrega>): Entrega => ({
      id: "x", aviso_saida_em: null, agua_pedido_em: null, agua_protocolo: null, agua_desligada_em: null, luz_pedido_em: null, luz_protocolo: null, luz_desligada_em: null, chaves_entregues_em: null,
      chaves_entregue_por: null, chaves_recebida_por: null, vistoria_agendada_em: null, vistoriador: null, vistoria_concluida_em: null, vistoria_obs: null, titularidade_agua_em: null,
      titularidade_luz_em: null, encerrado_em: null, observacoes: null, criado_em: "", atualizado_em: "", ...o,
    });
    const p = monta({
      imoveis: [imovel("a", { situacao: "em_entrega" }), imovel("b", { situacao: "em_entrega" })],
      unidades: [],
      contas: [],
      entregas: [e({ id: "a", aviso_saida_em: "2026-10-01" }), e({ id: "b", aviso_saida_em: "2026-10-01", chaves_entregues_em: "2026-11-10" })],
    });
    expect(p.entregas).toHaveLength(2);
    expect(p.entregas[0]).toMatchObject({ id: "b", alerta: true }); // chaves entregues com água ligada: alerta primeiro
    expect(p.entregas[1]).toMatchObject({ id: "a", feitas: 1, alerta: false, proxima: "Desligamento da água" });
    expect(p.imoveis.emEntrega).toBe(2);
  });

  it("gasto por secretaria e 12 meses", () => {
    const p = monta({
      imoveis: [imovel("a", { secretaria_id: "s1", valor_aluguel: 3000 }), imovel("b", { secretaria_id: "s2", valor_aluguel: 1000 })],
      unidades: [unidade("ua", "a"), unidade("ub", "b", "agua")],
      contas: [conta("ua", "2026-11-01", 400), conta("ub", "2026-11-01", 100)],
    });
    expect(p.mensais).toHaveLength(12);
    expect(p.porSecretaria.map((s) => [s.nome, s.total])).toEqual([["Saúde", 3400], ["Educação", 1100]]);
  });

  it("o que vence: fim de contrato, reajuste e faturas, em ordem de data", () => {
    const p = monta({
      imoveis: [
        imovel("a", { vigencia_fim: "2026-12-01" }), // 9 dias
        imovel("b", { proximo_reajuste: "2026-11-25", vigencia_fim: "2030-01-01" }), // 3 dias
      ],
      unidades: [unidade("ua", "a")],
      contas: [conta("ua", "2026-11-01", 100, { vencimento: "2026-11-30", pago_em: null })], // 8 dias
    });
    expect(p.prazos.map((x) => x.dias)).toEqual([3, 8, 9]);
    expect(p.prazos[0].titulo).toContain("Reajuste");
  });

  it("devolve os limites configurados", () => {
    expect(monta({ imoveis: [], unidades: [], contas: [] }).limites).toEqual({ pctAcima: 40, pctSecretaria: 20, diaLancamento: 20, diasFimContrato: 90 });
  });
});
