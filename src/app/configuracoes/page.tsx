import { redirect } from "next/navigation";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { listarUsuariosComAcessos } from "@/lib/dados/usuarios";
import { PainelConfiguracoes } from "@/components/hub/painel-configuracoes";

export const dynamic = "force-dynamic";

export default async function PaginaConfiguracoes() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  if (!usuario.admin_hub) redirect("/");

  const usuarios = await listarUsuariosComAcessos();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-xl font-semibold text-cataguases-marinho">Configurações</h1>
      <p className="mt-1 text-sm text-slate-500">
        Quem tem acesso ao hub e quais cards de módulo cada pessoa vê.
      </p>

      <PainelConfiguracoes usuarios={usuarios} />
    </div>
  );
}
