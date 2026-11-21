import Link from "next/link";

import { TituloTela } from "@/components/emendas/titulo-tela";
import { Vazio } from "@/components/emendas/ui";
import { listarEmendasEmCache, listarVereadores, obterCatalogoEtapas, resolverExercicio } from "@/lib/emendas/dados";
import { GRUPOS_EXECUCAO, brl, brlCurto, cumpreSaude, numeroVereador, pct, porVereador } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PaginaVereadores({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const { exercicio } = await resolverExercicio(ano);
  if (!exercicio) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;

  const [emendas, vereadores, catalogo] = await Promise.all([listarEmendasEmCache(exercicio.ano), listarVereadores(), obterCatalogoEtapas()]);
  const linhas = porVereador(
    emendas.filter((e) => e.situacao !== "cancelada"),
    vereadores.filter((v) => v.ativo || emendas.some((e) => e.vereador_id === v.id)),
    catalogo
  );

  return (
    <div className="flex flex-col gap-5">
      <TituloTela
        titulo="Vereadores"
        subtitulo={`Exercício ${exercicio.ano} · cota de ${brl(exercicio.cota_por_vereador)} por vereador · mínimo de ${exercicio.percentual_saude_min}% na Saúde`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {linhas.map((l) => {
          const ok = cumpreSaude(l.saude, exercicio.cota_por_vereador, exercicio.percentual_saude_min);
          return (
            <Link
              key={l.vereadorId}
              href={`/emendas/vereadores/${l.vereadorId}?ano=${exercicio.ano}`}
              className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs text-slate-500">nº {numeroVereador(l.numero)}</span>
                  <h2 className="text-[0.9375rem] font-semibold text-cataguases-marinho group-hover:text-[#4C3494]">{l.nome}</h2>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[0.6875rem]", ok ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900")}>
                  Saúde {pct(l.saude / exercicio.cota_por_vereador, 0)}
                </span>
              </div>
              <div className="flex h-3 overflow-hidden rounded bg-slate-100" aria-hidden>
                {[3, 2, 1, 0].map((g) =>
                  l.grupos[g] > 0 ? (
                    <span key={g} className="emd-preenche" style={{ width: `${(l.grupos[g] / exercicio.cota_por_vereador) * 100}%`, backgroundColor: GRUPOS_EXECUCAO[3 - g].cor }} />
                  ) : null
                )}
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>
                  {l.quantidade} emendas · {brlCurto(l.total)} indicados
                </span>
                <span className="font-semibold text-cataguases-marinho">{l.total ? pct(l.pago / l.total, 0) : "0%"} pago</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
