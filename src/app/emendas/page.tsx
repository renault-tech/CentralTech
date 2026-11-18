import Link from "next/link";
import { Suspense } from "react";
import { Gauge } from "lucide-react";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { FaixaTipos } from "@/components/emendas/faixa-tipos";
import { PainelEmendas } from "@/components/emendas/painel-emendas";
import { medir } from "@/lib/emendas/tempo";
import { calcularEmendasDoExercicio } from "@/lib/emendas/calculos";
import { resumoDaLinha, type ResumoLinha } from "@/lib/emendas/resumo";
import { Vazio } from "@/components/emendas/ui";
import {
  listarEmendas,
  listarMovimentos,
  listarSecretarias,
  listarVereadores,
  resolverExercicio,
} from "@/lib/emendas/dados";
import { brl } from "@/lib/emendas/regras";
import { carregarPanorama } from "@/lib/emendas/panorama-dados";
import { totaisPorCartao } from "@/lib/emendas/encerramento";
import { dataNoFuso } from "@/lib/fuso";

export const dynamic = "force-dynamic";

export default async function PaginaPainelEmendas({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const { ano } = await searchParams;
  const { exercicio, exercicios } = await medir("painel:exercicio", () => resolverExercicio(ano));

  if (!exercicio) {
    return (
      <div className="flex flex-col gap-5">
        <CabecalhoPagina
          titulo="Emendas impositivas"
          subtitulo="Nenhum exercício cadastrado ainda."
        />
        <Vazio>
          Cadastre o exercício (ano e cota por vereador) em Configurações →
          Exercício para começar.
        </Vazio>
      </div>
    );
  }

  const [emendas, vereadores, secretarias] = await medir("painel:emendas+cadastros", () =>
    Promise.all([listarEmendas(exercicio.ano), listarVereadores(), listarSecretarias()])
  );
  const movimentos = await medir("painel:movimentos", () => listarMovimentos(emendas.map((e) => e.id)));
  const calculos = await medir("painel:calculos", () => calcularEmendasDoExercicio(emendas, exercicio, movimentos));
  const resumos: Record<string, ResumoLinha> = {};
  for (const [id, c] of calculos) resumos[id] = resumoDaLinha(c);
  const hoje = dataNoFuso(new Date());
  const vereadoresAtivos = vereadores.filter(
    (v) => v.ativo || emendas.some((e) => e.vereador_id === v.id),
  );

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoPagina
        titulo="Painel das emendas impositivas"
        subtitulo={`Exercício ${exercicio.ano} · ${vereadoresAtivos.length} vereadores · cota individual de ${brl(exercicio.cota_por_vereador)} · ${emendas.length} emendas`}
      />
      {emendas.length === 0 ? (
        <Vazio>
          Nenhuma emenda de {exercicio.ano} visível para você. Gestores
          cadastram em “Nova emenda” ou importam a planilha em Configurações →
          Importar.
        </Vazio>
      ) : (
        <>
          <FaixaTipos
            emendas={emendas}
            resumos={resumos}
            exercicio={exercicio}
            hoje={hoje}
          />
          <Suspense>
            <CartaoPanorama ano={exercicio.ano} />
          </Suspense>
          <Suspense>
            <PainelEmendas
              emendas={emendas}
              movimentos={movimentos}
              vereadores={vereadoresAtivos}
              secretarias={secretarias.filter((s) =>
                emendas.some((e) => e.secretaria_id === s.id),
              )}
              exercicio={exercicio}
              anos={exercicios.map((e) => e.ano)}
              hoje={hoje}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}

/** Resumo do Panorama da execução no Painel: os números que pedem atenção, com o link para o quadro completo. */
async function CartaoPanorama({ ano }: { ano: number }) {
  const { linhas } = await carregarPanorama(ano);
  const t = totaisPorCartao(linhas);
  const itens: [string, string, string][] = [
    ["Cumpridas", String(t.cumprida.quantidade + t.cumprida_economia.quantidade), "c=cumprida"],
    ["Sem situação definida", String(t.sem_situacao.quantidade), "c=sem_situacao"],
    ["Em restos a pagar", brl(t.restos_a_pagar.valor), "c=restos_a_pagar"],
    ["Empenho não pago", brl(t.a_pagar.valor), "c=a_pagar"],
  ];
  return (
    <section aria-label="Panorama da execução" className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-cataguases-marinho">
          <Gauge className="h-4 w-4 text-[#5B3FA8]" aria-hidden /> Panorama da execução
        </h2>
        <Link href={`/emendas/panorama?ano=${ano}`} className="text-xs font-medium text-[#5B3FA8] underline-offset-2 hover:underline">
          Ver o quadro completo
        </Link>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {itens.map(([nome, valor, q]) => (
          <li key={nome}>
            <Link href={`/emendas/panorama?ano=${ano}&${q}`} className="block rounded-lg bg-slate-50 px-3 py-2 transition-colors duration-200 hover:bg-slate-100">
              <span className="block text-[11px] text-slate-500">{nome}</span>
              <span className="text-base font-semibold tabular-nums text-cataguases-marinho">{valor}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
