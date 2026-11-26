import { NextResponse, type NextRequest } from "next/server";

import { obterContextoEmendas } from "@/lib/emendas/dados";
import { TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { NOME_GRAVIDADE } from "@/lib/emendas/pendencias";
import {
  descreverFiltros,
  documentosFaltando,
  docsDoFiltro,
  filtrarPendencias,
  indicadores,
  lerFiltros,
  nomeDaRegra,
  areaDaLinha,
  porArea,
  porAssunto,
  porMotivo,
  porSecretaria,
  porTipo,
  type Grupo,
} from "@/lib/emendas/painel-pendencias";
import { carregarPendencias } from "@/lib/emendas/pendencias-dados";
import { aplicarColunasOcultas, lerColunasOcultas } from "@/lib/frotas/colunas";
import { montarPdfTabelas } from "@/lib/emendas/pdf";
import { tabelasParaXlsx } from "@/lib/frotas/xlsx-saida";

export const dynamic = "force-dynamic";

const COLUNAS_GRUPO = ["Pendências", "Altas", "Médias", "Baixas", "Emendas afetadas", "Valor das emendas afetadas"];
const linhaGrupo = (g: Grupo, rotulo = g.rotulo) => [rotulo, g.total, g.alta, g.media, g.baixa, g.emendas, g.valor];

/** Excel do painel de Pendências: totais por corte, documentos faltando e a lista, com os filtros da tela e a RLS de quem pede. */
export async function GET(request: NextRequest) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return NextResponse.redirect(new URL("/emendas", request.url));
  const p = request.nextUrl.searchParams;
  const dados = await carregarPendencias(p.get("ano"));
  if (!dados) return NextResponse.redirect(new URL("/emendas", request.url));
  const { exercicio, linhas, docs, emendas, secretarias } = dados;

  const f = lerFiltros((k) => p.get(k));
  const lista = filtrarPendencias(linhas, f);
  const ind = indicadores(lista, linhas, emendas, f);
  const filtros = descreverFiltros(f, {
    tipo: f.t ? TIPOS_EXECUCAO[f.t as keyof typeof TIPOS_EXECUCAO]?.nome : undefined,
    gravidade: f.g ? NOME_GRAVIDADE[f.g as keyof typeof NOME_GRAVIDADE] : undefined,
    secretaria: secretarias.find((s) => s.id === f.s)?.nome,
    motivo: f.m ? linhas.flatMap((l) => l.motivos ?? []).find((m) => m.chave === f.m)?.rotulo : undefined,
  });
  const nomeTipo = (t: string) => TIPOS_EXECUCAO[t as keyof typeof TIPOS_EXECUCAO]?.nome ?? t;
  const faltando = documentosFaltando(docs, f);
  // Com um documento faltando escolhido na tela, a lista é das emendas que ainda não o têm.
  const semDoc = docsDoFiltro(docs, f);
  const rotuloDoc = docs.find((x) => x.doc === f.d)?.rotulo ?? f.d ?? "";
  const colunasPend = ["Emenda", "Secretaria", "Tipo", "Valor (R$)", "Gravidade", "Área", "Assunto", "Motivo", "Pendência", "Detalhe", "Justificada"];
  const linhasPend = lista.map((l) => [l.numero, l.secretaria, nomeTipo(l.tipo), l.valor, NOME_GRAVIDADE[l.gravidade], areaDaLinha(l), nomeDaRegra(l), (l.motivos ?? []).map((m) => m.rotulo).join("; "), l.titulo, l.detalhe, l.justificativa ? "Sim" : ""]);
  const colunasDoc = ["Emenda", "Secretaria", "Tipo", "Valor (R$)", "Objeto"];
  const linhasDoc = semDoc.map((d) => [d.numero, d.secretaria, nomeTipo(d.tipo), d.valor, d.objeto]);

  const ocultas = lerColunasOcultas(p.get("sem"));
  const listaPend = (comDetalhe: boolean) =>
    aplicarColunasOcultas([{ titulo: "Pendências", colunas: comDetalhe ? colunasPend : colunasPend.filter((c) => c !== "Detalhe"), monetarias: [3], linhas: comDetalhe ? linhasPend : linhasPend.map((l) => l.filter((_, i) => i !== 9)) }], ocultas)[0];
  const listaDoc = (titulo: string) => aplicarColunasOcultas([{ titulo, colunas: colunasDoc, monetarias: [3], linhas: linhasDoc }], ocultas)[0];

  if (p.get("formato") === "pdf") {
    const pdf = montarPdfTabelas({
      titulo: `Pendências das emendas ${exercicio.ano}`,
      subtitulo: `${f.d ? `${semDoc.length} emendas sem ${rotuloDoc.toLowerCase()}` : `${lista.length} pendências em ${ind.emendasAfetadas} emendas`}${filtros ? ` · ${filtros}` : ""}`,
      tabelas: f.d
        ? [listaDoc(`Emendas sem ${rotuloDoc.toLowerCase()}`)]
        : [listaPend(false)],
    });
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="pendencias-emendas-${exercicio.ano}.pdf"`, "Cache-Control": "private, no-store" },
    });
  }

  const xlsx = await tabelasParaXlsx({
    criador: "Central Cataguases · Emendas",
    tabelas: [
      {
        titulo: "Resumo",
        colunas: ["Indicador", "Valor"],
        monetarias: [],
        linhas: [
          ["Exercício", exercicio.ano],
          ["Filtros", filtros],
          ["Pendências abertas", ind.pendencias],
          ["Pendências altas", ind.altas],
          ["Emendas afetadas", ind.emendasAfetadas],
          ["Emendas no recorte", ind.emendasNoRecorte],
          ["Valor das emendas afetadas (R$)", ind.valorAfetado],
          ["Valor das emendas no recorte (R$)", ind.valorNoRecorte],
          ["Pendências justificadas (fora da contagem)", ind.justificadas],
        ],
      },
      { titulo: "Por área", colunas: ["Área", ...COLUNAS_GRUPO], monetarias: [6], linhas: porArea(lista).map((g) => linhaGrupo(g)) },
      { titulo: "Por assunto", colunas: ["Assunto", ...COLUNAS_GRUPO], monetarias: [6], linhas: porAssunto(lista).map((g) => linhaGrupo(g)) },
      { titulo: "Por motivo", colunas: ["Motivo", ...COLUNAS_GRUPO], monetarias: [6], linhas: porMotivo(lista, true).map((g) => linhaGrupo(g)) },
      { titulo: "Por secretaria", colunas: ["Secretaria", ...COLUNAS_GRUPO], monetarias: [6], linhas: porSecretaria(lista).map((g) => linhaGrupo(g)) },
      { titulo: "Por tipo de execução", colunas: ["Tipo", ...COLUNAS_GRUPO], monetarias: [6], linhas: porTipo(lista).map((g) => linhaGrupo(g, nomeTipo(g.chave))) },
      {
        titulo: "Documentos faltando",
        colunas: ["Documento", "Emendas", "Valor das emendas (R$)", "Números das emendas"],
        monetarias: [2],
        linhas: faltando.map((g) => [g.rotulo, g.emendas.length, g.valor, g.emendas.map((e) => e.numero).join(", ")]),
      },
      f.d
        ? listaDoc("Emendas sem o documento")
        : { ...listaPend(true), titulo: "Pendências (lista)" },
    ],
  });
  return new NextResponse(xlsx as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pendencias-emendas-${exercicio.ano}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
