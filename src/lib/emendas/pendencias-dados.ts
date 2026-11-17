import "server-only";

import { calcularEmendasDoExercicio } from "@/lib/emendas/calculos";
import { listarEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { tipoDaEmenda } from "@/lib/emendas/fases";
import { ORDEM_GRAVIDADE } from "@/lib/emendas/pendencias";
import type { EmendaPainel, LinhaDocFaltando, LinhaPendencia } from "@/lib/emendas/painel-pendencias";
import { medir } from "@/lib/emendas/tempo";

/** Tudo que a tela de Pendências e a exportação precisam, sob a RLS de quem está logado. */
export async function carregarPendencias(ano?: string | null) {
  const { exercicio } = await medir("pendencias:exercicio", () => resolverExercicio(ano ?? undefined));
  if (!exercicio) return null;
  const emendas = await medir("pendencias:emendas", () => listarEmendas(exercicio.ano));
  const calculos = await medir("pendencias:calculos", () => calcularEmendasDoExercicio(emendas, exercicio));

  const linhas: LinhaPendencia[] = [];
  const docs: LinhaDocFaltando[] = [];
  for (const e of emendas) {
    const base = { emendaId: e.id, numero: e.numero, objeto: e.objeto, valor: e.valor, tipo: tipoDaEmenda(e), secretariaId: e.secretaria_id, secretaria: e.secretaria_nome };
    const c = calculos.get(e.id);
    for (const p of c?.pendencias ?? []) {
      linhas.push({ ...base, regra: p.regra, gravidade: p.gravidade, titulo: p.titulo, detalhe: p.detalhe, base: p.base, justificativa: p.justificativa, justificadaEm: p.justificadaEm });
    }
    for (const d of c?.documentosFaltando ?? []) docs.push({ ...base, doc: d.tipo, rotulo: d.rotulo });
  }
  linhas.sort((a, b) => ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade] || a.numero - b.numero);
  const emendasPainel: EmendaPainel[] = emendas.map((e) => ({ id: e.id, numero: e.numero, objeto: e.objeto, valor: e.valor, tipo: tipoDaEmenda(e), secretariaId: e.secretaria_id, secretaria: e.secretaria_nome }));
  const secretarias = Array.from(new Map(emendas.map((e) => [e.secretaria_id, e.secretaria_nome])).entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  return { exercicio, linhas, docs, emendas: emendasPainel, secretarias };
}
