import "server-only";

import {
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
  return calcularEmendas({
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
