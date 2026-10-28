import { NextResponse, type NextRequest } from "next/server";

import { anosDoPortal, dadosDoPortal, nomesDasEtapas, paraCsv } from "@/lib/emendas/portal";

export const dynamic = "force-dynamic";

/** Dados abertos das emendas (CSV ou JSON). Público, sem login, só campos de transparência. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const anos = await anosDoPortal();
  const pedido = Number(p.get("ano"));
  const ano = anos.includes(pedido) ? pedido : anos[0];
  if (!ano) return NextResponse.json({ erro: "Nenhum exercício publicado." }, { status: 404 });
  const [linhas, etapas] = await Promise.all([dadosDoPortal(ano), nomesDasEtapas()]);
  const cabecalhos = { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" };

  if (p.get("formato") === "json") {
    return NextResponse.json(
      { fonte: "Prefeitura de Cataguases — Emendas impositivas", ano, emendas: linhas.map((l) => ({ ...l, fase: etapas[l.etapa] ?? l.etapa })) },
      { headers: cabecalhos }
    );
  }
  return new NextResponse(paraCsv(linhas, (c) => etapas[c] ?? c), {
    headers: { ...cabecalhos, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="emendas-${ano}.csv"` },
  });
}
