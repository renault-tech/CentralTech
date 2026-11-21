import Link from "next/link";
import { Suspense } from "react";
import { Gauge } from "lucide-react";

import { TituloTela } from "@/components/emendas/titulo-tela";
import { FaixaTipos } from "@/components/emendas/faixa-tipos";
import { PainelEmendas } from "@/components/emendas/painel-emendas";
import { lerComCache } from "@/lib/emendas/cache-dados";
import { medir } from "@/lib/emendas/tempo";
import { calcularEmendasDoExercicio } from "@/lib/emendas/calculos";
import { resumoDaLinha, type ResumoLinha } from "@/lib/emendas/resumo";
import { Vazio } from "@/components/emendas/ui";
import {
  listarEmendasEmCache,
  listarMovimentos,
  listarSecretarias,
  listarVereadores,
  resolverExercicio,
} from "@/lib/emendas/dados";
import { brl } from "@/lib/emendas/regras";
import { carregarPanorama } from "@/lib/emendas/panorama-dados";
import { totaisPorCartao } from "@/lib/emendas/encerramento";
import { dataNoFuso } from "@/lib/fuso";
import { usarNovoDesign } from "@/lib/emendas/design";
import { ComparacaoExercicios } from "@/components/emendas/comparacao-exercicios";
import { anoParaComparar, curvaPercentual, pagoAte, totaisDoExercicio } from "@/lib/emendas/comparacao";
import type { MovimentoResumo } from "@/lib/emendas/dados";
import type { EmendaResumo, Exercicio } from "@/types/emendas";

export const dynamic = "force-dynamic";

export default async function PaginaPainelEmendas({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; comparar?: string }>;
}) {
  const { ano, comparar } = await searchParams;
  const { exercicio, exercicios } = await medir("painel:exercicio", () => resolverExercicio(ano));

  if (!exercicio) {
    return (
      <div className="flex flex-col gap-5">
        <TituloTela
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
    Promise.all([listarEmendasEmCache(exercicio.ano), listarVereadores(), listarSecretarias()])
  );
  const movimentos = await medir("painel:movimentos", () => lerComCache("movimentos", String(exercicio.ano), () => listarMovimentos(emendas.map((e) => e.id))));
  const calculos = await medir("painel:calculos", () => calcularEmendasDoExercicio(emendas, exercicio, movimentos));
  const resumos: Record<string, ResumoLinha> = {};
  for (const [id, c] of calculos) resumos[id] = resumoDaLinha(c);
  const hoje = dataNoFuso(new Date());
  const novo = await usarNovoDesign();
  const vereadoresAtivos = vereadores.filter(
    (v) => v.ativo || emendas.some((e) => e.vereador_id === v.id),
  );

  return (
    <div className="flex flex-col gap-5">
      <TituloTela
        titulo="Painel das emendas" tituloOriginal="Painel das emendas impositivas"
        selo={`Exercício ${exercicio.ano}`}
        subtitulo={`${vereadoresAtivos.length} vereadores · cota individual de ${brl(exercicio.cota_por_vereador)} · ${emendas.length} emendas${exercicio.numero_lei_loa ? ` · ${exercicio.numero_lei_loa}` : ""}`}
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
          {novo && (
            <Suspense>
              <CartaoComparacao
                exercicio={exercicio}
                emendas={emendas}
                movimentos={movimentos}
                anos={exercicios.map((e) => e.ano)}
                comparar={comparar}
                hoje={hoje}
              />
            </Suspense>
          )}
          <Suspense>
            <PainelEmendas
              emendas={emendas}
              movimentos={movimentos}
              vereadores={vereadoresAtivos}
              secretarias={secretarias.filter((s) =>
                emendas.some((e) => e.secretaria_id === s.id),
              )}
              exercicio={exercicio}
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
              <span className="block text-[0.6875rem] text-slate-500">{nome}</span>
              <span className="text-base font-semibold tabular-nums text-cataguases-marinho">{valor}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Comparação com outro exercício. Sem outro ano cadastrado mostra o estado de espera; com ele, calcula e compara sozinha. */
async function CartaoComparacao({
  exercicio,
  emendas,
  movimentos,
  anos,
  comparar,
  hoje,
}: {
  exercicio: Exercicio;
  emendas: EmendaResumo[];
  movimentos: MovimentoResumo[];
  anos: number[];
  comparar?: string;
  hoje: string;
}) {
  const alvo = anoParaComparar(exercicio.ano, anos, comparar);
  const outros = anos.filter((a) => a !== exercicio.ano).sort((a, b) => b - a);
  if (alvo === null) return <ComparacaoExercicios ano={exercicio.ano} dados={null} outros={[]} hrefBase={() => "#"} />;

  const emendasAnt = await listarEmendasEmCache(alvo);
  const movAnt = await lerComCache("movimentos", String(alvo), () => listarMovimentos(emendasAnt.map((e) => e.id)));
  const pagamentos = (m: MovimentoResumo[]) => m.filter((x) => x.tipo === "pagamento").map((x) => ({ data: x.data, valor: Number(x.valor) }));
  const atual = totaisDoExercicio(exercicio.ano, emendas);
  const anterior = totaisDoExercicio(alvo, emendasAnt);
  const pagAtual = pagamentos(movimentos);
  const pagAnt = pagamentos(movAnt);
  // Ano em curso: compara até hoje; ano já passado: o exercício inteiro (31/12).
  const mesDia = hoje.startsWith(`${exercicio.ano}-`) ? hoje.slice(5) : "12-31";
  const [mm, dd] = mesDia.split("-");
  return (
    <ComparacaoExercicios
      ano={exercicio.ano}
      outros={outros}
      hrefBase={(a) => `/emendas?ano=${exercicio.ano}&comparar=${a}`}
      dados={{
        atual,
        anterior,
        curvaAtual: curvaPercentual(pagAtual, exercicio.ano, atual.valor),
        curvaAnterior: curvaPercentual(pagAnt, alvo, anterior.valor),
        mesmoPeriodo: { rotuloData: `${dd}/${mm}`, atual: pagoAte(pagAtual, exercicio.ano, mesDia), anterior: pagoAte(pagAnt, alvo, mesDia) },
        mesAtual: hoje.startsWith(`${exercicio.ano}-`) ? Number(mm) : null,
      }}
    />
  );
}
