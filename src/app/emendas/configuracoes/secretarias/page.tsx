import { EditorSecretarias } from "@/components/emendas/config/editores";
import { listarSecretarias, listarUnidades } from "@/lib/emendas/dados";

export const dynamic = "force-dynamic";

export default async function PaginaSecretariasConfig() {
  const [secretarias, unidades] = await Promise.all([listarSecretarias(), listarUnidades()]);
  return <EditorSecretarias secretarias={secretarias} unidades={unidades} />;
}
