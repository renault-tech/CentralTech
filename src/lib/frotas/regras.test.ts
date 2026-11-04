import { describe, expect, it } from "vitest";

import {
  avisosNota,
  chaveServico,
  custoManutencao,
  dataDoCusto,
  diasEntre,
  formatarData,
  nivelPorDias,
  nivelPorPercentual,
  passosManutencao,
  quinzenaAnterior,
  quinzenaDe,
  quinzenasRecentes,
  situacaoManutencao,
  situacaoNota,
  somarDias,
  subtrairMeses,
} from "@/lib/frotas/regras";

const P = { dias_atencao: 10, dias_critico: 15, pct_atencao: 50, pct_critico: 100 };

describe("datas", () => {
  it("conta dias de calendário", () => {
    expect(diasEntre("2026-10-12", "2026-11-04")).toBe(23);
    expect(diasEntre("2026-11-04", "2026-11-04")).toBe(0);
    expect(diasEntre("2026-11-04", "2026-10-31")).toBe(-4);
  });
  it("soma dias atravessando o mês e o ano", () => {
    expect(somarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("subtrai meses sem estourar o último dia", () => {
    expect(subtrairMeses("2026-11-04", 12)).toBe("2025-11-04");
    expect(subtrairMeses("2026-03-31", 1)).toBe("2026-02-28");
    expect(subtrairMeses("2026-01-15", 2)).toBe("2025-11-15");
  });
  it("formata a data", () => {
    expect(formatarData("2026-10-05")).toBe("05/10/2026");
    expect(formatarData(null)).toBe("—");
  });
});

describe("níveis de alerta", () => {
  it("por dias parado", () => {
    expect(nivelPorDias(9, P)).toBe("ok");
    expect(nivelPorDias(10, P)).toBe("atencao");
    expect(nivelPorDias(14, P)).toBe("atencao");
    expect(nivelPorDias(15, P)).toBe("critico");
  });
  it("por percentual do valor do veículo", () => {
    expect(nivelPorPercentual(49.9, P)).toBe("ok");
    expect(nivelPorPercentual(50, P)).toBe("atencao");
    expect(nivelPorPercentual(100, P)).toBe("critico");
  });
});

describe("quinzenas", () => {
  it("separa 1–15 e 16–fim do mês", () => {
    expect(quinzenaDe("2026-10-15")).toMatchObject({ inicio: "2026-10-01", fim: "2026-10-15" });
    expect(quinzenaDe("2026-10-16")).toMatchObject({ inicio: "2026-10-16", fim: "2026-10-31" });
    expect(quinzenaDe("2026-02-20")).toMatchObject({ inicio: "2026-02-16", fim: "2026-02-28" });
    expect(quinzenaDe("2024-02-20")).toMatchObject({ fim: "2024-02-29" });
  });
  it("volta quinzenas", () => {
    expect(quinzenaAnterior(quinzenaDe("2026-11-04"))).toMatchObject({ inicio: "2026-10-16", fim: "2026-10-31" });
    expect(quinzenaAnterior(quinzenaDe("2026-10-20"))).toMatchObject({ inicio: "2026-10-01", fim: "2026-10-15" });
    expect(quinzenaAnterior(quinzenaDe("2026-01-05"))).toMatchObject({ inicio: "2025-12-16", fim: "2025-12-31" });
    expect(quinzenasRecentes("2026-11-04", 3).map((q) => q.inicio)).toEqual(["2026-11-01", "2026-10-16", "2026-10-01"]);
  });
  it("a quinzena cabe na regra do banco (no máximo 16 dias entre início e fim)", () => {
    for (const dia of ["2026-01-31", "2026-03-31", "2026-12-31"]) {
      const q = quinzenaDe(dia);
      expect(diasEntre(q.inicio, q.fim)).toBeLessThanOrEqual(16);
    }
  });
});

describe("situação da NF de combustível", () => {
  const base = { data_emissao: "2026-10-15", enviada_secretaria_em: null, retornou_em: null, enviada_contabilidade_em: null };
  it("percorre as quatro etapas", () => {
    expect(situacaoNota(base)).toMatchObject({ etapa: "recebida", desde: "2026-10-15", pendente: true });
    expect(situacaoNota({ ...base, enviada_secretaria_em: "2026-10-20" })).toMatchObject({ etapa: "com_secretaria", desde: "2026-10-20" });
    expect(situacaoNota({ ...base, enviada_secretaria_em: "2026-10-20", retornou_em: "2026-10-28" })).toMatchObject({
      etapa: "assinada",
      desde: "2026-10-28",
    });
    expect(
      situacaoNota({ ...base, enviada_secretaria_em: "2026-10-20", retornou_em: "2026-10-28", enviada_contabilidade_em: "2026-10-29" })
    ).toMatchObject({ etapa: "na_contabilidade", pendente: false });
  });
  it("avisa datas fora de ordem sem bloquear", () => {
    const n = { ...base, periodo_inicio: "2026-10-01", periodo_fim: "2026-10-15" };
    expect(avisosNota(n)).toEqual([]);
    expect(avisosNota({ ...n, enviada_secretaria_em: "2026-10-10" })).toHaveLength(1);
    expect(avisosNota({ ...n, data_emissao: "2026-09-30" })).toEqual(["A emissão é anterior ao início da quinzena."]);
  });
});

const man = {
  status_analise: "a_analisar" as const,
  orcamento_recebido_em: "2026-11-02",
  analisado_em: null as string | null,
  oc_numero: null as string | null,
  oc_emitida_em: null as string | null,
  oc_enviada_em: null as string | null,
  nf_numero: null as string | null,
  nf_emissao: null as string | null,
  docs_retornaram_em: null as string | null,
  enviada_contabilidade_em: null as string | null,
};

describe("situação da manutenção", () => {
  it("percorre o fluxo inteiro", () => {
    expect(situacaoManutencao(man)).toMatchObject({ etapa: "a_analisar", desde: "2026-11-02" });
    const lib = { ...man, status_analise: "liberado" as const, analisado_em: "2026-11-03" };
    expect(situacaoManutencao(lib)).toMatchObject({ etapa: "liberada", desde: "2026-11-03" });
    expect(situacaoManutencao({ ...lib, oc_numero: "1841/2026" })).toMatchObject({ etapa: "oc_emitida", desde: "2026-11-03" });
    expect(situacaoManutencao({ ...lib, oc_numero: "1841/2026", oc_enviada_em: "2026-11-04" })).toMatchObject({
      etapa: "aguardando_nf",
      desde: "2026-11-04",
    });
    const comNf = { ...lib, oc_numero: "1841/2026", oc_enviada_em: "2026-11-04", nf_numero: "N1", nf_emissao: "2026-11-10" };
    expect(situacaoManutencao(comNf)).toMatchObject({ etapa: "aguardando_docs", desde: "2026-11-10" });
    expect(situacaoManutencao({ ...comNf, docs_retornaram_em: "2026-11-11" })).toMatchObject({ etapa: "docs_retornaram" });
    expect(situacaoManutencao({ ...comNf, docs_retornaram_em: "2026-11-11", enviada_contabilidade_em: "2026-11-12" })).toMatchObject({
      etapa: "concluida",
      emAndamento: false,
    });
  });
  it("recusada e novo orçamento", () => {
    expect(situacaoManutencao({ ...man, status_analise: "recusado", analisado_em: "2026-11-03" })).toMatchObject({
      etapa: "recusada",
      emAndamento: false,
    });
    expect(situacaoManutencao({ ...man, status_analise: "novo_orcamento", analisado_em: "2026-11-03" })).toMatchObject({
      etapa: "novo_orcamento",
      desde: "2026-11-03",
    });
  });
  it("marca a etapa atual nos passos", () => {
    const passos = passosManutencao(man);
    expect(passos.map((p) => p.estado)).toEqual(["feito", "atual", "futuro", "futuro", "futuro", "futuro", "futuro", "futuro"]);
    const liberada = passosManutencao({ ...man, status_analise: "liberado", analisado_em: "2026-11-03", oc_numero: "1/2026" });
    expect(liberada.map((p) => p.estado)).toEqual(["feito", "feito", "feito", "feito", "atual", "futuro", "futuro", "futuro"]);
    expect(passosManutencao({ ...man, status_analise: "recusado", analisado_em: "2026-11-03" }).some((p) => p.estado === "atual")).toBe(false);
  });
});

describe("custo da manutenção", () => {
  it("só conta o liberado: NF, senão OC, senão o orçamento", () => {
    const base = { orcamento_valor: 1000, oc_valor: null as number | null, nf_valor: null as number | null };
    expect(custoManutencao({ ...base, status_analise: "a_analisar" })).toBeNull();
    expect(custoManutencao({ ...base, status_analise: "recusado" })).toBeNull();
    expect(custoManutencao({ ...base, status_analise: "liberado" })).toBe(1000);
    expect(custoManutencao({ ...base, status_analise: "liberado", oc_valor: 900 })).toBe(900);
    expect(custoManutencao({ ...base, status_analise: "liberado", oc_valor: 900, nf_valor: 850 })).toBe(850);
  });
  it("data do custo: a da NF, senão a da OC, senão a da liberação", () => {
    const m = { nf_emissao: null as string | null, oc_emitida_em: null as string | null, analisado_em: null as string | null, orcamento_recebido_em: "2026-01-02" };
    expect(dataDoCusto(m)).toBe("2026-01-02");
    expect(dataDoCusto({ ...m, analisado_em: "2026-01-05" })).toBe("2026-01-05");
    expect(dataDoCusto({ ...m, analisado_em: "2026-01-05", nf_emissao: "2026-02-01" })).toBe("2026-02-01");
  });
  it("compara serviços sem acento nem pontuação", () => {
    expect(chaveServico("  Troca de Embreagem. ")).toBe("troca de embreagem");
    expect(chaveServico("Suspensão/Freios")).toBe("suspensao freios");
  });
});
