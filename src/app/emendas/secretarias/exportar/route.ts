import { NextResponse, type NextRequest } from "next/server";

import { listarEmendasEmCache, obterCatalogoEtapas, obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { montarPdfExecutivo } from "@/lib/emendas/pdf-executivo";
import { relatorioDasSecretarias } from "@/lib/emendas/relatorio-executivo";
import { xlsxDeTabelas } from "@/lib/emendas/xlsx-tabelas";

export const dynamic = "force-dynamic";

/** Panorama das secretarias: `?formato=pdf` (gráficos + tabela), `pdf&tabela=0` (só gráficos) ou `xlsx`. Sob a RLS de quem pede. */
export async function GET(request: NextRequest) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return NextResponse.redirect(new URL("/emendas", request.url));
  const p = request.nextUrl.searchParams;
  const { exercicio } = await resolverExercicio(p.get("ano"));
  if (!exercicio) return NextResponse.redirect(new URL("/emendas", request.url));

  const [emendas, catalogo] = await Promise.all([listarEmendasEmCache(exercicio.ano), obterCatalogoEtapas()]);
  if (p.get("formato") === "xlsx") {
    const completo = relatorioDasSecretarias({ ano: exercicio.ano, emendas, catalogo, comTabela: true });
    const buf = await xlsxDeTabelas(completo.tabelas ?? [], { titulo: completo.titulo, linhas: [["Recorte", completo.contagem ?? ""]] });
    return new NextResponse(buf, {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="secretarias-${exercicio.ano}.xlsx"`, "Cache-Control": "private, no-store" },
    });
  }
  const pdf = montarPdfExecutivo(relatorioDasSecretarias({ ano: exercicio.ano, emendas, catalogo, comTabela: p.get("tabela") !== "0" }));
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="secretarias-${exercicio.ano}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
