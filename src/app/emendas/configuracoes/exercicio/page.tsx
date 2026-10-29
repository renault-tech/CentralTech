import { EditorExercicios } from "@/components/emendas/config/editores";
import { EditorDadosPublicacao, EditorDatasExercicio } from "@/components/emendas/config/exequibilidade";
import { listarExercicios } from "@/lib/emendas/dados";

export const dynamic = "force-dynamic";

export default async function PaginaExercicios() {
  const exercicios = await listarExercicios();
  const vigente = exercicios.find((e) => e.situacao === "aberto") ?? exercicios[0];
  return (
    <div className="flex flex-col gap-5">
      <EditorExercicios exercicios={exercicios} />
      {vigente && <EditorDatasExercicio key={vigente.ano} exercicio={vigente} />}
      {vigente && <EditorDadosPublicacao key={`pub-${vigente.ano}`} exercicio={vigente} />}
    </div>
  );
}
