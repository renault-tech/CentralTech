import { listarUsuariosComAcessos } from "@/lib/dados/usuarios";
import {
  listarSetoresCompras,
  listarSecretariasRequerimentos,
  listarDocumentosNumera,
} from "@/lib/dados/solicitacoes";
import { PainelConfiguracoes } from "@/components/hub/painel-configuracoes";

export const dynamic = "force-dynamic";

export default async function PaginaUsuarios() {
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
      setoresCompras={setoresCompras}
      secretariasRequerimentos={secretariasRequerimentos}
      documentosNumera={documentosNumera}
    />
  );
}
