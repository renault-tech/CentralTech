import {
  listarSolicitacoesPendentes,
  listarSolicitacoesDecididas,
  listarSetoresCompras,
  listarSecretariasRequerimentos,
  listarDocumentosNumera,
} from "@/lib/dados/solicitacoes";
import { PainelSolicitacoes } from "@/components/hub/painel-solicitacoes";

export const dynamic = "force-dynamic";

export default async function PaginaSolicitacoes() {
  const [solicitacoes, decididas, setoresCompras, secretariasRequerimentos, documentosNumera] =
    await Promise.all([
      listarSolicitacoesPendentes(),
      listarSolicitacoesDecididas(),
      listarSetoresCompras().catch((e) => {
        console.error("[PaginaSolicitacoes] setores do Compras indisponíveis:", e);
        return [];
      }),
      listarSecretariasRequerimentos().catch((e) => {
        console.error("[PaginaSolicitacoes] secretarias do Requerimentos indisponíveis:", e);
        return [];
      }),
      listarDocumentosNumera().catch((e) => {
        console.error("[PaginaSolicitacoes] documentos do Numera indisponíveis:", e);
        return [];
      }),
    ]);

  return (
    <PainelSolicitacoes
      solicitacoes={solicitacoes}
      decididas={decididas}
      setoresCompras={setoresCompras}
      secretariasRequerimentos={secretariasRequerimentos}
      documentosNumera={documentosNumera}
    />
  );
}
