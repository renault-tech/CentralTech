import { PainelDocumentos } from "@/components/hub/painel-documentos";
import { exigirAdminHub } from "@/lib/auth/exigir-admin";
import { listarPermissoesDocumentos } from "@/lib/dados/documentos-config";
import { statusArmazenamento } from "@/lib/documentos/config";
import { envGoogle } from "@/lib/env";
import { origemDaRequisicao } from "@/lib/origem";

export const dynamic = "force-dynamic";

export default async function PaginaDocumentos({ searchParams }: { searchParams: Promise<{ erro?: string; conectado?: string }> }) {
  await exigirAdminHub();
  const [sp, status, linhas, origem] = await Promise.all([searchParams, statusArmazenamento(), listarPermissoesDocumentos(), origemDaRequisicao()]);
  const g = envGoogle();
  return (
    <PainelDocumentos
      status={status}
      linhas={linhas}
      redirectUri={`${origem}/api/documentos/google/callback`}
      seletorDisponivel={!!(g?.GOOGLE_PICKER_API_KEY && g.GOOGLE_PROJECT_NUMBER)}
      erro={sp.erro}
      conectado={sp.conectado === "1"}
    />
  );
}
