import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";

import { ListaPendencias } from "@/components/emendas/lista-pendencias";
import { Vazio } from "@/components/emendas/ui";
import { CLASSE_BOTAO } from "@/components/modulo/ui";
import { obterContextoEmendas } from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";
import { carregarPendencias } from "@/lib/emendas/pendencias-dados";

export const dynamic = "force-dynamic";

export default async function PaginaPendencias({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const [dados, ctx] = await Promise.all([carregarPendencias(ano), obterContextoEmendas()]);
  const gestor = ctx.situacao === "ok" && ehGestor(ctx.perfil);
  if (!dados) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;
  const { exercicio, linhas, docs, emendas, secretarias } = dados;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-cataguases-marinho">Pendências de {exercicio.ano}</h1>
          <p className="mt-1 text-sm text-slate-600">O que merece atenção do gestor. Justificadas ficam fora da lista até os dados mudarem.</p>
        </div>
        {gestor && (
          <Link href="/emendas/nova" className={`${CLASSE_BOTAO} print:hidden`}>
            <Plus className="h-4 w-4" aria-hidden />
            Nova emenda
          </Link>
        )}
      </div>
      <Suspense>
        <ListaPendencias linhas={linhas} docs={docs} emendas={emendas} secretarias={secretarias} ano={exercicio.ano} />
      </Suspense>
    </div>
  );
}
