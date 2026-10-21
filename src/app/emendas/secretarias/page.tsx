import Link from "next/link";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Vazio } from "@/components/emendas/ui";
import { listarEmendas, obterContextoEmendas, podeEditarSecretaria, resolverExercicio } from "@/lib/emendas/dados";
import { brl, brlCurto, infoEtapa, pct, porSecretaria } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

export default async function PaginaSecretarias({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const [{ exercicio }, ctx] = await Promise.all([resolverExercicio(ano), obterContextoEmendas()]);
  if (!exercicio || ctx.situacao !== "ok") return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;

  const emendas = (await listarEmendas(exercicio.ano)).filter((e) => e.situacao !== "cancelada");
  const linhas = porSecretaria(emendas);

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoPagina titulo="Secretarias" subtitulo={`Exercício ${exercicio.ano} · execução das emendas por secretaria responsável`} />
      {linhas.length === 0 && <Vazio>Nenhuma emenda visível para você neste exercício.</Vazio>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {linhas.map((l) => {
          const daSec = emendas.filter((e) => e.secretaria_id === l.secretariaId);
          const semAndamento = daSec.filter((e) => e.etapa === "indicada").length;
          const impedidas = daSec.filter((e) => e.situacao === "impedida").length;
          const emExecucao = daSec.filter((e) => infoEtapa(e.etapa).grupo > 0 && infoEtapa(e.etapa).grupo < 3).length;
          const edita = podeEditarSecretaria(ctx, l.secretariaId);
          return (
            <div key={l.secretariaId} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-cataguases-marinho">{l.nome}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{edita ? "você edita" : "só leitura"}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-semibold tabular-nums text-cataguases-marinho">{brlCurto(l.total)}</span>
                <span className="text-sm font-semibold text-[#4C3494]">{pct(l.pago / l.total, 0)} pago</span>
              </div>
              <div className="relative h-2.5 rounded-full bg-[#DDD6F7]" aria-hidden>
                <div className="h-2.5 rounded-full bg-[#563A9E]" style={{ width: `${(l.pago / l.total) * 100}%` }} />
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="text-slate-500">Sem andamento</dt>
                  <dd className="text-base font-semibold text-cataguases-marinho">{semAndamento}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="text-slate-500">Em execução</dt>
                  <dd className="text-base font-semibold text-cataguases-marinho">{emExecucao}</dd>
                </div>
                <div className={impedidas ? "rounded-lg bg-amber-50 p-2" : "rounded-lg bg-slate-50 p-2"}>
                  <dt className="text-slate-500">Impedidas</dt>
                  <dd className="text-base font-semibold text-cataguases-marinho">{impedidas}</dd>
                </div>
              </dl>
              <div className="flex gap-3 text-[13px]">
                <Link href={`/emendas/lista?ano=${exercicio.ano}&s=${l.secretariaId}`} className="font-medium text-cataguases-azul hover:underline">
                  Ver {l.quantidade} emendas
                </Link>
                <Link href={`/emendas?ano=${exercicio.ano}&s=${l.secretariaId}`} className="text-cataguases-azul hover:underline">
                  Painel
                </Link>
                <span className="ml-auto text-slate-500">{brl(l.pago)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
