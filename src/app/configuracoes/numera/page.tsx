import { listarUsuariosNumera } from "@/lib/dados/numera";
import { ImportadorNumera } from "@/components/hub/importador-numera";

export const dynamic = "force-dynamic";

export default async function PaginaImportarNumera() {
  // Env vars do Numera podem ainda não estar configuradas na Vercel —
  // nesse caso a seção só fica vazia, não derruba a página.
  const usuarios = await listarUsuariosNumera().catch((e) => {
    console.error("[PaginaImportarNumera] Numera indisponível:", e);
    return [];
  });

  return <ImportadorNumera usuarios={usuarios} />;
}
