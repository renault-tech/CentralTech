import { describe, expect, it } from "vitest";

import { agrupar, filtrar, FILTROS_VAZIOS, ordenar, pagamentosPorMes, partes, situacaoPublica, totais } from "@/lib/emendas/portal-agregados";
import { diferencas, estadoDe, htmlDoBoletim } from "@/lib/emendas/portal-boletim";
import type { LinhaPortal } from "@/lib/emendas/portal-tipos";
import { cnpjValido, contarPorGravidade, itensFaltando, verificarPortal, type MetaVerificacao } from "@/lib/emendas/portal-verificacao";

const base: LinhaPortal = {
  numero: 1, ano: 2026, vereador: "Ana", partido: "XYZ", unidadeParlamentar: "Câmara", leiLoa: "Lei 1/2025", municipio: "Cataguases", municipioCnpj: "11.222.333/0001-81",
  objeto: "Reforma da praça do bairro Centro", descricao: "Reforma completa da praça", localidade: "Centro", valor: 1000, saude: false, tipo: "osc",
  secretaria: "Obras", unidade: "02.01 U", funcional: null, natureza: "3.3.50.43", gnd: "GND 3", categoria: "Despesa corrente",
  beneficiario: "Associação", cnpj: "11.222.333/0001-81", etapa: "paga", situacao: "normal", empenhado: 1000, liquidado: 1000, pago: 1000, ultimoPagamento: "2026-05-01",
  movimentos: [{ tipo: "empenho", data: "2026-02-01", valor: 1000, numero: "55" }, { tipo: "pagamento", data: "2026-05-01", valor: 1000, numero: "9" }],
  termo: "9/2026", processo: "2026/0062", contrato: null, inicioPrevisto: "2026-02-01", terminoPrevisto: "2026-12-31", vigenciaInicio: null, vigenciaFim: null, extratoPublicadoEm: "2026-02-10",
  conta: "CAIXA AG 0108 CONTA 1234-5", gestorPrefeitura: "Fulano", gestorEntidade: "Beltrano", anuenciaSus: null, identificadorContabil: "EM-1", fonteRecurso: "1500",
  planoMetas: null, planoOutrasFontes: null, documentos: [{ id: "d1", tipo: "plano_trabalho", rotulo: "Plano de trabalho", competencia: null, nome: "p.pdf" }], impedimento: null,
};
const l = (o: Partial<LinhaPortal>): LinhaPortal => ({ ...base, ...o });
const meta: MetaVerificacao = { ano: 2026, cota: 5000, saudeMinPct: 50, leiLoa: "Lei 1/2025", municipio: "Cataguases", municipioCnpj: "11.222.333/0001-81", unidadeParlamentar: "Câmara", vereadoresSemPartido: [] };

describe("agregados do portal", () => {
  it("situação pública e partes somam o valor", () => {
    expect(situacaoPublica(base)).toBe("paga");
    expect(situacaoPublica(l({ pago: 100 }))).toBe("parcial");
    expect(situacaoPublica(l({ pago: 0 }))).toBe("empenhada");
    expect(situacaoPublica(l({ pago: 0, empenhado: 0 }))).toBe("aguardando");
    expect(situacaoPublica(l({ situacao: "impedida" }))).toBe("impedida");
    const p = partes(l({ pago: 200, empenhado: 700 }));
    expect(p).toEqual({ pago: 200, aPagar: 500, aEmpenhar: 300, total: 1000 });
    expect(p.pago + p.aPagar + p.aEmpenhar).toBe(p.total);
  });
  it("totais, grupos e filtros batem", () => {
    const ls = [base, l({ numero: 2, vereador: "Bia", valor: 500, pago: 0, empenhado: 0, saude: true })];
    const t = totais(ls);
    expect(t.total).toBe(1500);
    expect(t.saude).toBe(500);
    expect(t.porSituacao.aguardando.quantidade).toBe(1);
    expect(agrupar(ls, (x) => x.vereador).map((g) => g.nome)).toEqual(["Ana", "Bia"]);
    expect(filtrar(ls, { ...FILTROS_VAZIOS, area: "saude" })).toHaveLength(1);
    expect(filtrar(ls, { ...FILTROS_VAZIOS, busca: "praca centro" })).toHaveLength(2);
    expect(filtrar(ls, { ...FILTROS_VAZIOS, situacao: "paga" }).map((x) => x.numero)).toEqual([1]);
    expect(ordenar(ls, "valor_asc")[0].numero).toBe(2);
    expect(ordenar(ls, "pendente_desc")[0].numero).toBe(2);
  });
  it("curva acumulada por mês, separando pagamento sem data", () => {
    const ls = [base, l({ numero: 2, movimentos: [{ tipo: "pagamento", data: null, valor: 30, numero: null }] })];
    const { pontos, semData } = pagamentosPorMes(ls, 2026);
    expect(pontos[3].acumulado).toBe(0);
    expect(pontos[4].pago).toBe(1000);
    expect(pontos[11].acumulado).toBe(1000);
    expect(semData).toBe(30);
  });
});

describe("verificação antes de publicar", () => {
  it("emenda completa não gera alerta crítico nem de atenção", () => {
    const a = verificarPortal([base], { ...meta, saudeMinPct: 0 }, "2026-11-11");
    expect(a.filter((x) => x.gravidade !== "info")).toEqual([]);
    expect(itensFaltando(base)).toEqual([]);
  });
  it("aponta CPF em texto público, valores incoerentes, CNPJ inválido e conta repetida", () => {
    const ls = [
      l({ numero: 1, descricao: "Contato: João, CPF 123.456.789-09" }),
      l({ numero: 2, pago: 1200, empenhado: 1100, valor: 1000 }),
      l({ numero: 3, cnpj: "11.111.111/1111-11", conta: "CAIXA AG 0108 CONTA 1234-5" }),
    ];
    const ids = verificarPortal(ls, { ...meta, cota: 999999 }, "2026-11-11").filter((x) => x.gravidade === "critico").map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(["lgpd_cpf", "empenho_maior_valor", "pago_maior_empenho", "cnpj_invalido", "conta_repetida"]));
  });
  it("não confunde CNPJ com CPF", () => {
    expect(verificarPortal([l({ descricao: "CNPJ 11.222.333/0001-81" })], meta, "2026-11-11").some((x) => x.id === "lgpd_cpf")).toBe(false);
  });
  it("executada sem publicidade completa é crítica; faltas do art. 7º são atenção", () => {
    const a = verificarPortal([l({ localidade: null, anuenciaSus: null, saude: true })], meta, "2026-11-11");
    expect(a.find((x) => x.id === "executada_sem_publicidade")?.gravidade).toBe("critico");
    expect(a.find((x) => x.id === "localidade")?.gravidade).toBe("atencao");
    expect(a.find((x) => x.id === "sus")?.emendas).toEqual([1]);
  });
  it("emenda ainda sem execução: itens do § 2º viram aviso informativo; emenda em execução continua em atenção", () => {
    const futura = l({ numero: 7, empenhado: 0, liquidado: 0, pago: 0, movimentos: [], ultimoPagamento: null, documentos: [], gestorPrefeitura: null, gestorEntidade: null, conta: null, termo: null, extratoPublicadoEm: null });
    const a = verificarPortal([futura], { ...meta, saudeMinPct: 0 }, "2026-11-11");
    expect(a.find((x) => x.id === "plano")).toBeUndefined();
    expect(a.find((x) => x.id === "plano:antes")).toMatchObject({ gravidade: "info", emendas: [7] });
    expect(a.find((x) => x.id === "gestor:antes")?.emendas).toEqual([7]);
    expect(a.find((x) => x.id === "executada_sem_publicidade")).toBeUndefined();
    expect(contarPorGravidade(a).critico).toBe(0);
    const emExecucao = verificarPortal([l({ numero: 8, documentos: [], gestorPrefeitura: null, gestorEntidade: null })], { ...meta, saudeMinPct: 0 }, "2026-11-11");
    expect(emExecucao.find((x) => x.id === "plano")).toMatchObject({ gravidade: "atencao", emendas: [8] });
    expect(emExecucao.find((x) => x.id === "plano:antes")).toBeUndefined();
  });
  it("cota excedida, dados do exercício e relatório de gestão vencido", () => {
    const a = verificarPortal([base, l({ numero: 2, valor: 4500, pago: 0, empenhado: 0 })], { ...meta, leiLoa: null, municipio: null, vereadoresSemPartido: ["Ana"] }, "2027-07-01");
    const ids = a.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(["cota_excedida", "ex:loa", "ex:municipio", "ex:partido", "relatorio_vencido"]));
    expect(contarPorGravidade(a).critico).toBeGreaterThan(0);
  });
  it("valida CNPJ pelos dígitos", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("00.000.000/0000-00")).toBe(false);
  });
});

describe("boletim por e-mail", () => {
  it("só o que mudou: nova emenda, pagamento, fase e impedimento", () => {
    const antes = [estadoDe(l({ numero: 1, pago: 0, empenhado: 1000 })), estadoDe(l({ numero: 2, etapa: "indicada", pago: 0, empenhado: 0 })), estadoDe(l({ numero: 3 }))];
    const agora = [l({ numero: 1 }), l({ numero: 2, etapa: "empenhada", pago: 0, empenhado: 0, situacao: "impedida" }), l({ numero: 3 }), l({ numero: 4 })];
    const m = diferencas(antes, agora, (c) => c.toUpperCase());
    expect(m.map((x) => `${x.numero}:${x.tipo}`)).toEqual(["1:pagamento", "2:fase", "2:impedimento", "4:nova"]);
  });
  it("e-mail escapa o texto vindo do cadastro", () => {
    const { html } = htmlDoBoletim({ ano: 2026, mudancas: [{ tipo: "nova", numero: 1, vereador: "<b>x</b>", objeto: "a & b", valor: 1 }], urlPortal: "https://p", urlCancelar: "https://c" });
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("a &amp; b");
    expect(html).toContain("https://c");
  });
});
