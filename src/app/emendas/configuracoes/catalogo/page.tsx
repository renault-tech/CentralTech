import { EditorCatalogoTipo } from "@/components/emendas/config/editor-catalogo-tipo";
import { listarFasesCatalogo, listarItensChecklist, obterCatalogoEtapas } from "@/lib/emendas/dados";

export const dynamic = "force-dynamic";

export default async function PaginaCatalogo() {
  const [fases, itens, catalogo] = await Promise.all([listarFasesCatalogo(), listarItensChecklist(), obterCatalogoEtapas()]);
  const etapas = Object.values(catalogo.etapas).map((e) => ({ chave: e.chave, nome: e.nome }));
  return <EditorCatalogoTipo fases={fases} itens={itens} etapas={etapas} />;
}
