import { NextResponse, type NextRequest } from "next/server";

import { obterContextoFrotas } from "@/lib/frotas/dados";
import { montarRelatorio } from "@/lib/frotas/relatorios-dados";
import { aplicarColunasOcultas, lerColunasOcultas } from "@/lib/frotas/colunas";
import { RELATORIOS, RELATORIOS_UMA_TABELA, nomeArquivo, tabelaParaCsv, type IdRelatorio } from "@/lib/frotas/relatorios";
import { tabelasParaXlsx } from "@/lib/frotas/xlsx-saida";
import { montarPdfTabelas } from "@/lib/emendas/pdf";

export const dynamic = "force-dynamic";

/**
 * Exporta um relatório do Frotas: `?r=<relatório>&formato=xlsx|pdf|csv` (mais `sem=Coluna|Coluna` (colunas escondidas) e os
 * filtros da tela, que valem para veículos, NFs e manutenções). `r=completo`
 * só sai em Excel (uma aba por relatório). Sempre sob a RLS de quem pede: quem
 * só consulta exporta o que enxerga.
 */
export async function GET(request: NextRequest) {
  const ctx = await obterContextoFrotas();
  if (ctx.situacao !== "ok") return NextResponse.redirect(new URL("/frotas", request.url));

  const q = request.nextUrl.searchParams;
  const r = q.get("r") ?? "";
  const formato = q.get("formato") ?? "xlsx";
  if (r !== "completo" && !RELATORIOS.includes(r as IdRelatorio)) return NextResponse.json({ erro: "Relatório inválido." }, { status: 400 });
  if (!["xlsx", "pdf", "csv"].includes(formato)) return NextResponse.json({ erro: "Formato inválido." }, { status: 400 });
  if (r === "completo" && formato !== "xlsx") return NextResponse.json({ erro: "A planilha completa só sai em Excel." }, { status: 400 });
  if (formato === "csv" && !RELATORIOS_UMA_TABELA.includes(r as IdRelatorio)) {
    return NextResponse.json({ erro: "Este relatório tem mais de uma tabela: use Excel ou PDF." }, { status: 400 });
  }

  const params = Object.fromEntries([...q.entries()].map(([k, v]) => [k, v]));
  const rel = await montarRelatorio(r as IdRelatorio | "completo", params);
  // Colunas que a pessoa escondeu (`sem=A|B`); a planilha completa sempre sai inteira.
  if (r !== "completo") rel.tabelas = aplicarColunasOcultas(rel.tabelas, lerColunasOcultas(q.get("sem")));
  const cabecalhos = { "Cache-Control": "private, no-store" };

  if (formato === "csv") {
    return new NextResponse(tabelaParaCsv(rel.tabelas[0]), {
      headers: { ...cabecalhos, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nomeArquivo(r, rel.hoje, "csv")}"` },
    });
  }
  if (formato === "pdf") {
    const pdf = montarPdfTabelas({
      titulo: `Frotas - ${rel.nome}`,
      subtitulo: rel.filtrado ? "Com os filtros aplicados na tela." : undefined,
      tabelas: rel.tabelas,
      rodape: "Central Cataguases - Frotas",
    });
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: { ...cabecalhos, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${nomeArquivo(r, rel.hoje, "pdf")}"` },
    });
  }
  const xlsx = await tabelasParaXlsx({ criador: "Central Cataguases · Frotas", tabelas: rel.tabelas });
  return new NextResponse(xlsx as unknown as BodyInit, {
    headers: {
      ...cabecalhos,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo(r, rel.hoje, "xlsx")}"`,
    },
  });
}
