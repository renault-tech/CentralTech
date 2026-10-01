import { listarUsuariosComAcessos } from "@/lib/dados/usuarios";
import {
  listarSetoresCompras,
  listarSecretariasRequerimentos,
  listarDocumentosNumera,
} from "@/lib/dados/solicitacoes";
import { PainelConfiguracoes } from "@/components/hub/painel-configuracoes";

export const dynamic = "force-dynamic";

export default async function PaginaUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>;
}) {
  // `?novo=1`: os apps (Compras, Requerimentos, Numera) mandam "Conceder
  // acesso" para cá — o acesso é gerenciado só no Hub, e o formulário já
  // abre pronto.
  const { novo } = await searchParams;
  const [usuarios, setoresCompras, secretariasRequerimentos, documentosNumera] = await Promise.all([
    listarUsuariosComAcessos(),
    listarSetoresCompras().catch((e) => {
      console.error("[PaginaUsuarios] setores do Compras indisponíveis:", e);
      return [];
    }),
    listarSecretariasRequerimentos().catch((e) => {
      console.error("[PaginaUsuarios] secretarias do Requerimentos indisponíveis:", e);
      return [];
    }),
    listarDocumentosNumera().catch((e) => {
      console.error("[PaginaUsuarios] documentos do Numera indisponíveis:", e);
      return [];
    }),
  ]);

  return (
    <PainelConfiguracoes
      usuarios={usuarios}
      abrirNovo={novo === "1"}
      setoresCompras={setoresCompras}
      secretariasRequerimentos={secretariasRequerimentos}
      documentosNumera={documentosNumera}
    />
  );
}
