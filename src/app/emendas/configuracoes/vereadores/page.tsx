import { EditorVereadores } from "@/components/emendas/config/editores";
import { listarVereadores } from "@/lib/emendas/dados";

export const dynamic = "force-dynamic";

export default async function PaginaVereadoresConfig() {
  return <EditorVereadores vereadores={await listarVereadores()} />;
}
