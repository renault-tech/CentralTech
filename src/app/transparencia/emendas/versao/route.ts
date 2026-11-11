import { NextResponse, type NextRequest } from "next/server";

import { obterContextoEmendas } from "@/lib/emendas/dados";
import { anosDoPortal, pacoteDoPortal } from "@/lib/emendas/portal";

export const dynamic = "force-dynamic";

/**
 * "Versão" dos dados publicados (hash curto). O portal consulta isto a cada poucos segundos e,
 * quando muda, recarrega só os dados — sem a pessoa atualizar a página. Resposta minúscula.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const ano = Number(p.get("ano"));
  const previa = p.get("previa") === "1" && (await obterContextoEmendas()).situacao === "ok";
  const anos = await anosDoPortal({ incluirNaoPublicados: previa });
  if (!anos.includes(ano)) return NextResponse.json({ erro: "Exercício não publicado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const { versao, geradoEm } = await pacoteDoPortal(ano);
  return NextResponse.json({ versao, geradoEm }, { headers: { "Cache-Control": "no-store" } });
}
