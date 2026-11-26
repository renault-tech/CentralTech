import { AssistenteExercicio, type DadosAssistente } from "@/components/emendas/config/assistente-exercicio";
import { EditorExercicios } from "@/components/emendas/config/editores";
import { EditorLimitesLegais } from "@/components/emendas/config/limites-legais";
import { EditorDadosPublicacao, EditorDatasExercicio, EditorPermissaoLancamentos } from "@/components/emendas/config/exequibilidade";
import { listarEmendas, listarVereadores, resolverExercicio } from "@/lib/emendas/dados";
import { carregarPanorama } from "@/lib/emendas/panorama-dados";

export const dynamic = "force-dynamic";

export default async function PaginaExercicios({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const { exercicio: vigente, exercicios } = await resolverExercicio(ano);

  let assistente: DadosAssistente | null = null;
  let somaEmendas = 0;
  if (vigente) {
    const anterior = exercicios.find((e) => e.ano === vigente.ano - 1) ?? null;
    const [emendas, vereadores, panoramaAnterior] = await Promise.all([
      listarEmendas(vigente.ano),
      listarVereadores(),
      anterior ? carregarPanorama(anterior.ano) : Promise.resolve(null),
    ]);
    somaEmendas = emendas.filter((e) => e.situacao !== "cancelada").reduce((t, e) => t + Number(e.valor), 0);
    const falta: string[] = [];
    if (!(vigente.cota_por_vereador > 0)) falta.push("cota por vereador");
    if (!vigente.data_aprovacao_loa) falta.push("data da LOA");
    if (!vigente.numero_lei_loa) falta.push("nº da lei");
    if (!vigente.prazo_exequibilidade) falta.push("prazo de exequibilidade");
    assistente = {
      ano: vigente.ano,
      situacao: vigente.situacao,
      anosExistentes: exercicios.map((e) => e.ano).sort((a, b) => a - b),
      parametrosCompletos: falta.length === 0,
      faltaParametro: falta,
      vereadoresAtivos: vereadores.filter((v) => v.ativo).length,
      emendas: emendas.length,
      remanejadas: emendas.filter((e) => e.remanejada).length,
      anterior:
        anterior && panoramaAnterior
          ? {
              ano: anterior.ano,
              situacao: anterior.situacao,
              semSituacao: panoramaAnterior.linhas.filter((l) => !l.encerramento).length,
              restosAPagar: panoramaAnterior.linhas.filter((l) => l.encerramento === "restos_a_pagar" && l.aPagar > 0.005).length,
            }
          : null,
    };
  }

  return (
    <div className="flex flex-col gap-5">
      {assistente ? <AssistenteExercicio key={assistente.ano} dados={assistente} /> : null}
      <EditorExercicios exercicios={exercicios} />
      {vigente && <EditorLimitesLegais key={`lim-${vigente.ano}`} exercicio={vigente} somaEmendas={somaEmendas} />}
      {vigente && <EditorDatasExercicio key={vigente.ano} exercicio={vigente} />}
      {vigente && <EditorPermissaoLancamentos key={`perm-${vigente.ano}`} exercicio={vigente} />}
      {vigente && <EditorDadosPublicacao key={`pub-${vigente.ano}`} exercicio={vigente} />}
    </div>
  );
}
