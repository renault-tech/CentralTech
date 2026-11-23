import { NextResponse, type NextRequest } from "next/server";

import { listarEmendasEmCache, listarVereadores, obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { montarPdfExecutivo } from "@/lib/emendas/pdf-executivo";
import { relatorioDosVereadores } from "@/lib/emendas/relatorio-executivo";
import { xlsxDeTabelas } from "@/lib/emendas/xlsx-tabelas";

export const dynamic = "force-dynamic";

/**
 * Panorama dos vereadores para apresentar (prefeito, Câmara): `?formato=pdf` (gráficos + tabela, padrão),
 * `pdf&tabela=0` (só os gráficos, para projetar) ou `xlsx` (comparativo). Sob a RLS de quem pede.
 */
export async function GET(request: NextRequest) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return NextResponse.redirect(new URL("/emendas", request.url));
  const p = request.nextUrl.searchParams;
  const { exercicio } = await resolverExercicio(p.get("ano"));
  if (!exercicio) return NextResponse.redirect(new URL("/emendas", request.url));

  const [emendas, vereadores] = await Promise.all([listarEmendasEmCache(exercicio.ano), listarVereadores()]);
  const ativos = vereadores.filter((v) => v.ativo || emendas.some((e) => e.vereador_id === v.id));
  const rel = relatorioDosVereadores({
    ano: exercicio.ano,
    emendas,
    vereadores: ativos,
    cota: exercicio.cota_por_vereador,
    percentualSaudeMin: exercicio.percentual_saude_min,
    comTabela: p.get("tabela") !== "0",
  });

  if (p.get("formato") === "xlsx") {
    const completo = relatorioDosVereadores({ ano: exercicio.ano, emendas, vereadores: ativos, cota: exercicio.cota_por_vereador, percentualSaudeMin: exercicio.percentual_saude_min, comTabela: true });
    const buf = await xlsxDeTabelas(completo.tabelas ?? [], { titulo: completo.titulo, linhas: [["Recorte", completo.contagem ?? ""], ["Observação", completo.subtitulo ?? ""]] });
    return new NextResponse(buf, {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="vereadores-${exercicio.ano}.xlsx"`, "Cache-Control": "private, no-store" },
    });
  }
  const pdf = montarPdfExecutivo(rel);
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="vereadores-${exercicio.ano}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
