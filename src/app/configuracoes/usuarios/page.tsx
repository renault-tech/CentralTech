import { listarUsuariosComAcessos } from "@/lib/dados/usuarios";
import { PainelConfiguracoes } from "@/components/hub/painel-configuracoes";

export const dynamic = "force-dynamic";

export default async function PaginaUsuarios() {
  const usuarios = await listarUsuariosComAcessos();

  return <PainelConfiguracoes usuarios={usuarios} />;
}
