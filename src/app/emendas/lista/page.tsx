import { Suspense } from "react";

import { TabelaEmendas } from "@/components/emendas/tabela-emendas";
import { Vazio } from "@/components/emendas/ui";
import { listarEmendas, listarSecretarias, listarVereadores, resolverExercicio } from "@/lib/emendas/dados";

export const dynamic = "force-dynamic";

export default async function PaginaListaEmendas({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const { exercicio, exercicios } = await resolverExercicio(ano);
  if (!exercicio) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;

  const [emendas, vereadores, secretarias] = await Promise.all([listarEmendas(exercicio.ano), listarVereadores(), listarSecretarias()]);

  return (
    <Suspense>
      <TabelaEmendas
        emendas={emendas}
        vereadores={vereadores.filter((v) => emendas.some((e) => e.vereador_id === v.id))}
        secretarias={secretarias.filter((s) => emendas.some((e) => e.secretaria_id === s.id))}
        ano={exercicio.ano}
        anos={exercicios.map((e) => e.ano)}
      />
    </Suspense>
  );
}
