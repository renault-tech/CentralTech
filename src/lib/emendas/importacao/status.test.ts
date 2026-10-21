import { describe, expect, it } from "vitest";

import { lerDotacao, lerStatus, resumirObjeto } from "@/lib/emendas/importacao/status";
import { interpretarLinhas } from "@/lib/emendas/importacao/planilha";

// As 63 grafias REAIS da coluna STATUS da planilha de 2026, como estavam.
const REAIS: [number, string][] = [
  [1, "EXECUTADA - EMP: 3931 - DP: 26/03/2026"], [16, "EXECUTADA - EMP: 32855 - DP 31/08/2026"],
  [19, "EXECUTADA - EMP: 6123 DP 20/05/2026"], [24, "EXECUTADA - EMP: 8565 - DP 27/07/2026"],
  [30, "EXECUTADA - EMP: 3929 - DP 25/03/2026"], [36, "EXECUTADA - EMP: 32828  "],
  [40, "EXECUTADA - EMP: 32832 - DP 04/08/2026"], [41, "EXECUTADA - EMP: 32834 - DP 04/08/2026"],
  [43, "EXECUTADA - EMP8677 DP 29/07/2026"], [44, "EXECUTADA - EMP: 3394 - DP 25/03/2026"],
  [51, "EXECUTADA EMP: 7169 DP 16/06/2026"], [54, "EXECUTADA - EMP: 8566 DP 27/07/2026"],
  [60, "EXECUTADA - EMP: 3940 DP 25/03/2026"], [72, "EXECUTADA - EMP 6365 DP 05/08/2026"],
  [73, "XECUTADA - EMP: 3946"], [80, "EXECUTADA - EMP 32829 DP "],
  [82, "EXECUTADA - EMP: 3935 DP 25/03/2026"], [83, "EXECUTADA - EMP7207 - DP 12/06/2026"],
  [85, "EXECUTADA - EMP8616 - DP 20/07/2026"], [87, "EXECUTADA - EMP32823 - DP 29/07/2026"],
  [88, "EXECUTADA - EMP: 32842 - DP 20/08/2026"], [90, "EXECUTADA - AINDA NÃO TEM NUMERO DE EMPENHO"],
  [91, "EXECUTADA - EMP: 32858 - DP 27/07/2026"], [94, "EXECUTADA - EMP 7207 - DP 12/06/2026"],
  [95, "EXECUTADA - EMP 3932 - DP 26/03/2026"], [101, "EXECUTADA - EMP 8612 DP 27/07/2026"],
  [102, "  EXECUTADA - Nº EMPENHO 2328 - DP 12/02/2026"], [103, "EXECUTADA - EMP 8590 DP 20/07/2026"],
  [104, "EXECUTADA - 9283 DP 29/07/2026"], [106, "EXECUTADA - EMP: 8613 DP 20/07/2026"],
  [108, "EXECUTADA - EMP: 8564 DP 17/07/2026"], [113, "EXECUTADA - EMP: 32861 DP "],
  [118, "EXECUTADA - EMP: 3937 DP 26/03/2026"], [125, "EXECUTADA - EMP: 3936 DP 25/03/2026"],
  [133, "EXECUTADA - EMP: 32833 DP 04/08/2026"], [136, "EXECUTADA - EMP: 3941 DP 25/03/2026"],
  [137, "EXECUTADA - EMP: 37860 DP 06/08/2026"], [139, "EXECUTADA - EMP: 9284 - DP 18/08/2026"],
  [140, "EXECUTADA - EMP: 3938 DP 25/03/2026 "], [142, "EXECUTADA - EMP: 8835 DP 31/07/2026"],
  [143, "EXECUTADA - EMP: 6366 DP 05/08/2026"], [144, "EXECUTADA - EMP: 6366 DP 05/04/2026"],
  [146, "EXECUTADA EMP: 3939 DP 25/03/2026"], [148, "EXECUTADA EMP: 32847 DP 20/05/2026"],
  [150, "EXECUTADA - EMP: 5797 DP 19/06/2026"], [152, "EXECUTADA - EMP:32845 DP 14/08/2026 "],
  [156, "EXECUTADA - EMP: 5611 DP 19/06/2026"], [159, "EXECUTADA - EMP: 32835 DP 04/08/2026"],
  [167, "EXECUTADA - "], [168, " EXECUTADA - EMP 32831 - DP 04/08/2026\n"],
  [169, "   EXECUTADA - EMP 32830 -DP: 30/07/2026"], [177, "EXECUTADA - EMP: 3928 DP - 25/03/2026"],
  [182, "EXECUÇÃO - EMP: 32844 DP 20/08/2026"], [187, "EXECUTADO - EMP 8836 DP 31/07/2026"],
  [189, "EXECUTADO - EMP: 9415 DP 19/08/2026"], [191, "EXECUTADO - EMP 3933 DP 26/03/2026"],
  [201, "EXECUTADO EMP 4325 DP 29/04/2026"], [204, "EXECUTADO - EMP 3904 DP 26/03/2026"],
  [206, "EXECUTADO - EMP:  32848 DP 30/06/2026"], [208, "EXECUTADO  - EMP : 3903 DP 25/03/2026"],
  [209, "EXECUTADO  - EMP: 32859 - DP 30/06/2026"], [210, "EXECUTADO - EMP: 32843 DP 14/08/2026"],
  [214, "EXECUTADO - EMP:V 32856 DP 31/08/2026"],
];

describe("lerStatus — grafias reais da planilha 2026", () => {
  const lidos = new Map(REAIS.map(([n, s]) => [n, lerStatus(s)]));

  it("62 pagas e 1 em execução (empenhada)", () => {
    const etapas = Array.from(lidos.values()).map((l) => l.etapa);
    expect(etapas.filter((e) => e === "paga")).toHaveLength(62);
    expect(lidos.get(182)?.etapa).toBe("empenhada");
  });

  it("só as nº 90 e 167 ficam sem número de empenho", () => {
    const sem = REAIS.filter(([n]) => !lidos.get(n)?.empenho).map(([n]) => n);
    expect(sem).toEqual([90, 167]);
  });

  it("lê as variações de escrita do empenho", () => {
    expect(lidos.get(43)?.empenho).toBe("8677"); // EMP8677
    expect(lidos.get(102)?.empenho).toBe("2328"); // Nº EMPENHO 2328
    expect(lidos.get(104)?.empenho).toBe("9283"); // "- 9283" sem "EMP"
    expect(lidos.get(208)?.empenho).toBe("3903"); // "EMP : 3903"
    expect(lidos.get(214)?.empenho).toBe("32856"); // "EMP:V 32856"
  });

  it("data de pagamento (DP) em ISO; ausente onde a planilha não tinha", () => {
    expect(lidos.get(1)?.dataPagamento).toBe("2026-03-26");
    expect(lidos.get(169)?.dataPagamento).toBe("2026-07-30"); // "-DP: 30/07"
    expect(lidos.get(177)?.dataPagamento).toBe("2026-03-25"); // "DP - 25/03"
    const semData = REAIS.filter(([n]) => lidos.get(n)?.etapa === "paga" && !lidos.get(n)?.dataPagamento).map(([n]) => n);
    expect(semData).toEqual([36, 73, 80, 90, 113, 167]);
    expect(lidos.get(80)?.pendencias).toContain("sem data de pagamento");
  });

  it("vazio = sem situação; texto desconhecido vira pendência", () => {
    expect(lerStatus("")).toEqual({ etapa: null, empenho: null, dataPagamento: null, pendencias: [] });
    expect(lerStatus("aguardando").pendencias[0]).toMatch(/não reconhecida/);
  });
});

describe("resumirObjeto / lerDotacao", () => {
  it("tira o prefixo padrão e corta no CNPJ", () => {
    expect(
      resumirObjeto(
        "Reforço da dotação orçamentária para repasse ao Hospital de Cataguases, CNPJ 19.529.478/0001-31, situado na Avenida…"
      )
    ).toBe("Repasse ao Hospital de Cataguases");
  });

  it("separa funcional programática e natureza da despesa", () => {
    expect(
      lerDotacao("10.302.0012.2087 – Manutenção e Coordenação\n\n3.3.50.43.00.00.00.00 – Subvenções Sociais")
    ).toEqual({ funcional: "10.302.0012.2087", natureza: "3.3.50.43" });
    expect(lerDotacao("")).toEqual({ funcional: null, natureza: null });
  });
});

describe("interpretarLinhas", () => {
  const base = {
    Emenda: 28,
    ID: 2,
    Vereador: "04 - Felipe Ramos Vilas de Souza",
    "Descrição": "Reforço da dotação orçamentária para aquisição de materiais de consumo, cujo intuito…",
    Valor: 10000,
    "Destinação": "Secretaria de Saúde",
    "Dotação a acrescentar": "10.122.0010.2073 – Manutenção\n\n3.3.90.30.00.00.00.00 – Material de Consumo",
    "Nova dotação": "2.073.0305 - EP03 - AQUISIÇÃO MATERIAL DE CONSUMO SEC. SAÚDE",
    Secretaria: "02.08 - Saúde",
    "Saúde": "Sim",
  };

  it("monta a linha e o remanejamento a partir das duas abas", () => {
    const original = [{ ...base, "Destinação": "Lar São Vicente", Secretaria: "02.09 - Fundo de Saúde", "STATUS ": "" }];
    const { linhas, erros } = interpretarLinhas([base], original);
    expect(erros).toEqual([]);
    expect(linhas[0]).toMatchObject({
      numero: 28,
      numero_vereador: 2,
      vereador_numero: 4,
      unidade_codigo: "02.08",
      saude: true,
      natureza: "3.3.90.30",
      etapa: null,
    });
    expect(linhas[0].remanejamento).toEqual({
      antes: { beneficiario: "Lar São Vicente", unidade: "02.09 - Fundo de Saúde" },
      depois: { beneficiario: "Secretaria de Saúde", unidade: "02.08 - Saúde" },
    });
  });

  it("ignora linhas de total e aponta linha malformada", () => {
    const { linhas, erros } = interpretarLinhas(
      [{ Vereador: "Total", Valor: 5157490.05 }, { ...base, Emenda: 3, Secretaria: "Saúde" }],
      null
    );
    expect(linhas).toHaveLength(0);
    expect(erros[0]).toMatch(/Emenda 3: secretaria/);
  });

  it("lê o STATUS da aba original quando a atual não tem a coluna", () => {
    const original = [{ ...base, "STATUS ": "EXECUTADA - EMP: 3931 - DP: 26/03/2026" }];
    const { linhas } = interpretarLinhas([base], original);
    expect(linhas[0]).toMatchObject({ etapa: "paga", empenho: "3931", data_pagamento: "2026-03-26" });
  });
});
