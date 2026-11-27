import { NextResponse, type NextRequest } from "next/server";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { tokenDeAcesso } from "@/lib/documentos/config";
import { baixar } from "@/lib/documentos/google";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";

/**
 * Abre um documento enviado, em fluxo, a partir do Drive da instituição. Quem pode ler a linha em `documentos_enviados`
 * (gestor, ou quem enviou) pode abrir o arquivo; a RLS decide. Nenhuma pasta precisa de link público no Google.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Documento inválido", { status: 400 });
  const usuario = await obterUsuarioAtual();
  if (!usuario?.ativo) return new NextResponse("Entre na plataforma para abrir o documento.", { status: 401 });

  const emendas = await criarClienteEmendas();
  const { data: env } = await emendas.from("documentos_enviados").select("drive_file_id,nome").eq("id", id).maybeSingle();
  if (!env) return new NextResponse("Documento não encontrado.", { status: 404 });

  try {
    const { token } = await tokenDeAcesso();
    const r = await baixar(token, env.drive_file_id);
    return new NextResponse(r.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(env.nome)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[documentos:arquivo]", e);
    return new NextResponse("Não foi possível abrir o documento agora.", { status: 502 });
  }
}
