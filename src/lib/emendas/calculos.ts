import "server-only";

import {
  obterDetalheEmenda,
  resolverExercicio,
  listarExecucoes,
  listarFasesCatalogo,
  listarFasesEJustificativas,
  listarDocumentosResumo,
  listarDescricoes,
  listarConciliacoes,
  listarMovimentos,
  listarPareceres,
  listarVereadores,
  obterCatalogoEtapas,
  type MovimentoResumo,
} from "@/lib/emendas/dados";
import { resumirProcessos } from "@/lib/emendas/compras";
import { medir } from "@/lib/emendas/tempo";
import { lerComCache } from "@/lib/emendas/cache-dados";
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
  // As telas não carregam a descrição (pesada), mas as regras dependem dela: o item III do art. 7º ("objeto detalhado", Conformidade)
  // lê a descrição de TODA emenda e a pendência de objeto genérico a usa para achar a finalidade. Busca as que faltam, uma vez, em cache.
  const genericas = emendas.filter((e) => !e.descricao).map((e) => e.id);
  const ano = String(exercicio.ano);
  const descricoes = genericas.length ? await medir("calculos:descricoes", () => lerComCache("descricoes", ano, async () => [...(await listarDescricoes(genericas))]).then((l) => new Map(l))) : new Map<string, string>();
  if (descricoes.size) emendas = emendas.map((e) => (descricoes.has(e.id) ? { ...e, descricao: descricoes.get(e.id) as string } : e));
  const [fasesCatalogo, movimentos, execucoes, { fases: manuais, justificadas }, pareceres, catalogo, documentos, vereadores, conciliacoes] = await Promise.all([
    medir("calculos:fases-catalogo", () => lerComCache("fases-catalogo", ano, () => listarFasesCatalogo())),
    movimentosJaCarregados ?? medir("calculos:movimentos", () => lerComCache("movimentos", ano, () => listarMovimentos(ids))),
    medir("calculos:execucoes", () => lerComCache("execucoes", ano, () => listarExecucoes(ids))),
    medir("calculos:fases-justificativas", () => lerComCache("fases-justificativas", ano, () => listarFasesEJustificativas(ids))),
    medir("calculos:pareceres", () => lerComCache("pareceres", ano, () => listarPareceres(exercicio.ano))),
    medir("calculos:catalogo-etapas", () => lerComCache("catalogo-etapas", ano, () => obterCatalogoEtapas())),
    medir("calculos:documentos", () => lerComCache("documentos", ano, () => listarDocumentosResumo(ids))),
    medir("calculos:vereadores", () => lerComCache("vereadores", ano, () => listarVereadores())),
    medir("calculos:conciliacoes", () => lerComCache("conciliacoes", ano, () => listarConciliacoes(ids))),
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
    conciliacoes,
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
    documentos: [
      ...detalhe.documentos.map((d) => ({ emenda_id: d.emenda_id, tipo: d.tipo, competencia: d.competencia ?? null })),
      ...detalhe.docsDrive.map((d) => ({ emenda_id: emenda.id, tipo: d.tipo as string, competencia: null as number | null })),
    ],
    partidos: new Map(vereadores.map((v) => [v.id, v.partido])),
    hoje: new Date().toISOString().slice(0, 10),
  });
  return mapa.get(emenda.id)?.fases ?? null;
}
