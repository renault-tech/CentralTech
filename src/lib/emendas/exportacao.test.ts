import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { descreverFiltrosLista } from "@/lib/emendas/filtros-texto";
import {
  CHAVES_FILTRO_LISTA,
  filtrarEmendasLista,
  lerFiltrosLista,
  ordenarEmendasLista,
  paramsDeExportacao,
} from "@/lib/emendas/painel-lista";
import { montarPdfExecutivo, limitar } from "@/lib/emendas/pdf-executivo";
import {
  relatorioDaLista,
  relatorioDasSecretarias,
  relatorioDosVereadores,
} from "@/lib/emendas/relatorio-executivo";
import { CATALOGO_PADRAO } from "@/lib/emendas/regras";
import type { EmendaResumo } from "@/types/emendas";

const base = {
  ano: 2026,
  numero_vereador: 1,
  descricao: "",
  saude: false,
  modalidade: "repasse",
  tipo_execucao: "osc",
  etapa: "indicada",
  situacao: "normal",
  etapa_atualizada_em: "",
  criado_em: "",
  atualizado_em: "",
  funcional_programatica: null,
  natureza_despesa: null,
  dotacao_texto: null,
  ficha: null,
  vereador_id: "v1",
  vereador_numero: 1,
  vereador_nome: "Ana",
  beneficiario_id: null,
  beneficiario_nome: "Casa Azul",
  beneficiario_cnpj: null,
  beneficiario_categoria: "osc",
  unidade_id: "u",
  unidade_codigo: "02.01",
  unidade_nome: "U",
  secretaria_id: "s1",
  secretaria_nome: "Saúde",
  empenhado: 0,
  liquidado: 0,
  pago: 0,
  ultimo_pagamento: null,
  remanejada: false,
  impedimentos_abertos: 0,
};
const e = (
  o: Partial<EmendaResumo> & { id: string; numero: number },
): EmendaResumo =>
  ({
    objeto: "Reforma",
    valor: 1000,
    ...base,
    ...o,
  }) as unknown as EmendaResumo;

// 41 emendas: 12 empenhadas sem pagamento, 15 pagas, 14 sem empenho.
const L: EmendaResumo[] = [
  ...Array.from({ length: 12 }, (_, i) =>
    e({
      id: `e${i}`,
      numero: i + 1,
      empenhado: 1000,
      pago: 0,
      etapa: "empenhada",
    }),
  ),
  ...Array.from({ length: 15 }, (_, i) =>
    e({
      id: `p${i}`,
      numero: 100 + i,
      empenhado: 1000,
      pago: 1000,
      etapa: "paga",
    }),
  ),
  ...Array.from({ length: 14 }, (_, i) =>
    e({
      id: `s${i}`,
      numero: 200 + i,
      etapa: "indicada",
      vereador_id: "v2",
      vereador_nome: "Bruno",
      vereador_numero: 2,
      secretaria_id: "s2",
      secretaria_nome: "Educação",
    }),
  ),
];

describe("exportação fiel aos filtros", () => {
  it("a URL de exportação leva TODA chave de filtro ativa (antes faltavam pendência, categoria na rota e a ordem)", () => {
    const ativos: Record<string, string> = {
      v: "v1",
      s: "s1",
      etapa: "paga",
      t: "osc",
      situacao: "normal",
      fin: "empenhada_sem_pagamento",
      sd: "1",
      rem: "0",
      cat: "osc",
      p: "1",
      pe: "vigencia",
      numeros: "1,2",
      ordem: "valor",
    };
    expect(Object.keys(ativos).sort()).toEqual([...CHAVES_FILTRO_LISTA].sort());
    const u = paramsDeExportacao(
      (k) => ativos[k] ?? null,
      2026,
      "  casa azul ",
    );
    for (const [k, v] of Object.entries(ativos)) expect(u.get(k)).toBe(v);
    expect(u.get("q")).toBe("casa azul");
    expect(u.get("ano")).toBe("2026");
  });

  it("'empenhadas sem pagamento' exporta só emendas empenhadas e sem pagamento", () => {
    const f = lerFiltrosLista((k) =>
      k === "fin" ? "empenhada_sem_pagamento" : null,
    );
    const r = filtrarEmendasLista(L, {}, f);
    expect(r).toHaveLength(12);
    expect(r.every((x) => x.empenhado > 0 && x.pago === 0)).toBe(true);
  });

  it("o PDF diz a contagem e os filtros, e a quantidade bate com a lista", () => {
    const f = lerFiltrosLista((k) =>
      k === "fin" ? "empenhada_sem_pagamento" : null,
    );
    const filtradas = filtrarEmendasLista(L, {}, f);
    const filtros = descreverFiltrosLista(f, "", {
      vereador: (x) => x,
      secretaria: (x) => x,
      etapa: (x) => x,
    });
    expect(filtros).toEqual(["Situação financeira: Empenhada, sem pagamento"]);
    const rel = relatorioDaLista({
      ano: 2026,
      emendas: filtradas,
      catalogo: CATALOGO_PADRAO,
      filtros,
      totalDoExercicio: L.length,
      comTabela: true,
    });
    expect(rel.contagem).toBe("12 emendas (de 41 no exercício)");
    expect(rel.kpis[0].valor).toBe("12");
    expect(rel.tabelas?.[0].linhas).toHaveLength(12);
    const pdf = montarPdfExecutivo(rel);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });

  it("a ordem do arquivo é a da tela (valor, vereador, etapa, busca)", () => {
    const ordem = ["indicada", "empenhada", "paga"];
    expect(ordenarEmendasLista(L, "numero", "", ordem)[0].numero).toBe(1);
    expect(
      ordenarEmendasLista(
        [
          e({ id: "x", numero: 9, valor: 5 }),
          e({ id: "y", numero: 8, valor: 50 }),
        ],
        "valor",
        "",
        ordem,
      ).map((x) => x.numero),
    ).toEqual([8, 9]);
    expect(ordenarEmendasLista(L, "etapa", "", ordem)[0].etapa).toBe("paga");
    expect(
      ordenarEmendasLista(
        [e({ id: "x", numero: 9 }), e({ id: "y", numero: 12 })],
        "numero",
        "12",
        ordem,
      )[0].numero,
    ).toBe(12);
  });
});

describe("relatórios executivos", () => {
  it("limitar agrega o excedente em 'Demais' sem perder o total", () => {
    const itens = Array.from({ length: 15 }, (_, i) => ({
      rotulo: `g${i}`,
      valor: i + 1,
    }));
    const l = limitar(itens, 10);
    expect(l).toHaveLength(10);
    expect(l.reduce((t, i) => t + i.valor, 0)).toBe(120);
    expect(l[9].rotulo).toBe("Demais (6)");
  });

  it("vereadores e secretarias geram PDF (com e sem tabela) e a soma das pilhas fecha com o valor indicado", () => {
    const vs = [
      { id: "v1", numero: 1, nome: "Ana" },
      { id: "v2", numero: 2, nome: "Bruno" },
    ];
    const rv = relatorioDosVereadores({
      ano: 2026,
      emendas: L,
      vereadores: vs,
      cota: 50000,
      percentualSaudeMin: 50,
      comTabela: true,
    });
    expect(rv.tabelas?.[0].linhas).toHaveLength(2);
    const pilha = rv.graficos[0];
    if (pilha.tipo !== "empilhada") throw new Error("esperava empilhada");
    const total = pilha.linhas.reduce(
      (t, l) => t + l.valores.reduce((a, b) => a + b, 0),
      0,
    );
    expect(total).toBe(L.reduce((t, x) => t + x.valor, 0));
    expect(montarPdfExecutivo(rv).length).toBeGreaterThan(2000);
    expect(
      montarPdfExecutivo({ ...rv, tabelas: undefined }).length,
    ).toBeGreaterThan(2000);
    const rs = relatorioDasSecretarias({
      ano: 2026,
      emendas: L,
      catalogo: CATALOGO_PADRAO,
      comTabela: true,
    });
    expect(rs.tabelas?.[0].linhas).toHaveLength(2);
    expect(montarPdfExecutivo(rs).length).toBeGreaterThan(2000);
  });

  it("recorte vazio não quebra (sem gráficos nem tabela)", () => {
    const rel = relatorioDaLista({
      ano: 2026,
      emendas: [],
      catalogo: CATALOGO_PADRAO,
      filtros: ["Etapa: X"],
      totalDoExercicio: 41,
      comTabela: true,
    });
    expect(rel.graficos).toEqual([]);
    expect(montarPdfExecutivo(rel).length).toBeGreaterThan(1000);
  });
});

// Amostra visual (rodar com PDF_AMOSTRA=/pasta npx vitest run exportacao): gera os PDFs para conferir a olho.
describe.runIf(process.env.PDF_AMOSTRA)("amostra", () => {
  it("grava os PDFs", async () => {
    const { writeFileSync } = await import("node:fs");
    const grande: EmendaResumo[] = Array.from({ length: 90 }, (_, i) =>
      e({
        id: `g${i}`,
        numero: i + 1,
        valor: 8000 + (i % 7) * 4000,
        empenhado: i % 3 === 0 ? 0 : 8000 + (i % 7) * 4000,
        pago: i % 5 === 0 ? 8000 + (i % 7) * 4000 : 0,
        etapa: ["indicada", "empenhada", "paga", "analise"][i % 4] as never,
        vereador_id: `v${i % 17}`,
        vereador_numero: (i % 17) + 1,
        vereador_nome: `Vereador ${(i % 17) + 1} da Silva Pereira`,
        secretaria_id: `s${i % 6}`,
        secretaria_nome: [
          "Saúde",
          "Educação",
          "Administração",
          "Esporte",
          "Cultura e Turismo",
          "Agricultura e Meio Ambiente",
        ][i % 6],
        saude: i % 6 === 0,
        tipo_execucao: (["osc", "direta", "ente"] as const)[i % 3],
        objeto: `Objeto da emenda ${i + 1}: aquisição de equipamentos e material permanente para atendimento`,
      }),
    );
    const pasta = process.env.PDF_AMOSTRA as string;
    writeFileSync(
      `${pasta}/lista.pdf`,
      montarPdfExecutivo(
        relatorioDaLista({
          ano: 2026,
          emendas: grande,
          catalogo: CATALOGO_PADRAO,
          filtros: [
            "Situação financeira: Empenhada, sem pagamento",
            'Busca: "equipamentos"',
          ],
          totalDoExercicio: 215,
          comTabela: true,
        }),
      ),
    );
    const vs = Array.from({ length: 17 }, (_, i) => ({
      id: `v${i}`,
      numero: i + 1,
      nome: `Vereador ${i + 1} da Silva Pereira`,
    }));
    writeFileSync(
      `${pasta}/vereadores.pdf`,
      montarPdfExecutivo(
        relatorioDosVereadores({
          ano: 2026,
          emendas: grande,
          vereadores: vs,
          cota: 343832.67,
          percentualSaudeMin: 50,
          comTabela: true,
        }),
      ),
    );
    writeFileSync(
      `${pasta}/secretarias.pdf`,
      montarPdfExecutivo(
        relatorioDasSecretarias({
          ano: 2026,
          emendas: grande,
          catalogo: CATALOGO_PADRAO,
          comTabela: false,
        }),
      ),
    );
  });
});
