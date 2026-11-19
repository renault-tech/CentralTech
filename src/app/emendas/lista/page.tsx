import { Suspense } from "react";

import { TabelaEmendas } from "@/components/emendas/tabela-emendas";
import { Vazio } from "@/components/emendas/ui";
import { medir } from "@/lib/emendas/tempo";
import { calcularEmendasDoExercicio } from "@/lib/emendas/calculos";
import { resumoDaLinha, type ResumoLinha } from "@/lib/emendas/resumo";
import { listarEmendasEmCache, obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

export default async function PaginaListaEmendas({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const { exercicio } = await medir("lista:exercicio", () => resolverExercicio(ano));
  if (!exercicio) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;

  const [emendas, ctx] = await medir("lista:emendas", () => Promise.all([listarEmendasEmCache(exercicio.ano), obterContextoEmendas()]));

  const calculos = await medir("lista:calculos", () => calcularEmendasDoExercicio(emendas, exercicio));
  const resumos: Record<string, ResumoLinha> = {};
  for (const [id, c] of calculos) resumos[id] = resumoDaLinha(c);

  return (
    <Suspense>
      <TabelaEmendas
        emendas={emendas}
        resumos={resumos}
        ano={exercicio.ano}
        podeCriar={ctx.situacao === "ok" && ehGestor(ctx.perfil)}
      />
    </Suspense>
  );
}
