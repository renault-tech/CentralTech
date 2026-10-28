/**
 * Junta fases e pendências de várias emendas de uma vez (lista, painel e tela de
 * Pendências). Pura: quem carrega os dados é `calculos.ts`.
 */

import { faseAtual, mapaManuais, progresso, situacaoFases, tipoDaEmenda, type FaseCalculada } from "@/lib/emendas/fases";
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
};

/** O que a lista precisa por linha (vai para o navegador, então enxuto). */
export type ResumoLinha = {
  concluidas: number;
  total: number;
  faseAtual: string | null;
  abertas: number;
  gravidade: Gravidade | null;
};

export type EntradaResumos = {
  emendas: EmendaResumo[];
  fasesCatalogo: FaseFluxo[];
  manuais: FaseEmenda[];
  movimentos: { emenda_id: string; tipo: string; data: string | null }[];
  execucoes: ExecucaoEmenda[];
  exercicio: Pick<Exercicio, "data_aprovacao_loa" | "prazo_exequibilidade"> | null;
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

export function calcularEmendas(e: EntradaResumos): Map<string, CalculoEmenda> {
  const catalogo = e.catalogo ?? CATALOGO_PADRAO;
  const fasesPorTipo = agrupar(e.fasesCatalogo, (f) => f.tipo);
  const manuais = agrupar(e.manuais, (m) => m.emenda_id);
  const movs = agrupar(e.movimentos, (m) => m.emenda_id);
  const execucoes = new Map(e.execucoes.map((x) => [x.id, x]));
  const pareceres = new Map(e.pareceres.map((p) => [p.secretaria_id, p]));
  const justificadas = agrupar(e.justificadas, (j) => j.emenda_id);

  const saida = new Map<string, CalculoEmenda>();
  for (const emenda of e.emendas) {
    const execucao = execucoes.get(emenda.id) ?? null;
    const parecer = pareceres.get(emenda.secretaria_id) ?? null;
    const fases = situacaoFases({
      emenda,
      fases: fasesPorTipo.get(tipoDaEmenda(emenda)) ?? [],
      manuais: mapaManuais(manuais.get(emenda.id) ?? []),
      movimentos: movs.get(emenda.id) ?? [],
      execucao,
      exercicio: e.exercicio,
      parecer,
      catalogo,
    });
    saida.set(emenda.id, {
      fases,
      pendencias: pendencias({
        emenda,
        fases,
        execucao,
        exercicio: e.exercicio,
        temParecer: !!parecer,
        justificadas: justificadas.get(emenda.id),
        hoje: e.hoje,
      }),
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
  };
}
