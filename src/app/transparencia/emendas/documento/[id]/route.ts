import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { TIPOS_DOCUMENTO_PUBLICO } from "@/lib/emendas/portal";
import { excedeuLimite, ipDoCliente } from "@/lib/seguranca/limite-requisicoes";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Documento público de uma emenda (plano de trabalho, relatório de gestão, anuência do SUS), exigido pela
 * IN TCE-MG 05/2025, art. 7º. Rota SEM login: só entrega esses tipos, de emendas não canceladas, por link
 * temporário do armazenamento (60 s). Qualquer outro anexo continua restrito à gestão.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ erro: "Documento inválido." }, { status: 404 });
  if (await excedeuLimite("portal-documento", await ipDoCliente(), 60, 60)) return NextResponse.json({ erro: "Muitas requisições." }, { status: 429 });

  const db = criarClienteAdminBruto().schema("emendas");
  const { data: doc } = await db.from("documentos").select("tipo,caminho,nome_arquivo,emenda_id").eq("id", id).maybeSingle();
  if (!doc || !(TIPOS_DOCUMENTO_PUBLICO as readonly string[]).includes(doc.tipo as string)) return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });
  const { data: emenda } = await db.from("emendas").select("situacao").eq("id", doc.emenda_id as string).maybeSingle();
  if (!emenda || emenda.situacao === "cancelada") return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });

  const { data } = await criarClienteAdminBruto().storage.from("emendas-documentos").createSignedUrl(doc.caminho as string, 60, { download: false });
  if (!data?.signedUrl) return NextResponse.json({ erro: "Arquivo indisponível." }, { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}
