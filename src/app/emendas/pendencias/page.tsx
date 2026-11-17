import { Suspense } from "react";

import { ListaPendencias } from "@/components/emendas/lista-pendencias";
import { Vazio } from "@/components/emendas/ui";
import { carregarPendencias } from "@/lib/emendas/pendencias-dados";

export const dynamic = "force-dynamic";

export default async function PaginaPendencias({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const dados = await carregarPendencias(ano);
  if (!dados) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;
  const { exercicio, linhas, docs, emendas, secretarias } = dados;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-cataguases-marinho">Pendências de {exercicio.ano}</h1>
        <p className="mt-1 text-sm text-slate-600">O que merece atenção do gestor. Justificadas ficam fora da lista até os dados mudarem.</p>
      </div>
      <Suspense>
        <ListaPendencias linhas={linhas} docs={docs} emendas={emendas} secretarias={secretarias} ano={exercicio.ano} />
      </Suspense>
    </div>
  );
}
