/**
 * Monta os relatórios executivos (indicadores + gráficos + tabelas) a partir de listas de emendas JÁ FILTRADAS.
 * Puro e testado: nenhum filtro acontece aqui, então o que sai no PDF é exatamente o que o chamador filtrou.
 */

import { INFO_CATEGORIA } from "@/lib/emendas/categorias";
import {
  COR_SITUACAO,
  agrupar as agruparPanorama,
  rotuloSituacao,
  totaisPorCartao,
  type LinhaPanorama,
} from "@/lib/emendas/encerramento";
import { TIPOS_EXECUCAO, tipoDaEmenda } from "@/lib/emendas/fases";
import {
  CLASSES_FINANCEIRAS,
  classeFinanceira,
  faixaFinanceira,
} from "@/lib/emendas/painel-lista";
import type {
  Grafico,
  ItemGrafico,
  Kpi,
  RelatorioExecutivo,
} from "@/lib/emendas/pdf-executivo";
import type { TabelaPdf } from "@/lib/emendas/pdf";
import {
  brl,
  infoEtapa,
  numeroVereador,
  pct,
  type CatalogoEtapas,
} from "@/lib/emendas/regras";
import type { EmendaResumo } from "@/types/emendas";

const COR_FINANCEIRA: Record<string, string> = {
  paga: "#563A9E",
  paga_parcial: "#9479DD",
  empenhada_sem_pagamento: "#C4B5F0",
  sem_empenho: "#94A3B8",
};
const PAGO = "#563A9E";
const A_PAGAR = "#9479DD";
const SEM_EMPENHO = "#CBD5E1";
const CATEGORIAS_FINANCEIRAS = [
  { rotulo: "Pago", cor: PAGO },
  { rotulo: "Empenhado, falta pagar", cor: A_PAGAR },
  { rotulo: "Sem empenho", cor: SEM_EMPENHO },
];

export const somaValor = (es: EmendaResumo[]) =>
  es.reduce((t, e) => t + e.valor, 0);
const somaCampo = (es: EmendaResumo[], k: "empenhado" | "pago") =>
  es.reduce((t, e) => t + e[k], 0);

/** Pago, empenhado a pagar e sem empenho de um grupo (cada parte limitada ao valor da emenda, como no painel). */
export function pilhaFinanceira(es: EmendaResumo[]): number[] {
  const f = faixaFinanceira(es);
  return [f.pago, f.aPagar, f.semEmpenho];
}

function agrupar(
  es: EmendaResumo[],
  chave: (e: EmendaResumo) => { id: string; nome: string },
) {
  const m = new Map<string, { nome: string; es: EmendaResumo[] }>();
  for (const e of es) {
    const k = chave(e);
    const g = m.get(k.id) ?? { nome: k.nome, es: [] };
    g.es.push(e);
    m.set(k.id, g);
  }
  return [...m.values()];
}

export function indicadoresFinanceiros(
  es: EmendaResumo[],
  totalDoExercicio?: number,
): Kpi[] {
  const valor = somaValor(es);
  const f = faixaFinanceira(es);
  const empenhado = somaCampo(es, "empenhado");
  const pago = somaCampo(es, "pago");
  const k = (rotulo: string, v: number, apoio?: string): Kpi => ({
    rotulo,
    valor: brlCurtoPdf(v),
    apoio,
  });
  return [
    {
      rotulo: "Emendas",
      valor: String(es.length),
      apoio:
        totalDoExercicio !== undefined && totalDoExercicio !== es.length
          ? `de ${totalDoExercicio} no exercício`
          : "no recorte",
    },
    k("Valor indicado", valor, brl(valor)),
    k(
      "Empenhado",
      empenhado,
      `${pct(valor ? empenhado / valor : 0, 0)} do indicado`,
    ),
    k("Pago", pago, `${pct(valor ? pago / valor : 0, 0)} do indicado`),
    k("Falta pagar", f.aPagar, "empenhado e não pago"),
    k("Sem empenho", f.semEmpenho, "ainda sem empenho"),
  ];
}

/** Rótulo curto de dinheiro (R$ 1,25 mi / R$ 340 mil) igual ao dos gráficos. */
function brlCurtoPdf(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6)
    return `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (abs >= 1e3)
    return `R$ ${Math.round(v / 1e3).toLocaleString("pt-BR")} mil`;
  return brl(v);
}

function itensDe(
  grupos: { nome: string; es: EmendaResumo[] }[],
  valor: (es: EmendaResumo[]) => number,
  cor?: (nome: string, i: number) => string | undefined,
): ItemGrafico[] {
  return grupos.map((g, i) => ({
    rotulo: g.nome,
    valor: valor(g.es),
    cor: cor?.(g.nome, i),
  }));
}

export function graficoSituacaoFinanceira(es: EmendaResumo[]): Grafico {
  const gs = CLASSES_FINANCEIRAS.map(([k, nome]) => ({
    nome,
    es: es.filter((e) => classeFinanceira(e) === k),
    k,
  }));
  return {
    tipo: "rosca",
    titulo: "Situação financeira (valor indicado)",
    subtitulo: "cada emenda em uma só situação",
    formato: "moeda",
    itens: gs.map((g) => ({
      rotulo: `${g.nome} (${g.es.length})`,
      valor: somaValor(g.es),
      cor: COR_FINANCEIRA[g.k],
    })),
  };
}

export function graficoPorEtapa(
  es: EmendaResumo[],
  catalogo: CatalogoEtapas,
): Grafico {
  const gs = agrupar(es, (e) => ({
    id: e.etapa,
    nome: infoEtapa(e.etapa, catalogo).nome,
  }));
  return {
    tipo: "barras",
    titulo: "Emendas por etapa",
    subtitulo: "quantidade de emendas em cada fase do fluxo",
    formato: "numero",
    limite: 10,
    itens: gs.map((g) => {
      const cor = infoEtapa(g.es[0].etapa, catalogo).cor;
      return {
        rotulo: g.nome,
        valor: g.es.length,
        cor: cor === "#CBD5E1" ? "#94A3B8" : cor,
      };
    }),
  };
}

export function graficoPorTipo(es: EmendaResumo[]): Grafico {
  const gs = agrupar(es, (e) => ({
    id: tipoDaEmenda(e),
    nome: TIPOS_EXECUCAO[tipoDaEmenda(e)].nome,
  }));
  return {
    tipo: "rosca",
    titulo: "Valor por tipo de execução",
    formato: "moeda",
    itens: gs.map((g) => ({
      rotulo: `${g.nome} (${g.es.length})`,
      valor: somaValor(g.es),
      cor: TIPOS_EXECUCAO[tipoDaEmenda(g.es[0])].cor,
    })),
  };
}

export function graficoPorCategoria(es: EmendaResumo[]): Grafico {
  const gs = agrupar(es, (e) => ({
    id: e.beneficiario_categoria ?? "sem",
    nome:
      (e.beneficiario_categoria &&
        INFO_CATEGORIA[e.beneficiario_categoria]?.nome) ||
      "Sem categoria",
  }));
  return {
    tipo: "barras",
    titulo: "Valor por tipo de beneficiário",
    formato: "moeda",
    limite: 8,
    itens: itensDe(gs, somaValor),
  };
}

function empilhadaPor(
  titulo: string,
  subtitulo: string,
  es: EmendaResumo[],
  chave: (e: EmendaResumo) => { id: string; nome: string },
  cheio = false,
  limite = 12,
): Grafico {
  const gs = agrupar(es, chave).sort(
    (a, b) => somaValor(b.es) - somaValor(a.es),
  );
  return {
    tipo: "empilhada",
    titulo,
    subtitulo,
    formato: "moeda",
    categorias: CATEGORIAS_FINANCEIRAS,
    limite,
    cheio,
    linhas: gs.map((g) => ({
      rotulo: `${g.nome} (${g.es.length})`,
      valores: pilhaFinanceira(g.es),
    })),
  };
}

export const graficoPorVereador = (
  es: EmendaResumo[],
  cheio = false,
  limite = 12,
) =>
  empilhadaPor(
    "Execução por vereador",
    "valor indicado, dividido em pago, empenhado e sem empenho",
    es,
    (e) => ({
      id: e.vereador_id,
      nome: `${numeroVereador(e.vereador_numero)} ${e.vereador_nome}`,
    }),
    cheio,
    limite,
  );

export const graficoPorSecretaria = (
  es: EmendaResumo[],
  cheio = false,
  limite = 12,
) =>
  empilhadaPor(
    "Execução por secretaria",
    "valor indicado, dividido em pago, empenhado e sem empenho",
    es,
    (e) => ({ id: e.secretaria_id, nome: e.secretaria_nome }),
    cheio,
    limite,
  );

export function tabelaDeEmendas(
  es: EmendaResumo[],
  catalogo: CatalogoEtapas,
): TabelaPdf {
  return {
    titulo: "Emendas do recorte",
    colunas: [
      "Nº",
      "Vereador",
      "Objeto",
      "Beneficiário",
      "Secretaria",
      "Tipo",
      "Etapa",
      "Valor",
      "Empenhado",
      "Pago",
    ],
    monetarias: [7, 8, 9],
    linhas: es.map((e) => [
      e.numero,
      `${numeroVereador(e.vereador_numero)} - ${e.vereador_nome}`,
      e.objeto,
      e.beneficiario_nome ?? "",
      e.secretaria_nome,
      TIPOS_EXECUCAO[tipoDaEmenda(e)].curto,
      infoEtapa(e.etapa, catalogo).nome,
      e.valor,
      e.empenhado,
      e.pago,
    ]),
    total: [
      "",
      "",
      "",
      "",
      "",
      "",
      "Total",
      somaValor(es),
      somaCampo(es, "empenhado"),
      somaCampo(es, "pago"),
    ],
  };
}

export type EntradaRelatorio = {
  ano: number;
  emendas: EmendaResumo[];
  catalogo: CatalogoEtapas;
  filtros: string[];
  totalDoExercicio: number;
  comTabela: boolean;
};

const MODULO = "Central Cataguases - Emendas Impositivas";

/** Só entram gráficos com pelo menos dois grupos: um gráfico de uma barra só não mostra nada. */
function graficosDaLista(
  es: EmendaResumo[],
  catalogo: CatalogoEtapas,
): Grafico[] {
  const distintos = (f: (x: EmendaResumo) => string) => new Set(es.map(f)).size;
  return [
    graficoSituacaoFinanceira(es),
    graficoPorEtapa(es, catalogo),
    distintos((x) => x.vereador_id) > 1 && graficoPorVereador(es, true, 17),
    distintos((x) => x.secretaria_id) > 1 && graficoPorSecretaria(es),
    distintos((x) => tipoDaEmenda(x)) > 1 && graficoPorTipo(es),
    distintos((x) => x.beneficiario_categoria ?? "sem") > 1 &&
      graficoPorCategoria(es),
  ].filter((g): g is Grafico => !!g);
}

/** Panorama geral da lista (ou de qualquer recorte dela): o relatório para o gabinete. */
export function relatorioDaLista(e: EntradaRelatorio): RelatorioExecutivo {
  const filtrado = e.emendas.length !== e.totalDoExercicio;
  return {
    titulo: `Emendas impositivas ${e.ano} - panorama`,
    subtitulo: filtrado
      ? "Recorte da lista conforme os filtros abaixo."
      : "Todas as emendas do exercício visíveis a quem gerou o relatório.",
    modulo: MODULO,
    filtros: e.filtros,
    contagem: `${e.emendas.length} ${e.emendas.length === 1 ? "emenda" : "emendas"}${filtrado ? ` (de ${e.totalDoExercicio} no exercício)` : ""}`,
    kpis: indicadoresFinanceiros(e.emendas, e.totalDoExercicio),
    graficos: e.emendas.length ? graficosDaLista(e.emendas, e.catalogo) : [],
    tabelas:
      e.comTabela && e.emendas.length
        ? [tabelaDeEmendas(e.emendas, e.catalogo)]
        : undefined,
  };
}

export type VereadorExec = { id: string; numero: number; nome: string };

/** Panorama dos vereadores: execução da cota de cada um, meta da Saúde e tabela comparativa. */
export function relatorioDosVereadores(a: {
  ano: number;
  emendas: EmendaResumo[];
  vereadores: VereadorExec[];
  cota: number;
  percentualSaudeMin: number;
  comTabela: boolean;
}): RelatorioExecutivo {
  const ativas = a.emendas.filter((e) => e.situacao !== "cancelada");
  const linhas = a.vereadores
    .slice()
    .sort((x, y) => x.numero - y.numero)
    .map((v) => {
      const es = ativas.filter((e) => e.vereador_id === v.id);
      const valor = somaValor(es);
      const saude = somaValor(es.filter((e) => e.saude));
      return {
        v,
        es,
        valor,
        saude,
        empenhado: somaCampo(es, "empenhado"),
        pago: somaCampo(es, "pago"),
        pilha: pilhaFinanceira(es),
      };
    })
    .filter((l) => l.es.length > 0 || a.vereadores.length <= 30);
  const totalValor = linhas.reduce((t, l) => t + l.valor, 0);
  const totalPago = linhas.reduce((t, l) => t + l.pago, 0);
  const totalSaude = linhas.reduce((t, l) => t + l.saude, 0);
  const cumprem = linhas.filter(
    (l) =>
      l.valor > 0 &&
      l.saude / Math.max(a.cota, 0.01) >= a.percentualSaudeMin / 100,
  ).length;
  return {
    titulo: `Vereadores - emendas impositivas ${a.ano}`,
    subtitulo: `Cota individual de ${brl(a.cota)} por vereador; mínimo de ${a.percentualSaudeMin}% da cota na Saúde.`,
    modulo: MODULO,
    filtros: [],
    contagem: `${linhas.length} vereadores, ${ativas.length} emendas`,
    kpis: [
      {
        rotulo: "Vereadores",
        valor: String(linhas.length),
        apoio: `${cumprem} cumprem o mínimo da Saúde`,
      },
      {
        rotulo: "Valor indicado",
        valor: brlCurtoPdf(totalValor),
        apoio: brl(totalValor),
      },
      {
        rotulo: "Pago",
        valor: brlCurtoPdf(totalPago),
        apoio: `${pct(totalValor ? totalPago / totalValor : 0, 0)} do indicado`,
      },
      {
        rotulo: "Na Saúde",
        valor: brlCurtoPdf(totalSaude),
        apoio: `${pct(totalValor ? totalSaude / totalValor : 0, 0)} do indicado`,
      },
      {
        rotulo: "Cota total",
        valor: brlCurtoPdf(a.cota * linhas.length),
        apoio: `${pct(a.cota * linhas.length ? totalValor / (a.cota * linhas.length) : 0, 0)} indicada`,
      },
    ],
    graficos: [
      {
        tipo: "empilhada",
        titulo: "Execução da cota por vereador",
        subtitulo:
          "valor indicado de cada vereador: pago, empenhado e sem empenho",
        formato: "moeda",
        categorias: CATEGORIAS_FINANCEIRAS,
        limite: 20,
        cheio: true,
        linhas: linhas.map((l) => ({
          rotulo: `${numeroVereador(l.v.numero)} ${l.v.nome}`,
          valores: l.pilha,
        })),
      },
      {
        tipo: "barras",
        titulo: "Parcela da cota destinada à Saúde",
        subtitulo:
          "percentual da cota de cada vereador; verde = cumpre o mínimo",
        formato: "percentual",
        limite: 20,
        meta: {
          valor: a.percentualSaudeMin,
          rotulo: `mínimo ${a.percentualSaudeMin}%`,
        },
        itens: linhas.map((l) => ({
          rotulo: l.v.nome,
          valor: Math.round((l.saude / Math.max(a.cota, 0.01)) * 100),
          cor:
            l.saude / Math.max(a.cota, 0.01) >= a.percentualSaudeMin / 100
              ? "#5C7A1F"
              : "#C2410C",
        })),
      },
      {
        tipo: "barras",
        titulo: "Valor pago por vereador",
        formato: "moeda",
        limite: 12,
        itens: linhas.map((l) => ({ rotulo: l.v.nome, valor: l.pago })),
      },
    ],
    tabelas: a.comTabela
      ? [
          {
            titulo: "Comparativo dos vereadores",
            colunas: [
              "Nº",
              "Vereador",
              "Emendas",
              "Indicado",
              "% da cota",
              "Saúde",
              "% Saúde",
              "Empenhado",
              "Pago",
              "% pago",
            ],
            monetarias: [3, 5, 7, 8],
            linhas: linhas.map((l) => [
              numeroVereador(l.v.numero),
              l.v.nome,
              l.es.length,
              l.valor,
              pct(a.cota ? l.valor / a.cota : 0, 0),
              l.saude,
              pct(a.cota ? l.saude / a.cota : 0, 0),
              l.empenhado,
              l.pago,
              pct(l.valor ? l.pago / l.valor : 0, 0),
            ]),
            total: [
              "",
              "Total",
              linhas.reduce((t, l) => t + l.es.length, 0),
              totalValor,
              "",
              totalSaude,
              "",
              linhas.reduce((t, l) => t + l.empenhado, 0),
              totalPago,
              pct(totalValor ? totalPago / totalValor : 0, 0),
            ],
          },
        ]
      : undefined,
  };
}

/** Panorama das secretarias: quanto cada uma recebeu e executou. */
export function relatorioDasSecretarias(a: {
  ano: number;
  emendas: EmendaResumo[];
  catalogo: CatalogoEtapas;
  comTabela: boolean;
}): RelatorioExecutivo {
  const ativas = a.emendas.filter((e) => e.situacao !== "cancelada");
  const gs = agrupar(ativas, (e) => ({
    id: e.secretaria_id,
    nome: e.secretaria_nome,
  })).sort((x, y) => somaValor(y.es) - somaValor(x.es));
  const emExecucao = (es: EmendaResumo[]) =>
    es.filter(
      (e) =>
        infoEtapa(e.etapa, a.catalogo).grupo > 0 &&
        infoEtapa(e.etapa, a.catalogo).grupo < 3,
    ).length;
  return {
    titulo: `Secretarias - emendas impositivas ${a.ano}`,
    subtitulo: "Execução das emendas por secretaria responsável.",
    modulo: MODULO,
    filtros: [],
    contagem: `${gs.length} secretarias, ${ativas.length} emendas`,
    kpis: indicadoresFinanceiros(ativas),
    graficos: [
      empilhadaPor(
        "Execução por secretaria",
        "valor indicado: pago, empenhado e sem empenho",
        ativas,
        (e) => ({ id: e.secretaria_id, nome: e.secretaria_nome }),
        true,
        14,
      ),
      {
        tipo: "rosca",
        titulo: "Participação no valor indicado",
        formato: "moeda",
        itens: gs.map((g) => ({ rotulo: g.nome, valor: somaValor(g.es) })),
      },
      {
        tipo: "barras",
        titulo: "Percentual pago",
        subtitulo: "pago sobre o valor indicado, por secretaria",
        formato: "percentual",
        limite: 14,
        itens: gs.map((g) => ({
          rotulo: g.nome,
          valor: Math.round(
            (somaCampo(g.es, "pago") / Math.max(somaValor(g.es), 0.01)) * 100,
          ),
        })),
      },
    ],
    tabelas: a.comTabela
      ? [
          {
            titulo: "Comparativo das secretarias",
            colunas: [
              "Secretaria",
              "Emendas",
              "Indicado",
              "Empenhado",
              "Pago",
              "% pago",
              "Sem andamento",
              "Em execução",
              "Impedidas",
            ],
            monetarias: [2, 3, 4],
            linhas: gs.map((g) => [
              g.nome,
              g.es.length,
              somaValor(g.es),
              somaCampo(g.es, "empenhado"),
              somaCampo(g.es, "pago"),
              pct(
                somaValor(g.es) ? somaCampo(g.es, "pago") / somaValor(g.es) : 0,
                0,
              ),
              g.es.filter((e) => e.etapa === "indicada").length,
              emExecucao(g.es),
              g.es.filter((e) => e.situacao === "impedida").length,
            ]),
            total: [
              "Total",
              ativas.length,
              somaValor(ativas),
              somaCampo(ativas, "empenhado"),
              somaCampo(ativas, "pago"),
              pct(
                somaValor(ativas)
                  ? somaCampo(ativas, "pago") / somaValor(ativas)
                  : 0,
                0,
              ),
              "",
              "",
              "",
            ],
          },
        ]
      : undefined,
  };
}

/**
 * Panorama da execução (cartões do Panorama): indicadores do dinheiro, situação de encerramento e execução por
 * secretaria, vereador e tipo. `linhas` já vem filtrada (secretaria, tipo e cartão).
 */
export function relatorioDoPanorama(a: {
  ano: number;
  linhas: LinhaPanorama[];
  filtros: string[];
  totalDoRecorte: number;
  comTabela: boolean;
}): RelatorioExecutivo {
  const ls = a.linhas;
  const soma = (k: "valor" | "empenhado" | "pago" | "aPagar" | "semEmpenhar") =>
    ls.reduce((t, l) => t + l[k], 0);
  const valor = soma("valor");
  const t = totaisPorCartao(ls);
  const SITUACOES = [
    "cumprida",
    "cumprida_economia",
    "nao_cumprida",
    "restos_a_pagar",
  ] as const;
  const situacoes = [
    ...SITUACOES.map((x) => {
      const es = ls.filter((l) => l.encerramento === x);
      return {
        rotulo: `${rotuloSituacao(x, "direta").replace("com devolução de saldo", "com economia")} (${es.length})`,
        valor: es.reduce((tt, l) => tt + l.valor, 0),
        cor: COR_SITUACAO[x].ponto,
      };
    }),
    {
      rotulo: `Sem situação definida (${ls.filter((l) => !l.encerramento).length})`,
      valor: ls
        .filter((l) => !l.encerramento)
        .reduce((tt, l) => tt + l.valor, 0),
      cor: "#94A3B8",
    },
  ];
  const faltaExecutar: ItemGrafico[] = [
    { rotulo: "Empenho não pago", valor: t.a_pagar.valor, cor: "#B45309" },
    {
      rotulo: "Sem empenho, em andamento",
      valor: t.sem_empenho_andamento.valor,
      cor: "#C2410C",
    },
    {
      rotulo: "Sem empenho, encerrada (economia)",
      valor: t.sem_empenho_encerrada.valor,
      cor: "#94A3B8",
    },
    {
      rotulo: "Empenho a anular no IPM",
      valor: t.anular.valor,
      cor: "#B91C1C",
    },
    { rotulo: "Restos a pagar", valor: t.restos_a_pagar.valor, cor: "#1D4ED8" },
    {
      rotulo: "Devoluções de repasse",
      valor: t.devolucao.valor,
      cor: "#047857",
    },
    {
      rotulo: "Acima do valor da emenda",
      valor: t.excesso.valor,
      cor: "#7C2D12",
    },
  ];
  const qtdFalta = [
    t.a_pagar,
    t.sem_empenho_andamento,
    t.sem_empenho_encerrada,
    t.anular,
    t.restos_a_pagar,
    t.devolucao,
    t.excesso,
  ].map((x) => x.quantidade);
  const pilhaGrupo = (
    por: "secretaria" | "vereador" | "tipo",
    limite: number,
    cheio = false,
  ): Grafico => ({
    tipo: "empilhada",
    titulo:
      por === "secretaria"
        ? "Execução por secretaria"
        : por === "vereador"
          ? "Execução por vereador"
          : "Execução por tipo de execução",
    subtitulo: "valor indicado: pago, empenhado e sem empenho",
    formato: "moeda",
    categorias: CATEGORIAS_FINANCEIRAS,
    limite,
    cheio,
    linhas: agruparPanorama(ls, por)
      .sort((x, y) => y.valor - x.valor)
      .map((g) => ({
        rotulo: `${g.nome} (${g.emendas})`,
        valores: [Math.min(g.pago, g.valor), g.aPagar, g.semEmpenhar],
      })),
  });
  const nomeTipo = (x: LinhaPanorama) =>
    x.tipo_execucao === "direta"
      ? "Execução direta"
      : x.tipo_execucao === "osc"
        ? "Repasse a OSC"
        : "Repasse a ente";
  const filtrado = ls.length !== a.totalDoRecorte;
  return {
    titulo: `Panorama da execução - emendas impositivas ${a.ano}`,
    subtitulo:
      "Valores contábeis exatos, conforme o IPM. Resumo para prestação de contas e conciliação com a Contabilidade (Lei 4.320/1964, art. 36, para restos a pagar).",
    modulo: MODULO,
    filtros: a.filtros,
    contagem: `${ls.length} ${ls.length === 1 ? "emenda" : "emendas"}${filtrado ? ` (de ${a.totalDoRecorte} no recorte)` : ""}`,
    kpis: [
      {
        rotulo: "Emendas",
        valor: String(ls.length),
        apoio: filtrado ? `de ${a.totalDoRecorte} no recorte` : "no recorte",
      },
      {
        rotulo: "Valor indicado",
        valor: brlCurtoPdf(valor),
        apoio: brl(valor),
      },
      {
        rotulo: "Empenhado",
        valor: brlCurtoPdf(soma("empenhado")),
        apoio: `${pct(valor ? soma("empenhado") / valor : 0, 0)} do indicado`,
      },
      {
        rotulo: "Pago",
        valor: brlCurtoPdf(soma("pago")),
        apoio: `${pct(valor ? soma("pago") / valor : 0, 0)} do indicado`,
      },
      {
        rotulo: "Empenho não pago",
        valor: brlCurtoPdf(soma("aPagar")),
        apoio: "empenhado menos pago",
      },
      {
        rotulo: "Sem empenho",
        valor: brlCurtoPdf(soma("semEmpenhar")),
        apoio: "ainda por empenhar",
      },
    ],
    graficos: ls.length
      ? [
          {
            tipo: "rosca",
            titulo: "Situação das emendas (valor)",
            subtitulo: "como cada emenda foi encerrada",
            formato: "moeda",
            itens: situacoes,
          },
          {
            tipo: "barras",
            titulo: "O que falta executar e conciliar",
            subtitulo: "valor de cada situação do exercício",
            formato: "moeda",
            limite: 8,
            itens: faltaExecutar,
          },
          pilhaGrupo("secretaria", 12),
          pilhaGrupo("vereador", 17, true),
          {
            tipo: "rosca",
            titulo: "Valor por tipo de execução",
            formato: "moeda",
            itens: agruparPanorama(ls, "tipo").map((g) => ({
              rotulo: `${g.nome} (${g.emendas})`,
              valor: g.valor,
            })),
          },
        ]
      : [],
    tabelas:
      a.comTabela && ls.length
        ? [
            {
              titulo: "Resumo por indicador",
              colunas: ["Indicador", "Emendas", "Valor"],
              monetarias: [2],
              linhas: faltaExecutar.map((i, k) => [
                i.rotulo,
                qtdFalta[k],
                i.valor,
              ]),
            },
            ...(["secretaria", "vereador", "tipo"] as const).map((por) => ({
              titulo:
                por === "secretaria"
                  ? "Por secretaria"
                  : por === "vereador"
                    ? "Por vereador"
                    : "Por tipo de execução",
              colunas: [
                "Nome",
                "Emendas",
                "Valor",
                "Empenhado",
                "Pago",
                "Sem empenhar",
                "Restos a pagar",
                "Cumpridas",
                "Sem situação",
              ],
              monetarias: [2, 3, 4, 5, 6],
              linhas: agruparPanorama(ls, por).map((g) => [
                g.nome,
                g.emendas,
                g.valor,
                g.empenhado,
                g.pago,
                g.semEmpenhar,
                g.restos,
                g.cumpridas,
                g.semSituacao,
              ]),
            })),
            {
              titulo: "Por emenda",
              colunas: [
                "Nº",
                "Secretaria",
                "Tipo",
                "Valor",
                "Empenhado",
                "Pago",
                "Sem empenhar",
                "A pagar",
                "Situação",
              ],
              monetarias: [3, 4, 5, 6, 7],
              linhas: ls.map((l) => [
                l.numero,
                l.secretaria_nome,
                nomeTipo(l),
                l.valor,
                l.empenhado,
                l.pago,
                l.semEmpenhar,
                l.aPagar,
                l.encerramento
                  ? rotuloSituacao(l.encerramento, l.tipo_execucao)
                  : "Sem situação definida",
              ]),
            },
          ]
        : undefined,
  };
}
