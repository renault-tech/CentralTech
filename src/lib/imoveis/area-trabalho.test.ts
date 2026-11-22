import { describe, expect, it } from "vitest";

import { assuntoDaPendencia, mesDeReferencia, montarLinhasEntregas, montarLinhasImoveis, montarLinhasPendencias } from "@/lib/imoveis/area-trabalho";
import { calcularPendencias, PARAMETROS_PADRAO } from "@/lib/imoveis/regras";
import type { Conta, Entrega, Imovel, SecretariaImoveis, Unidade } from "@/types/imoveis";

const HOJE = "2026-11-22";
const par = PARAMETROS_PADRAO;
const secretarias: SecretariaImoveis[] = [{ id: "s1", nome: "Saúde", ativa: true, criado_em: "" }];
const imovel = (id: string, o: Partial<Imovel> = {}): Imovel => ({
  id, nome: `Imóvel ${id}`, endereco: "Rua A", secretaria_id: "s1", setor: null, finalidade: null, situacao: "ativo", vinculo: "alugado", contrato_numero: "12/2025", vigencia_inicio: null,
  vigencia_fim: "2030-01-01", valor_aluguel: 1500, dia_vencimento: 5, indice_reajuste: "IPCA", proximo_reajuste: null, imobiliaria_id: null, proprietario_nome: "Maria", proprietario_documento: "12345678901",
  proprietario_contato: null, proprietario_conta: null, observacoes: null, revisar_motivo: null, criado_em: "", atualizado_em: "", ...o,
});
const unidade = (id: string, imovel_id: string, tipo: "luz" | "agua" = "luz"): Unidade => ({ id, imovel_id, tipo, numero: `N${id}`, titular: null, ativa: true, criado_em: "", atualizado_em: "" });
const conta = (unidade_id: string, referencia: string, valor: number): Conta => ({ id: `${unidade_id}${referencia}`, unidade_id, referencia, consumo: null, valor, vencimento: null, pago_em: referencia, observacao: null, origem: "planilha", criado_em: "", atualizado_em: "" });
const entrega = (id: string, o: Partial<Entrega> = {}): Entrega => ({
  id, aviso_saida_em: "2026-10-01", agua_pedido_em: null, agua_protocolo: null, agua_desligada_em: null, luz_pedido_em: null, luz_protocolo: null, luz_desligada_em: null, chaves_entregues_em: null,
  chaves_entregue_por: null, chaves_recebida_por: null, vistoria_agendada_em: null, vistoriador: null, vistoria_concluida_em: null, vistoria_obs: null, titularidade_agua_em: null, titularidade_luz_em: null,
  encerrado_em: null, observacoes: null, criado_em: "", atualizado_em: "", ...o,
});

describe("linhas de imóveis", () => {
  it("traz vigência, gasto do mês, proprietário mascarado e pendências do imóvel", () => {
    const imoveis = [imovel("a", { vigencia_fim: "2026-12-10" })];
    const unidades = [unidade("ua", "a", "luz"), unidade("ub", "a", "agua")];
    const contas = [conta("ua", "2026-11-01", 300), conta("ub", "2026-11-01", 80)];
    const pend = calcularPendencias({ imoveis, unidades, contas, entregas: [], hoje: HOJE, par });
    const [l] = montarLinhasImoveis({ hoje: HOJE, imoveis, unidades, contas, entregas: [], secretarias, par, imobiliarias: [], pendencias: pend });
    expect(l.vigencia).toMatchObject({ nivel: "critico", dias: 18 });
    expect(l.luz).toBe(300);
    expect(l.agua).toBe(80);
    expect(l.documento).toBe("***.456.***-01");
    expect(l.pendencias.some((p) => p.titulo === "Contrato perto do fim")).toBe(true);
    expect(l.unidades).toHaveLength(2);
  });
  it("sem data de fim e entregue têm níveis próprios", () => {
    const imoveis = [imovel("a", { vigencia_fim: null }), imovel("b", { situacao: "entregue" })];
    const ls = montarLinhasImoveis({ hoje: HOJE, imoveis, unidades: [], contas: [], entregas: [], secretarias, par, imobiliarias: [], pendencias: [] });
    expect(ls.map((l) => l.vigencia.nivel)).toEqual(["sem_fim", "entregue"]);
  });
  it("mês de referência: a conta mais recente sem passar do mês corrente", () => {
    expect(mesDeReferencia([conta("u", "2026-10-01", 1), conta("u", "2027-02-01", 1)], HOJE)).toBe("2026-10-01");
    expect(mesDeReferencia([], HOJE)).toBe("2026-11-01");
  });
});

describe("linhas de pendências", () => {
  it("assunto pela chave e justificativa só quando a assinatura ainda vale", () => {
    expect(assuntoDaPendencia("consumo_luz")).toBe("consumo");
    expect(assuntoDaPendencia("valor_conta_agua")).toBe("consumo");
    expect(assuntoDaPendencia("contrato_vencido")).toBe("contrato");
    expect(assuntoDaPendencia("ligacao_ativa_luz")).toBe("entrega");
    expect(assuntoDaPendencia("sem_conta_agua")).toBe("conta");
    expect(assuntoDaPendencia("cadastro_revisar")).toBe("cadastro");
    expect(assuntoDaPendencia("qualquer")).toBe("outro");
    const imoveis = [imovel("a", { revisar_motivo: "Conferir" }), imovel("b", { vigencia_fim: "2026-11-01" })];
    const todas = calcularPendencias({ imoveis, unidades: [], contas: [], entregas: [], hoje: HOJE, par });
    const rev = todas.find((p) => p.chave === "cadastro_revisar")!;
    const ls = montarLinhasPendencias({
      imoveis, secretarias, todas,
      justificadas: [{ imovel_id: "a", chave: "cadastro_revisar", assinatura: rev.assinatura, justificativa: "Está certo", usuario_id: null, em: "2026-11-10T12:00:00Z" }, { imovel_id: "b", chave: "contrato_vencido", assinatura: "antiga", justificativa: "x", usuario_id: null, em: "2026-01-01T00:00:00Z" }],
    });
    expect(ls.find((l) => l.chave === "cadastro_revisar")?.justificada).toEqual({ em: "2026-11-10", texto: "Está certo" });
    expect(ls.find((l) => l.chave === "contrato_vencido")?.justificada).toBeNull();
  });
});

describe("linhas de entregas", () => {
  it("lista imóveis em entrega, progresso, alerta e as etapas; entregues por último", () => {
    const imoveis = [imovel("a", { situacao: "entregue" }), imovel("b", { situacao: "em_entrega" }), imovel("c")];
    const ls = montarLinhasEntregas({ hoje: HOJE, imoveis, unidades: [], contas: [], secretarias, par, pendencias: [], entregas: [entrega("b", { chaves_entregues_em: "2026-11-10" })] });
    expect(ls.map((l) => l.id)).toEqual(["b", "a"]);
    expect(ls[0]).toMatchObject({ alerta: true, total: 8, diasDesdeAviso: 52 });
    expect(ls[0].proxima).toBe("Desligamento da água");
    expect(ls[0].etapas).toHaveLength(8);
  });
});
