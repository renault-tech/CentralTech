import { Suspense } from "react";
import { Gauge } from "lucide-react";

import { AreaTrabalhoPanorama } from "@/components/emendas/area-trabalho-panorama";
import { Vazio } from "@/components/emendas/ui";
import { resolverExercicio } from "@/lib/emendas/dados";
import { carregarPanorama, carregarRestosAnteriores } from "@/lib/emendas/panorama-dados";

export const dynamic = "force-dynamic";

/**
 * Panorama da execução: o cenário global das emendas do exercício, para acompanhar o ano todo (não só no encerramento).
 * Cada cartão é um filtro e a lista, o quadro e a emenda escolhida moram na área de trabalho (`AreaTrabalhoPanorama`).
 * O Excel/PDF completo serve à prestação de contas e à conciliação com a Contabilidade. Cada pessoa vê o que a RLS libera.
 */
export default async function PaginaPanorama({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const { exercicio } = await resolverExercicio(ano);
  if (!exercicio) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;
  const [{ linhas }, restos] = await Promise.all([carregarPanorama(exercicio.ano), carregarRestosAnteriores(exercicio.ano)]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-cataguases-marinho">
          <Gauge className="h-6 w-6 text-[color:var(--modulo-tinta)]" aria-hidden /> Panorama da execução · {exercicio.ano}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          O que já foi empenhado e pago, o que falta, como cada emenda foi encerrada e o que a Contabilidade precisa conciliar. Clique em um cartão para listar as emendas e em uma emenda para ver os detalhes ao lado.
        </p>
      </div>
      <Suspense>
        <AreaTrabalhoPanorama linhas={linhas} restos={restos} ano={exercicio.ano} />
      </Suspense>
    </div>
  );
}
