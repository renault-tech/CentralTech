import "server-only";

import {
  listarExecucoes,
  listarFasesCatalogo,
  listarFasesEJustificativas,
  listarMovimentos,
  listarPareceres,
  obterCatalogoEtapas,
  type MovimentoResumo,
} from "@/lib/emendas/dados";
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
  const [fasesCatalogo, movimentos, execucoes, { fases: manuais, justificadas }, pareceres, catalogo] = await Promise.all([
    listarFasesCatalogo(),
    movimentosJaCarregados ?? listarMovimentos(ids),
    listarExecucoes(ids),
    listarFasesEJustificativas(ids),
    listarPareceres(exercicio.ano),
    obterCatalogoEtapas(),
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
    hoje: new Date().toISOString().slice(0, 10),
  });
}
