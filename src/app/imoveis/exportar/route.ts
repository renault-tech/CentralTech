import { NextResponse, type NextRequest } from "next/server";

import { montarPdfTabelas } from "@/lib/emendas/pdf";
import { tabelaParaCsv } from "@/lib/frotas/relatorios";
import { tabelasParaXlsx } from "@/lib/frotas/xlsx-saida";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { obterContextoImoveis } from "@/lib/imoveis/dados";
import { montarTabelas, nomeArquivoImoveis, RELATORIOS_IMOVEIS, type IdRelatorioImoveis } from "@/lib/imoveis/relatorios";

export const dynamic = "force-dynamic";

/**
 * Exporta um relatório do módulo: `?r=imoveis|contas|pendencias|secretarias&formato=xlsx|pdf|csv`. Sempre sob a RLS de quem
 * pede: a secretaria exporta só o que enxerga (os próprios imóveis, contas e pendências).
 */
export async function GET(request: NextRequest) {
  const ctx = await obterContextoImoveis();
  if (ctx.situacao !== "ok") return NextResponse.redirect(new URL("/imoveis", request.url));
  const q = request.nextUrl.searchParams;
  const r = q.get("r") ?? "";
  const formato = q.get("formato") ?? "xlsx";
  if (!RELATORIOS_IMOVEIS.includes(r as IdRelatorioImoveis)) return NextResponse.json({ erro: "Relatório inválido." }, { status: 400 });
  if (!["xlsx", "pdf", "csv"].includes(formato)) return NextResponse.json({ erro: "Formato inválido." }, { status: 400 });

  const t = await carregarTudo();
  const rel = montarTabelas(r as IdRelatorioImoveis, { ...t, pendencias: t.pendencias });
  const cabecalhos = { "Cache-Control": "private, no-store" };

  if (formato === "csv") {
    return new NextResponse(tabelaParaCsv(rel.tabelas[0]), {
      headers: { ...cabecalhos, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nomeArquivoImoveis(r, t.hoje, "csv")}"` },
    });
  }
  if (formato === "pdf") {
    const pdf = montarPdfTabelas({ titulo: `Imoveis e Consumo - ${rel.nome}`, tabelas: rel.tabelas, rodape: "Central Cataguases - Imoveis e Consumo" });
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: { ...cabecalhos, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${nomeArquivoImoveis(r, t.hoje, "pdf")}"` },
    });
  }
  const xlsx = await tabelasParaXlsx({ criador: "Central Cataguases · Imóveis e Consumo", tabelas: rel.tabelas });
  return new NextResponse(xlsx as unknown as BodyInit, {
    headers: {
      ...cabecalhos,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivoImoveis(r, t.hoje, "xlsx")}"`,
    },
  });
}
