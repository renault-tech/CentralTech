import { NextResponse, type NextRequest } from "next/server";

import { obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { montarPdfTabelas } from "@/lib/emendas/pdf";
import { RELATORIOS, montarRelatorio, type Relatorio } from "@/lib/emendas/relatorios-dados";

export const dynamic = "force-dynamic";

/** PDF dos relatórios: `?r=<relatório>` (um) ou sem `r` (todos), sempre sob a RLS de quem pede. */
export async function GET(request: NextRequest) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return NextResponse.redirect(new URL("/emendas", request.url));
  const r = request.nextUrl.searchParams.get("r");
  if (r && !RELATORIOS.includes(r as Relatorio)) return NextResponse.json({ erro: "Relatório inválido." }, { status: 400 });
  const { exercicio } = await resolverExercicio(request.nextUrl.searchParams.get("ano"));
  if (!exercicio) return NextResponse.redirect(new URL("/emendas", request.url));

  const quais = r ? [r as Relatorio] : RELATORIOS;
  const tabelas = await Promise.all(quais.map((q) => montarRelatorio(q, exercicio.ano)));
  const pdf = montarPdfTabelas({
    titulo: `Relatórios das emendas impositivas - ${exercicio.ano}`,
    subtitulo: "Dados de apoio à prestação de contas (IN TCE-MG 05/2025; LRF, art. 48-A; Lei 13.019/2014; Lei 4.320/1964). O envio oficial segue o sistema do TCE-MG.",
    tabelas,
  });
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="emendas-${r ?? "relatorios"}-${exercicio.ano}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
