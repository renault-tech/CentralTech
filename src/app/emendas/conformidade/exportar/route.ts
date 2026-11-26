import { NextResponse, type NextRequest } from "next/server";

import { carregarConformidade } from "@/lib/emendas/conformidade-dados";
import { descreverFiltrosConformidade, filtrarConformidade, rotuloCodigo, type FiltrosConformidade } from "@/lib/emendas/conformidade-lista";
import { obterContextoEmendas } from "@/lib/emendas/dados";
import { TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { aplicarColunasOcultas, lerColunasOcultas } from "@/lib/frotas/colunas";
import { montarPdfTabelas } from "@/lib/emendas/pdf";
import { tabelasParaXlsx } from "@/lib/frotas/xlsx-saida";

export const dynamic = "force-dynamic";

/**
 * Lista de Conformidade com os MESMOS filtros da tela (item, secretaria, tipo, execução e busca), sob a RLS de quem pede:
 * `?formato=xlsx` (padrão: resumo por item e a lista) ou `pdf` (a lista, pronta para imprimir).
 */
export async function GET(request: NextRequest) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return NextResponse.redirect(new URL("/emendas", request.url));
  const p = request.nextUrl.searchParams;
  const dados = await carregarConformidade(p.get("ano"));
  if (!dados) return NextResponse.redirect(new URL("/emendas", request.url));
  const { exercicio, resumo, linhas } = dados;

  const f: FiltrosConformidade = { i: p.get("i") ?? "", s: p.get("s") ?? "", t: p.get("t") ?? "", x: p.get("x") ?? "", q: p.get("q") ?? "" };
  const nomes = new Map(resumo.map((r) => [r.codigo, r.nome]));
  const nomeTipo = (t: string) => TIPOS_EXECUCAO[t as keyof typeof TIPOS_EXECUCAO]?.nome ?? t;
  const lista = filtrarConformidade(linhas, f, nomes);
  const filtros = descreverFiltrosConformidade(f, nomes, nomeTipo);
  const itensFaltando = (faltas: string[]) => faltas.map((c) => `${rotuloCodigo(c)} · ${nomes.get(c) ?? ""}`).join("; ");
  const colunas = ["Emenda", "Secretaria", "Tipo", "Execução", "Itens faltando", "Objeto"];
  const linhasTabela = lista.map((l) => [l.numero, l.secretaria, nomeTipo(l.tipo), l.executada ? "Já empenhada ou paga" : "Ainda não executada", itensFaltando(l.faltas), l.objeto]);
  const tabelaLista = aplicarColunasOcultas([{ titulo: "Emendas com itens a completar", aba: "Emendas", colunas, monetarias: [], linhas: linhasTabela }], lerColunasOcultas(p.get("sem")))[0];
  const comItemFaltando = linhas.filter((l) => l.faltas.length > 0).length;

  if (p.get("formato") === "pdf") {
    const pdf = montarPdfTabelas({
      titulo: `Conformidade das emendas ${exercicio.ano} (IN TCE-MG 05/2025)`,
      subtitulo: `${lista.length} de ${comItemFaltando} emendas com item faltando · ${filtros}`,
      tabelas: [tabelaLista],
    });
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="conformidade-emendas-${exercicio.ano}.pdf"`, "Cache-Control": "private, no-store" },
    });
  }

  const xlsx = await tabelasParaXlsx({
    criador: "Central Cataguases · Emendas",
    tabelas: [
      {
        titulo: "Resumo",
        colunas: ["Indicador", "Valor"],
        monetarias: [],
        linhas: [["Exercício", exercicio.ano], ["Filtros", filtros], ["Emendas neste arquivo", lista.length], ["Emendas com item faltando no exercício", comItemFaltando], ["Emendas não canceladas", linhas.length]],
      },
      {
        titulo: "Por item",
        colunas: ["Item", "Exigência", "Aplicam", "Atendem", "Faltam"],
        monetarias: [],
        linhas: resumo.map((r) => [`${rotuloCodigo(r.codigo)} · ${r.nome}`, r.exigencia, r.aplicaveis, r.atendem, lista.filter((l) => l.faltas.includes(r.codigo)).length]),
      },
      { ...tabelaLista, titulo: "Emendas" },
    ],
  });
  return new NextResponse(xlsx as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="conformidade-emendas-${exercicio.ano}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
