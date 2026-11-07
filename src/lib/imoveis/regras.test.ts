import { describe, expect, it } from "vitest";

import {
  analisarConsumo,
  mascararDocumento,
  calcularPendencias,
  etapasDaEntrega,
  PARAMETROS_PADRAO,
  proximoVencimentoAluguel,
  semJustificadas,
  situacaoVigencia,
  somarMeses,
  ultimosMeses,
} from "./regras";
import type { Conta, Entrega, Imovel, Unidade } from "@/types/imoveis";

const par = PARAMETROS_PADRAO;
const serie = (valores: number[], fim = "2026-11-01") =>
  valores.map((consumo, i) => ({ referencia: somarMeses(fim, i - (valores.length - 1)), consumo, valor: consumo * 8 }));

describe("meses", () => {
  it("soma meses atravessando o ano", () => {
    expect(somarMeses("2026-11-01", 3)).toBe("2027-02-01");
    expect(somarMeses("2026-01-01", -1)).toBe("2025-12-01");
  });
  it("lista os últimos meses em ordem", () => {
    expect(ultimosMeses("2026-02-01", 3)).toEqual(["2025-12-01", "2026-01-01", "2026-02-01"]);
  });
});

describe("analisarConsumo", () => {
  it("aponta consumo 40%+ acima da média como crítico", () => {
    const a = analisarConsumo(serie([100, 100, 100, 100, 100, 100, 160]), par, "kWh");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ tipo: "acima", nivel: "critico" });
    expect(a[0].texto).toContain("+60%");
  });
  it("respeita o limite configurado", () => {
    const h = serie([100, 100, 100, 100, 100, 100, 160]);
    expect(analisarConsumo(h, { ...par, pct_acima: 80 })).toHaveLength(0);
  });
  it("aponta consumo muito abaixo como atenção", () => {
    const a = analisarConsumo(serie([100, 100, 100, 100, 100, 100, 40]), par);
    expect(a[0]).toMatchObject({ tipo: "abaixo", nivel: "atencao" });
  });
  it("não avalia com menos de 3 meses de histórico", () => {
    expect(analisarConsumo(serie([100, 100, 300]), par)).toEqual([]);
  });
  it("usa só a janela de meses configurada", () => {
    // média dos 2 últimos anteriores = 200; 230 está dentro de 40%
    const h = serie([10, 10, 10, 10, 200, 200, 230]);
    expect(analisarConsumo(h, { ...par, meses_media: 2 })).toHaveLength(0);
    expect(analisarConsumo(h, { ...par, meses_media: 6 })).not.toHaveLength(0);
  });
  it("detecta valor por unidade fora do padrão", () => {
    const h = serie([100, 100, 100, 100, 100, 100, 100]);
    h[6].valor = h[6].consumo! * 8 * 1.5;
    expect(analisarConsumo(h, par)[0]).toMatchObject({ tipo: "valor_unitario" });
  });
  it("ignora consumo zero na média e valor unitário sem consumo", () => {
    const h = serie([100, 0, 100, 100, 100, 100, 0]);
    expect(analisarConsumo(h, par).every((x) => x.tipo !== "valor_unitario")).toBe(true);
  });
});

describe("situacaoVigencia", () => {
  it("classifica por dias", () => {
    expect(situacaoVigencia("2026-12-02", "2026-11-05", par)).toMatchObject({ dias: 27, nivel: "critico" });
    expect(situacaoVigencia("2027-01-18", "2026-11-05", par)).toMatchObject({ nivel: "atencao" });
    expect(situacaoVigencia("2027-06-30", "2026-11-05", par)).toMatchObject({ nivel: "ok" });
    expect(situacaoVigencia("2026-10-31", "2026-11-05", par)).toMatchObject({ nivel: "vencido", dias: -5 });
    expect(situacaoVigencia(null, "2026-11-05", par).nivel).toBe("ok");
  });
  it("usa o prazo de aviso configurado", () => {
    expect(situacaoVigencia("2027-01-18", "2026-11-05", { dias_fim_contrato: 60 }).nivel).toBe("ok");
  });
});

describe("proximoVencimentoAluguel", () => {
  it("fica no mês quando o dia ainda não passou e vai ao próximo quando passou", () => {
    expect(proximoVencimentoAluguel(10, "2026-11-05")).toBe("2026-11-10");
    expect(proximoVencimentoAluguel(5, "2026-11-05")).toBe("2026-11-05");
    expect(proximoVencimentoAluguel(5, "2026-11-06")).toBe("2026-12-05");
  });
  it("ajusta para o último dia de meses curtos", () => {
    expect(proximoVencimentoAluguel(31, "2027-02-10")).toBe("2027-02-28");
  });
  it("sem dia, sem vencimento", () => {
    expect(proximoVencimentoAluguel(null, "2026-11-05")).toBeNull();
  });
});

describe("etapasDaEntrega", () => {
  const vazia = (o: Partial<Entrega> = {}): Entrega => ({
    id: "i", aviso_saida_em: null, agua_pedido_em: null, agua_protocolo: null, agua_desligada_em: null, luz_pedido_em: null, luz_protocolo: null,
    luz_desligada_em: null, chaves_entregues_em: null, chaves_entregue_por: null, chaves_recebida_por: null, vistoria_agendada_em: null, vistoriador: null,
    vistoria_concluida_em: null, vistoria_obs: null, titularidade_agua_em: null, titularidade_luz_em: null, encerrado_em: null, observacoes: null,
    criado_em: "", atualizado_em: "", ...o,
  });
  it("sem entrega aberta, tudo pendente", () => {
    expect(etapasDaEntrega(null).every((e) => e.estado === "pendente")).toBe(true);
  });
  it("marca a primeira não feita como 'agora'", () => {
    const et = etapasDaEntrega(vazia({ aviso_saida_em: "2026-10-02" }));
    expect(et.map((e) => e.estado).slice(0, 3)).toEqual(["feita", "agora", "pendente"]);
  });
  it("chaves entregues com água/luz ligadas viram alerta", () => {
    const et = etapasDaEntrega(vazia({ aviso_saida_em: "2026-06-15", chaves_entregues_em: "2026-08-31", agua_desligada_em: "2026-09-04" }));
    expect(et.find((e) => e.chave === "luz")!.estado).toBe("alerta");
    expect(et.find((e) => e.chave === "agua")!.estado).toBe("feita");
    expect(et.find((e) => e.chave === "titularidade")!.estado).toBe("alerta");
  });
});

describe("calcularPendencias", () => {
  const imovel = (o: Partial<Imovel> = {}): Imovel => ({
    id: "i1", nome: "CRAS", endereco: "Rua A", secretaria_id: "s1", setor: null, finalidade: null, situacao: "ativo", vinculo: "alugado", contrato_numero: null,
    vigencia_inicio: null, vigencia_fim: "2030-01-01", valor_aluguel: 1000, dia_vencimento: 5, indice_reajuste: null, proximo_reajuste: null, imobiliaria_id: null,
    proprietario_nome: null, proprietario_documento: null, proprietario_contato: null, proprietario_conta: null, observacoes: null, revisar_motivo: null, criado_em: "", atualizado_em: "", ...o,
  });
  const unid: Unidade = { id: "u1", imovel_id: "i1", tipo: "luz", numero: "UC 1", titular: null, ativa: true, criado_em: "", atualizado_em: "" };
  const conta = (referencia: string, consumo: number, o: Partial<Conta> = {}): Conta => ({
    id: `c${referencia}`, unidade_id: "u1", referencia, consumo, valor: consumo * 1, vencimento: null, pago_em: referencia, observacao: null, origem: "digitada", criado_em: "", atualizado_em: "", ...o,
  });
  const base = { unidades: [unid], entregas: [] as Entrega[], hoje: "2026-11-05", par };

  it("imóvel com dúvida de cadastro vira pendência de revisão e some quando é marcado como revisado", () => {
    const duvida = imovel({ revisar_motivo: "Endereço genérico.\nConfirmar o vínculo." });
    const p = calcularPendencias({ ...base, imoveis: [duvida], contas: [] }).find((x) => x.chave === "cadastro_revisar");
    expect(p).toMatchObject({ nivel: "atencao", titulo: "Cadastro para revisar", detalhe: "Endereço genérico. Confirmar o vínculo." });
    expect(calcularPendencias({ ...base, imoveis: [imovel()], contas: [] }).some((x) => x.chave === "cadastro_revisar")).toBe(false);
  });
  it("consumo acima do padrão vira pendência crítica", () => {
    const contas = [100, 100, 100, 100, 100, 100, 190].map((c, i) => conta(somarMeses("2026-11-01", i - 6), c));
    const p = calcularPendencias({ ...base, imoveis: [imovel()], contas });
    expect(p.find((x) => x.chave === "consumo_luz")).toMatchObject({ nivel: "critico" });
  });
  it("imóvel entregue com conta chegando é crítico", () => {
    const im = imovel({ situacao: "entregue", vigencia_fim: "2026-08-31" });
    const p = calcularPendencias({ ...base, imoveis: [im], contas: [conta("2026-10-01", 50)] });
    expect(p.some((x) => x.chave === "ligacao_ativa_luz" && x.nivel === "critico")).toBe(true);
  });
  it("sem conta do mês só cobra a partir do dia configurado", () => {
    const contas = [conta("2026-10-01", 100)];
    expect(calcularPendencias({ ...base, imoveis: [imovel()], contas }).some((x) => x.chave === "sem_conta_luz")).toBe(false);
    expect(calcularPendencias({ ...base, hoje: "2026-11-21", imoveis: [imovel()], contas }).some((x) => x.chave === "sem_conta_luz")).toBe(true);
  });
  it("conta paga ou dentro da tolerância não atrasa", () => {
    const aberta = conta("2026-10-01", 100, { pago_em: null, vencimento: "2026-11-03" });
    expect(calcularPendencias({ ...base, imoveis: [imovel()], contas: [aberta] }).some((x) => x.chave.startsWith("atraso_"))).toBe(false);
    const atrasada = conta("2026-10-01", 100, { pago_em: null, vencimento: "2026-10-20" });
    expect(calcularPendencias({ ...base, imoveis: [imovel()], contas: [atrasada] }).some((x) => x.chave.startsWith("atraso_"))).toBe(true);
  });
  it("chaves entregues sem desligamento é crítico", () => {
    const ent = { id: "i1", chaves_entregues_em: "2026-10-20", agua_desligada_em: null, luz_desligada_em: null, vistoria_agendada_em: null, encerrado_em: null } as Entrega;
    const p = calcularPendencias({ ...base, imoveis: [imovel({ situacao: "em_entrega" })], contas: [], entregas: [ent] });
    expect(p.find((x) => x.chave === "entrega_sem_desligamento")).toMatchObject({ nivel: "critico", detalhe: expect.stringContaining("água e luz") });
    expect(p.some((x) => x.chave === "vistoria_pendente")).toBe(true);
  });
  it("contrato vencendo respeita o parâmetro", () => {
    const im = imovel({ vigencia_fim: "2027-01-18" });
    expect(calcularPendencias({ ...base, imoveis: [im], contas: [] }).some((x) => x.chave === "contrato_vencendo")).toBe(true);
    expect(calcularPendencias({ ...base, par: { ...par, dias_fim_contrato: 30 }, imoveis: [im], contas: [] }).some((x) => x.chave === "contrato_vencendo")).toBe(false);
  });
  it("justificativa vale só enquanto a assinatura é a mesma", () => {
    const contas = [100, 100, 100, 100, 100, 100, 190].map((c, i) => conta(somarMeses("2026-11-01", i - 6), c));
    const p = calcularPendencias({ ...base, imoveis: [imovel()], contas });
    const alvo = p.find((x) => x.chave === "consumo_luz")!;
    expect(semJustificadas(p, [{ imovel_id: "i1", chave: alvo.chave, assinatura: alvo.assinatura }]).some((x) => x.chave === "consumo_luz")).toBe(false);
    expect(semJustificadas(p, [{ imovel_id: "i1", chave: alvo.chave, assinatura: "antiga" }]).some((x) => x.chave === "consumo_luz")).toBe(true);
  });
});

describe("mascararDocumento", () => {
  it("mascara CPF e CNPJ", () => {
    expect(mascararDocumento("123.456.789-09")).toBe("***.456.***-09");
    expect(mascararDocumento("12.345.678/0001-95")).toBe("**.***.678/0001-**");
    expect(mascararDocumento("")).toBe("—");
    expect(mascararDocumento("123")).toBe("***");
  });
});

describe("analisarConsumo sem consumo (só valor em reais)", () => {
  const sv = (valores: number[], fim = "2026-11-01") => valores.map((valor, i) => ({ referencia: somarMeses(fim, i - (valores.length - 1)), consumo: null, valor }));
  it("cai para o valor da conta e deixa claro na mensagem", () => {
    const a = analisarConsumo(sv([100, 100, 100, 100, 100, 100, 190]), par);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ tipo: "acima", base: "valor", nivel: "critico" });
    expect(a[0].texto).toMatch(/^Valor da conta \+90%/);
  });
  it("valor muito abaixo vira atenção", () => {
    expect(analisarConsumo(sv([100, 100, 100, 100, 100, 100, 30]), par)[0]).toMatchObject({ tipo: "abaixo", base: "valor", nivel: "atencao" });
  });
  it("não avalia valor por unidade quando não há consumo", () => {
    expect(analisarConsumo(sv([100, 100, 100, 100, 100, 100, 100]), par)).toEqual([]);
  });
  it("com consumo no histórico mas não na conta atual, usa o valor", () => {
    const h = [100, 100, 100, 100].map((consumo, i) => ({ referencia: somarMeses("2026-11-01", i - 4), consumo, valor: 800 }));
    h.push({ referencia: "2026-11-01", consumo: null as unknown as number, valor: 1600 });
    expect(analisarConsumo(h, par)[0]).toMatchObject({ base: "valor", tipo: "acima" });
  });
});

describe("pendência por valor", () => {
  it("título e chave deixam claro que é o valor da conta", () => {
    const unid = { id: "u1", imovel_id: "i1", tipo: "luz", numero: "UC 1", titular: null, ativa: true, criado_em: "", atualizado_em: "" } as Unidade;
    const im = { id: "i1", nome: "CRAS", endereco: "Rua A", secretaria_id: "s1", situacao: "ativo", vinculo: "proprio", valor_aluguel: 0, vigencia_fim: null, proximo_reajuste: null } as unknown as Imovel;
    const contas = [100, 100, 100, 100, 100, 100, 190].map((v, i) => ({ id: `c${i}`, unidade_id: "u1", referencia: somarMeses("2026-11-01", i - 6), consumo: null, valor: v, vencimento: null, pago_em: null })) as unknown as Conta[];
    const p = calcularPendencias({ imoveis: [im], unidades: [unid], contas, entregas: [], hoje: "2026-11-05", par });
    expect(p.find((x) => x.chave === "valor_conta_luz")).toMatchObject({ nivel: "critico", titulo: expect.stringContaining("Valor da conta") });
  });
});
