import { EditorExercicios } from "@/components/emendas/config/editores";
import { listarExercicios } from "@/lib/emendas/dados";

export const dynamic = "force-dynamic";

export default async function PaginaExercicios() {
  return <EditorExercicios exercicios={await listarExercicios()} />;
}
