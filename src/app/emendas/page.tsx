import { Suspense } from "react";

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
