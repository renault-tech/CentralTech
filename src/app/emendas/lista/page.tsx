import { Suspense } from "react";

import { TabelaEmendas } from "@/components/emendas/tabela-emendas";
import { Vazio } from "@/components/emendas/ui";
import { medir } from "@/lib/emendas/tempo";
import { calcularEmendasDoExercicio } from "@/lib/emendas/calculos";
import { resumoDaLinha, type ResumoLinha } from "@/lib/emendas/resumo";
import { listarEmendas, listarSecretarias, listarVereadores, resolverExercicio } from "@/lib/emendas/dados";

export const dynamic = "force-dynamic";

export default async function PaginaListaEmendas({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const { exercicio, exercicios } = await medir("lista:exercicio", () => resolverExercicio(ano));
  if (!exercicio) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;

  const [emendas, vereadores, secretarias] = await medir("lista:emendas+cadastros", () =>
    Promise.all([listarEmendas(exercicio.ano), listarVereadores(), listarSecretarias()])
  );

  const calculos = await medir("lista:calculos", () => calcularEmendasDoExercicio(emendas, exercicio));
  const resumos: Record<string, ResumoLinha> = {};
  for (const [id, c] of calculos) resumos[id] = resumoDaLinha(c);

  return (
    <Suspense>
      <TabelaEmendas
        emendas={emendas}
        resumos={resumos}
        vereadores={vereadores.filter((v) => emendas.some((e) => e.vereador_id === v.id))}
        secretarias={secretarias.filter((s) => emendas.some((e) => e.secretaria_id === s.id))}
        ano={exercicio.ano}
        anos={exercicios.map((e) => e.ano)}
      />
    </Suspense>
  );
}
