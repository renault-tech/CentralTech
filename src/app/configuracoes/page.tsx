import { redirect } from "next/navigation";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { listarUsuariosComAcessos } from "@/lib/dados/usuarios";
import { listarUsuariosNumera } from "@/lib/dados/numera";
import {
  listarSolicitacoesPendentes,
  listarSetoresCompras,
  listarSecretariasRequerimentos,
  listarDocumentosNumera,
} from "@/lib/dados/solicitacoes";
import { PainelConfiguracoes } from "@/components/hub/painel-configuracoes";
import { PainelSolicitacoes } from "@/components/hub/painel-solicitacoes";
import { PainelLoginDireto } from "@/components/hub/painel-login-direto";
import { ImportadorNumera } from "@/components/hub/importador-numera";
import { CabecalhoHub } from "@/components/layout/cabecalho-hub";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";

export const dynamic = "force-dynamic";

export default async function PaginaConfiguracoes() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  if (!usuario.admin_hub) redirect("/");

  const [usuarios, usuariosNumera, solicitacoes, setoresCompras, secretariasRequerimentos, documentosNumera] =
    await Promise.all([
      listarUsuariosComAcessos(),
      // Env vars do Numera podem ainda não estar configuradas na Vercel —
      // nesse caso a seção de importação só fica vazia, não derruba a tela
      // inteira de Configurações.
      listarUsuariosNumera().catch((e) => {
        console.error("[PaginaConfiguracoes] Numera indisponível:", e);
        return [];
      }),
      listarSolicitacoesPendentes(),
      listarSetoresCompras().catch((e) => {
        console.error("[PaginaConfiguracoes] setores do Compras indisponíveis:", e);
        return [];
      }),
      listarSecretariasRequerimentos().catch((e) => {
        console.error("[PaginaConfiguracoes] secretarias do Requerimentos indisponíveis:", e);
        return [];
      }),
      listarDocumentosNumera().catch((e) => {
        console.error("[PaginaConfiguracoes] documentos do Numera indisponíveis:", e);
        return [];
      }),
    ]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <CabecalhoHub usuario={usuario} />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <CabecalhoPagina
          titulo="Configurações"
          subtitulo="Quem tem acesso ao hub e quais cards de módulo cada pessoa vê."
        />

        <PainelSolicitacoes
          solicitacoes={solicitacoes}
          setoresCompras={setoresCompras}
          secretariasRequerimentos={secretariasRequerimentos}
          documentosNumera={documentosNumera}
        />

        <PainelConfiguracoes usuarios={usuarios} />

        <ImportadorNumera usuarios={usuariosNumera} />

        <PainelLoginDireto />
      </main>
    </div>
  );
}
