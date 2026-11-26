import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";

import { obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { linhasDeSaldo } from "@/lib/emendas/saldos";
import { montarPdfExecutivo } from "@/lib/emendas/pdf-executivo";
import { relatorioDoPanorama } from "@/lib/emendas/relatorio-executivo";
import { CARTOES, pertenceAoCartao, type Cartao } from "@/lib/emendas/encerramento";
import { NOME_DO_CARTAO, carregarPanorama, carregarRestosAnteriores, resumoDoPanorama, tabelasAgrupadas, textoSituacao } from "@/lib/emendas/panorama-dados";

export const dynamic = "force-dynamic";

/**
 * Relatório completo do Panorama da execução, para a prestação de contas e a conciliação com a Contabilidade:
 * `?formato=xlsx` (padrão, todas as abas) ou `pdf` (resumo e quadros). Mesmos filtros da tela; sob a RLS de quem pede.
 */
export async function GET(request: NextRequest) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return NextResponse.redirect(new URL("/emendas", request.url));
  const p = request.nextUrl.searchParams;
  const { exercicio } = await resolverExercicio(p.get("ano"));
  if (!exercicio) return NextResponse.redirect(new URL("/emendas", request.url));
  const s = p.get("s");
  const t = p.get("t");
  const { linhas: todas, conciliacoes } = await carregarPanorama(exercicio.ano);
  // Os MESMOS filtros da tela: secretaria, tipo e o cartão escolhido (antes o cartão não ia para o arquivo e vinha tudo).
  const recorte = todas.filter((l) => (!s || l.secretaria_id === s) && (!t || l.tipo_execucao === t));
  const cartao = (CARTOES as readonly string[]).includes(p.get("c") ?? "") ? (p.get("c") as Cartao) : null;
  const linhas = recorte.filter((l) => !cartao || pertenceAoCartao(l, cartao));
  const resumo = resumoDoPanorama(linhas);
  const grupos = tabelasAgrupadas(linhas);
  const filtros = [
    s && `Secretaria: ${todas.find((l) => l.secretaria_id === s)?.secretaria_nome ?? s}`,
    t && `Tipo de execução: ${t === "direta" ? "Execução direta" : t === "osc" ? "Repasse a OSC" : t === "ente" ? "Repasse a ente" : t}`,
    cartao && `Cartão do Panorama: ${NOME_DO_CARTAO[cartao]}`,
  ].filter((x): x is string => !!x);

  if (p.get("formato") === "pdf") {
    const pdf = montarPdfExecutivo(relatorioDoPanorama({ ano: exercicio.ano, linhas, filtros, totalDoRecorte: recorte.length, comTabela: p.get("tabela") !== "0" }));
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="panorama-execucao-${exercicio.ano}.pdf"`, "Cache-Control": "private, no-store" },
    });
  }

  const wb = new ExcelJS.Workbook();
  const MOEDA = '"R$" #,##0.00';
  const cabecalho = (ws: ExcelJS.Worksheet) => {
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C1D33" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const wf = wb.addWorksheet("Filtros aplicados");
  wf.columns = [{ width: 28 }, { width: 70 }];
  wf.addRow(["Exercício", exercicio.ano]);
  wf.addRow(["Emendas neste arquivo", linhas.length]);
  wf.addRow(["Emendas no recorte (sem o cartão)", recorte.length]);
  wf.addRow(["Filtros", filtros.length ? filtros.join("\n") : "Nenhum"]);
  wf.getRow(4).getCell(2).alignment = { wrapText: true, vertical: "top" };
  wf.getColumn(1).font = { bold: true };

  const ws0 = wb.addWorksheet("Resumo");
  ws0.columns = [{ header: "Indicador", width: 46 }, { header: "Emendas", width: 10 }, { header: "Valor", width: 20 }];
  for (const r of resumo) ws0.addRow([r.nome, r.quantidade, r.valor]);
  ws0.getColumn("C").numFmt = MOEDA;
  cabecalho(ws0);

  for (const g of grupos) {
    const ws = wb.addWorksheet(g.titulo);
    ws.columns = [{ header: "Nome", width: 38 }, { header: "Emendas", width: 10 }, { header: "Valor", width: 18 }, { header: "Empenhado", width: 18 }, { header: "Pago", width: 18 }, { header: "Sem empenhar", width: 18 }, { header: "A pagar", width: 18 }, { header: "Restos a pagar", width: 18 }, { header: "Devolução", width: 16 }, { header: "Cumpridas", width: 11 }, { header: "Sem situação", width: 13 }];
    for (const r of g.linhas) ws.addRow([r.nome, r.emendas, r.valor, r.empenhado, r.pago, r.semEmpenhar, r.aPagar, r.restos, r.devolucao, r.cumpridas, r.semSituacao]);
    for (const c of ["C", "D", "E", "F", "G", "H", "I"]) ws.getColumn(c).numFmt = MOEDA;
    cabecalho(ws);
  }

  const we = wb.addWorksheet("Por emenda");
  const tipoTxt = (t: string | null) => (t === "direta" ? "Execução direta" : t === "osc" ? "Repasse a OSC" : "Repasse a ente");
  const ocultas = new Set((p.get("sem") ?? "").split("|").map((x) => x.trim()).filter(Boolean));
  type Col = { h: string; w: number; moeda?: boolean; v: (l: (typeof linhas)[number]) => string | number | null };
  const todasColunas: Col[] = [
    { h: "Nº", w: 7, v: (l) => l.numero }, { h: "Secretaria", w: 26, v: (l) => l.secretaria_nome }, { h: "Beneficiário", w: 34, v: (l) => l.beneficiario_nome ?? "" },
    { h: "Vereador", w: 26, v: (l) => l.vereador_nome }, { h: "Tipo", w: 14, v: (l) => tipoTxt(l.tipo_execucao) },
    { h: "Valor da emenda", w: 16, moeda: true, v: (l) => l.valor }, { h: "Empenhado", w: 16, moeda: true, v: (l) => l.empenhado }, { h: "Pago", w: 16, moeda: true, v: (l) => l.pago },
    { h: "Sem empenhar", w: 16, moeda: true, v: (l) => l.semEmpenhar || null }, { h: "A pagar", w: 16, moeda: true, v: (l) => l.aPagar || null }, { h: "Situação", w: 30, v: (l) => textoSituacao(l) },
    { h: "Definida em", w: 13, v: (l) => l.encerradaEm ?? "" }, { h: "Economia (não empenhado)", w: 20, moeda: true, v: (l) => l.economia || null }, { h: "Restos a pagar", w: 16, moeda: true, v: (l) => l.restos || null },
    { h: "Empenho a anular", w: 16, moeda: true, v: (l) => l.anular || null }, { h: "Devolução", w: 14, moeda: true, v: (l) => l.devolucao || null }, { h: "Acima da emenda", w: 16, moeda: true, v: (l) => l.excesso || null },
    { h: "Fonte do excesso informada", w: 18, v: (l) => (l.excesso ? (l.semFonte ? "Não" : "Sim") : "") },
  ];
  let colunasEmenda = todasColunas.filter((c) => !ocultas.has(c.h));
  if (colunasEmenda.length === 0) colunasEmenda = todasColunas;
  we.columns = colunasEmenda.map((c) => ({ header: c.h, width: c.w }));
  for (const l of linhas) we.addRow(colunasEmenda.map((c) => c.v(l)));
  colunasEmenda.forEach((c, i) => {
    if (c.moeda) we.getColumn(i + 1).numFmt = MOEDA;
  });
  cabecalho(we);

  // Conciliação com o IPM: o que a Contabilidade precisa anular, registrar ou justificar, emenda por emenda.
  const ids = new Set(linhas.map((l) => l.id));
  const emendasParaSaldo = linhas.map((l) => ({ id: l.id, numero: l.numero, objeto: l.objeto, vereador_nome: l.vereador_nome, secretaria_id: l.secretaria_id, secretaria_nome: l.secretaria_nome, beneficiario_nome: l.beneficiario_nome, valor: l.valor, empenhado: l.empenhado, pago: l.pago, etapa: l.etapa, situacao: l.situacao }));
  const saldos = linhasDeSaldo(emendasParaSaldo, conciliacoes.filter((c) => ids.has(c.id)));
  const wc = wb.addWorksheet("Conciliação IPM");
  wc.columns = [{ header: "Nº", width: 7 }, { header: "Secretaria", width: 26 }, { header: "Saldo não executado", width: 18 }, { header: "Situação do saldo", width: 24 }, { header: "Empenho a anular", width: 18 }, { header: "Anulação", width: 36 }, { header: "Excesso", width: 14 }, { header: "Fonte do excesso", width: 36 }];
  for (const l of saldos)
    wc.addRow([
      l.numero, l.secretaria, l.naoExecutado || null, l.naoExecutado ? (l.naoExecutadoRegistrado ? `Registrado em ${l.registradoEm ?? ""}` : "A registrar") : "",
      l.empenhoAAnular || null, l.empenhoAAnular ? (l.anulacaoSolicitadaEm ? `Solicitada em ${l.anulacaoSolicitadaEm}${l.anulacaoDocumento ? ` · ${l.anulacaoDocumento}` : ""}` : "A solicitar") : "",
      l.excesso || null, l.excessoFonte ?? (l.excesso ? "Sem fonte" : ""),
    ]);
  for (const c of ["C", "E", "G"]) wc.getColumn(c).numFmt = MOEDA;
  cabecalho(wc);

  const anteriores = await carregarRestosAnteriores(exercicio.ano);
  if (anteriores.length > 0) {
    const wr = wb.addWorksheet("Restos de anos anteriores");
    wr.columns = [{ header: "Exercício de origem", width: 18 }, { header: "Nº", width: 7 }, { header: "Secretaria", width: 26 }, { header: "Beneficiário", width: 34 }, { header: "Empenhado", width: 16 }, { header: "Pago", width: 16 }, { header: "A pagar (restos)", width: 18 }];
    for (const l of anteriores) wr.addRow([l.ano, l.numero, l.secretaria_nome, l.beneficiario_nome ?? "", l.empenhado, l.pago, l.aPagar]);
    for (const c of ["E", "F", "G"]) wr.getColumn(c).numFmt = MOEDA;
    cabecalho(wr);
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="panorama-execucao-${exercicio.ano}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
