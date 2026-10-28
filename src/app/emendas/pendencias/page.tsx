import { Suspense } from "react";

import { ListaPendencias, type LinhaPendencia } from "@/components/emendas/lista-pendencias";
import { Vazio } from "@/components/emendas/ui";
import { medir } from "@/lib/emendas/tempo";
import { calcularEmendasDoExercicio } from "@/lib/emendas/calculos";
import { tipoDaEmenda } from "@/lib/emendas/fases";
import { listarEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { ORDEM_GRAVIDADE } from "@/lib/emendas/pendencias";

export const dynamic = "force-dynamic";

export default async function PaginaPendencias({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const { exercicio } = await medir("pendencias:exercicio", () => resolverExercicio(ano));
  if (!exercicio) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;
  const emendas = await medir("pendencias:emendas", () => listarEmendas(exercicio.ano));
  const calculos = await medir("pendencias:calculos", () => calcularEmendasDoExercicio(emendas, exercicio));

  const linhas: LinhaPendencia[] = [];
  for (const e of emendas) {
    for (const p of calculos.get(e.id)?.pendencias ?? []) {
      linhas.push({
        emendaId: e.id,
        numero: e.numero,
        objeto: e.objeto,
        valor: e.valor,
        tipo: tipoDaEmenda(e),
        secretariaId: e.secretaria_id,
        secretaria: e.secretaria_nome,
        regra: p.regra,
        gravidade: p.gravidade,
        titulo: p.titulo,
        detalhe: p.detalhe,
        base: p.base,
        justificativa: p.justificativa,
        justificadaEm: p.justificadaEm,
      });
    }
  }
  linhas.sort((a, b) => ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade] || a.numero - b.numero);
  const secretarias = Array.from(new Map(emendas.map((e) => [e.secretaria_id, e.secretaria_nome])).entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-cataguases-marinho">Pendências de {exercicio.ano}</h1>
        <p className="mt-1 text-sm text-slate-600">O que merece atenção do gestor. Justificadas ficam fora da lista até os dados mudarem.</p>
      </div>
      <Suspense>
        <ListaPendencias linhas={linhas} secretarias={secretarias} />
      </Suspense>
    </div>
  );
}
