import { redirect } from "next/navigation";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { listarUsuariosComAcessos } from "@/lib/dados/usuarios";
import { PainelConfiguracoes } from "@/components/hub/painel-configuracoes";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";

export const dynamic = "force-dynamic";

export default async function PaginaConfiguracoes() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  if (!usuario.admin_hub) redirect("/");

  const usuarios = await listarUsuariosComAcessos();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <CabecalhoPagina
        titulo="Configurações"
        subtitulo="Quem tem acesso ao hub e quais cards de módulo cada pessoa vê."
      />

      <PainelConfiguracoes usuarios={usuarios} />
    </div>
  );
}
