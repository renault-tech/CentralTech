import { EditorExercicios } from "@/components/emendas/config/editores";
import { EditorDatasExercicio } from "@/components/emendas/config/exequibilidade";
import { listarExercicios } from "@/lib/emendas/dados";

export const dynamic = "force-dynamic";

export default async function PaginaExercicios() {
  const exercicios = await listarExercicios();
  const vigente = exercicios.find((e) => e.situacao === "aberto") ?? exercicios[0];
  return (
    <div className="flex flex-col gap-5">
      <EditorExercicios exercicios={exercicios} />
      {vigente && <EditorDatasExercicio key={vigente.ano} exercicio={vigente} />}
    </div>
  );
}
