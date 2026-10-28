import { NextResponse, type NextRequest } from "next/server";

import { obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { tabelaParaCsv } from "@/lib/emendas/relatorios";
import { RELATORIOS, montarRelatorio, type Relatorio } from "@/lib/emendas/relatorios-dados";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return NextResponse.redirect(new URL("/emendas", request.url));
  const r = request.nextUrl.searchParams.get("r") as Relatorio;
  if (!RELATORIOS.includes(r)) return NextResponse.json({ erro: "Relatório inválido." }, { status: 400 });
  const { exercicio } = await resolverExercicio(request.nextUrl.searchParams.get("ano"));
  if (!exercicio) return NextResponse.redirect(new URL("/emendas", request.url));
  const tabela = await montarRelatorio(r, exercicio.ano);
  return new NextResponse(tabelaParaCsv(tabela), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="emendas-${r}-${exercicio.ano}.csv"` },
  });
}
