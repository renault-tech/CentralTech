/**
 * Junta fases e pendências de várias emendas de uma vez (lista, painel e tela de
 * Pendências). Pura: quem carrega os dados é `calculos.ts`.
 */

import { faseAtual, mapaManuais, progresso, situacaoFases, tipoDaEmenda, type FaseCalculada, type ResumoCompras } from "@/lib/emendas/fases";
import { avaliarArt7, contasRepetidas, relatoriosDeGestao, type DocumentoResumo, type ItemConformidade } from "@/lib/emendas/conformidade";
import { maiorGravidade, pendencias, type Gravidade, type Pendencia } from "@/lib/emendas/pendencias";
import { CATALOGO_PADRAO, type CatalogoEtapas } from "@/lib/emendas/regras";
import type {
  EmendaResumo,
  ExecucaoEmenda,
  Exercicio,
  FaseEmenda,
  FaseFluxo,
  ParecerExequibilidade,
  PendenciaJustificada,
} from "@/types/emendas";

export type CalculoEmenda = {
  fases: FaseCalculada[];
  pendencias: Pendencia[];
  /** Itens da IN TCE-MG 05/2025 (art. 7º e art. 5º) avaliados para a emenda. */
  conformidade: ItemConformidade[];
};

/** O que a lista precisa por linha (vai para o navegador, então enxuto). */
export type ResumoLinha = {
  concluidas: number;
  total: number;
  faseAtual: string | null;
  abertas: number;
  gravidade: Gravidade | null;
  /** Assuntos (regra sem sufixo) das pendências abertas — para filtrar a lista. */
  regras: string[];
};

export type EntradaResumos = {
  emendas: EmendaResumo[];
  fasesCatalogo: FaseFluxo[];
  manuais: FaseEmenda[];
  movimentos: { emenda_id: string; tipo: string; numero?: string | null; data: string | null; valor?: number | string | null }[];
  /** Resumo do processo do Compras de cada vínculo (processo_id → resumo). */
  compras?: Map<string, ResumoCompras>;
  execucoes: ExecucaoEmenda[];
  exercicio: Pick<Exercicio, "data_aprovacao_loa" | "prazo_exequibilidade" | "numero_lei_loa" | "municipio_nome" | "municipio_cnpj" | "unidade_parlamentar"> | null;
  /** Partido por vereador (id → partido). */
  partidos?: Map<string, string | null>;
  /** Vereadores fora do exercício (id → saída), para sinalizar emendas que seguem em execução. */
  afastados?: Map<string, { desde: string | null; motivo: string | null }>;
  documentos?: (DocumentoResumo & { emenda_id: string })[];
  pareceres: ParecerExequibilidade[];
  justificadas: PendenciaJustificada[];
  catalogo?: CatalogoEtapas;
  /** AAAA-MM-DD */
  hoje: string;
};

function agrupar<T>(itens: T[], chave: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const i of itens) {
    const k = chave(i);
    const l = m.get(k);
    if (l) l.push(i);
    else m.set(k, [i]);
  }
  return m;
}

/** Pendência (sem as já justificadas) → fase que ela afeta, pela chave da regra. */
const FASE_DA_REGRA: Record<string, { derivacao?: string; chave?: string }> = {
  empenho_maior: { derivacao: "empenho" },
  empenho_sem_data: { derivacao: "empenho" },
  empenho_sem_numero: { derivacao: "empenho" },
  liquidacao_sem_data: { derivacao: "liquidacao" },
  pago_maior: { derivacao: "pagamento" },
  pago_sem_empenho: { derivacao: "pagamento" },
  pagamento_sem_data: { derivacao: "pagamento" },
  paga_sem_pagamento: { derivacao: "pagamento" },
  termo_sem_extrato: { derivacao: "extrato" },
  sem_conta: { derivacao: "termo" },
  vigencia: { derivacao: "termo" },
  impedimento: { derivacao: "parecer" },
  exequibilidade_vencida: { derivacao: "parecer" },
};

function anexarAlertas(fases: FaseCalculada[], pend: Pendencia[]) {
  for (const p of pend) {
    if (p.justificativa) continue;
    const [regra, chave] = p.regra.split(":");
    const alvo = regra === "data_fora_de_ordem" ? { chave } : FASE_DA_REGRA[regra];
    if (!alvo) continue;
    const f = fases.find((x) => (alvo.chave ? x.fase.chave === alvo.chave : x.fase.derivacao === alvo.derivacao));
    if (f && !f.alertas.includes(p.titulo)) f.alertas.push(p.titulo);
  }
}

export function calcularEmendas(e: EntradaResumos): Map<string, CalculoEmenda> {
  const catalogo = e.catalogo ?? CATALOGO_PADRAO;
  const fasesPorTipo = agrupar(e.fasesCatalogo, (f) => f.tipo);
  const manuais = agrupar(e.manuais, (m) => m.emenda_id);
  const movs = agrupar(e.movimentos, (m) => m.emenda_id);
  const execucoes = new Map(e.execucoes.map((x) => [x.id, x]));
  const pareceres = new Map(e.pareceres.map((p) => [p.secretaria_id, p]));
  const justificadas = agrupar(e.justificadas, (j) => j.emenda_id);
  const docs = agrupar(e.documentos ?? [], (d) => d.emenda_id);
  const repetidas = contasRepetidas(e.execucoes);

  const saida = new Map<string, CalculoEmenda>();
  for (const emenda of e.emendas) {
    const execucao = execucoes.get(emenda.id) ?? null;
    const parecer = pareceres.get(emenda.secretaria_id) ?? null;
    const fases = situacaoFases({
      emenda,
      fases: fasesPorTipo.get(tipoDaEmenda(emenda)) ?? [],
      manuais: mapaManuais(manuais.get(emenda.id) ?? []),
      movimentos: movs.get(emenda.id) ?? [],
      valorEmenda: Number(emenda.valor),
      compras: execucao?.processo_id ? (e.compras?.get(execucao.processo_id) ?? null) : null,
      execucao,
      exercicio: e.exercicio,
      parecer,
      catalogo,
    });
    const itens = avaliarArt7({
      emenda,
      execucao,
      partido: e.partidos?.get(emenda.vereador_id) ?? null,
      exercicio: e.exercicio,
      documentos: docs.get(emenda.id) ?? [],
      movimentos: movs.get(emenda.id) ?? [],
    });
    const pend = pendencias({
        emenda,
        fases,
        execucao,
        exercicio: e.exercicio,
        temParecer: !!parecer,
        vereadorAfastado: e.afastados?.get(emenda.vereador_id) ?? null,
        movimentos: movs.get(emenda.id) ?? [],
        justificadas: justificadas.get(emenda.id),
        conformidade: {
          itens,
          relatorios: relatoriosDeGestao(movs.get(emenda.id) ?? [], docs.get(emenda.id) ?? [], e.hoje),
          contaRepetida: repetidas.has(emenda.id),
        },
        hoje: e.hoje,
      });
    anexarAlertas(fases, pend);
    saida.set(emenda.id, {
      fases,
      conformidade: itens,
      pendencias: pend,
    });
  }
  return saida;
}

export function resumoDaLinha(c: CalculoEmenda): ResumoLinha {
  const p = progresso(c.fases);
  return {
    concluidas: p.concluidas,
    total: p.total,
    faseAtual: faseAtual(c.fases)?.fase.nome ?? null,
    abertas: c.pendencias.filter((x) => !x.justificativa).length,
    gravidade: maiorGravidade(c.pendencias),
    regras: Array.from(new Set(c.pendencias.filter((x) => !x.justificativa).map((x) => x.regra.split(":")[0]))),
  };
}
