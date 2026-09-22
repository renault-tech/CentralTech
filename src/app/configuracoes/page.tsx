import { redirect } from "next/navigation";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { listarUsuariosComAcessos } from "@/lib/dados/usuarios";
import { listarUsuariosNumera } from "@/lib/dados/numera";
import { PainelConfiguracoes } from "@/components/hub/painel-configuracoes";
import { ImportadorNumera } from "@/components/hub/importador-numera";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";

export const dynamic = "force-dynamic";

export default async function PaginaConfiguracoes() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  if (!usuario.admin_hub) redirect("/");

  const [usuarios, usuariosNumera] = await Promise.all([
    listarUsuariosComAcessos(),
    // Env vars do Numera podem ainda não estar configuradas na Vercel —
    // nesse caso a seção de importação só fica vazia, não derruba a tela
    // inteira de Configurações.
    listarUsuariosNumera().catch((e) => {
      console.error("[PaginaConfiguracoes] Numera indisponível:", e);
      return [];
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <CabecalhoPagina
        titulo="Configurações"
        subtitulo="Quem tem acesso ao hub e quais cards de módulo cada pessoa vê."
      />

      <PainelConfiguracoes usuarios={usuarios} />

      <ImportadorNumera usuarios={usuariosNumera} />
    </div>
  );
}
