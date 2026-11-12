import "server-only";

import {
  obterDetalheEmenda,
  resolverExercicio,
  listarExecucoes,
  listarFasesCatalogo,
  listarFasesEJustificativas,
  listarDocumentosResumo,
  listarMovimentos,
  listarPareceres,
  listarVereadores,
  obterCatalogoEtapas,
  type MovimentoResumo,
} from "@/lib/emendas/dados";
import { resumirProcessos } from "@/lib/emendas/compras";
import { medir } from "@/lib/emendas/tempo";
import { calcularEmendas, type CalculoEmenda } from "@/lib/emendas/resumo";
import type { EmendaResumo, Exercicio } from "@/types/emendas";

/** Carrega o que as regras precisam (tudo sob a RLS de quem está logado) e calcula
 * fases e pendências das emendas do exercício. */
export async function calcularEmendasDoExercicio(
  emendas: EmendaResumo[],
  exercicio: Exercicio,
  /** Se a tela já carregou os movimentos, evita buscar de novo. */
  movimentosJaCarregados?: MovimentoResumo[]
): Promise<Map<string, CalculoEmenda>> {
  const ids = emendas.map((e) => e.id);
  const [fasesCatalogo, movimentos, execucoes, { fases: manuais, justificadas }, pareceres, catalogo, documentos, vereadores] = await Promise.all([
    medir("calculos:fases-catalogo", () => listarFasesCatalogo()),
    movimentosJaCarregados ?? medir("calculos:movimentos", () => listarMovimentos(ids)),
    medir("calculos:execucoes", () => listarExecucoes(ids)),
    medir("calculos:fases-justificativas", () => listarFasesEJustificativas(ids)),
    medir("calculos:pareceres", () => listarPareceres(exercicio.ano)),
    medir("calculos:catalogo-etapas", () => obterCatalogoEtapas()),
    medir("calculos:documentos", () => listarDocumentosResumo(ids)),
    medir("calculos:vereadores", () => listarVereadores()),
  ]);
  // Processo do Compras ligado a cada emenda: alimenta as fases da execução direta.
  const compras = await medir("calculos:compras", () => resumirProcessos(execucoes.map((x) => x.processo_id).filter((x): x is string => !!x)).catch(() => new Map()));
  return calcularEmendas({
    compras,
    emendas,
    fasesCatalogo,
    manuais,
    movimentos,
    execucoes,
    exercicio,
    pareceres,
    justificadas,
    catalogo,
    documentos,
    partidos: new Map(vereadores.map((v) => [v.id, v.partido])),
    hoje: new Date().toISOString().slice(0, 10),
  });
}

/** Fases calculadas de UMA emenda (para validar, no servidor, o que a tela só mostra). */
export async function calcularFasesDaEmenda(emendaId: string) {
  const detalhe = await obterDetalheEmenda(emendaId);
  if (!detalhe) return null;
  const { emenda, execucao } = detalhe;
  const [fasesCatalogo, catalogo, { exercicio }, pareceres, vereadores] = await Promise.all([
    listarFasesCatalogo(),
    obterCatalogoEtapas(),
    resolverExercicio(String(emenda.ano)),
    listarPareceres(emenda.ano),
    listarVereadores(),
  ]);
  const compras = execucao?.processo_id ? await resumirProcessos([execucao.processo_id]).catch(() => new Map()) : new Map();
  const mapa = calcularEmendas({
    emendas: [emenda],
    fasesCatalogo,
    manuais: detalhe.fasesManuais,
    movimentos: detalhe.movimentos,
    compras,
    execucoes: execucao ? [execucao] : [],
    exercicio,
    pareceres,
    justificadas: detalhe.justificadas,
    catalogo,
    documentos: detalhe.documentos.map((d) => ({ emenda_id: d.emenda_id, tipo: d.tipo, competencia: d.competencia ?? null })),
    partidos: new Map(vereadores.map((v) => [v.id, v.partido])),
    hoje: new Date().toISOString().slice(0, 10),
  });
  return mapa.get(emenda.id)?.fases ?? null;
}
