import { EditorFases } from "@/components/emendas/config/editor-fases";
import { obterCatalogoEtapas, usoDasEtapas } from "@/lib/emendas/dados";

export const dynamic = "force-dynamic";

export default async function PaginaFasesConfig() {
  const [catalogo, uso] = await Promise.all([obterCatalogoEtapas(), usoDasEtapas()]);
  return <EditorFases catalogo={catalogo} uso={uso} />;
}
