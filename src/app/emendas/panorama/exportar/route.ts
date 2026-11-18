import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";

import { obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { linhasDeSaldo } from "@/lib/emendas/saldos";
import { montarPdfTabelas } from "@/lib/emendas/pdf";
import { carregarPanorama, resumoDoPanorama, tabelasAgrupadas, textoSituacao } from "@/lib/emendas/panorama-dados";

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
  const linhas = todas.filter((l) => (!s || l.secretaria_id === s) && (!t || l.tipo_execucao === t));
  const resumo = resumoDoPanorama(linhas);
  const grupos = tabelasAgrupadas(linhas);

  if (p.get("formato") === "pdf") {
    const pdf = montarPdfTabelas({
      titulo: `Panorama da execução das emendas impositivas - ${exercicio.ano}`,
      subtitulo: "Resumo para prestação de contas e conciliação com a Contabilidade. Valores contábeis exatos, conforme o IPM (Lei 4.320/1964, art. 36, para restos a pagar).",
      tabelas: [
        { titulo: "Resumo", colunas: ["Indicador", "Emendas", "Valor"], linhas: resumo.map((r) => [r.nome, r.quantidade, r.valor]), monetarias: [2] },
        ...grupos.map((g) => ({
          titulo: g.titulo,
          colunas: ["Nome", "Emendas", "Valor", "Empenhado", "Pago", "Sem empenhar", "Restos a pagar", "Cumpridas", "Sem situação"],
          linhas: g.linhas.map((r) => [r.nome, r.emendas, r.valor, r.empenhado, r.pago, r.semEmpenhar, r.restos, r.cumpridas, r.semSituacao]),
          monetarias: [2, 3, 4, 5, 6],
        })),
        {
          titulo: "Por emenda",
          colunas: ["Nº", "Secretaria", "Valor", "Empenhado", "Pago", "Sem empenhar", "A pagar", "Situação"],
          linhas: linhas.map((l) => [l.numero, l.secretaria_nome, l.valor, l.empenhado, l.pago, l.semEmpenhar, l.aPagar, textoSituacao(l)]),
          monetarias: [2, 3, 4, 5, 6],
        },
      ],
    });
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
  we.columns = [
    { header: "Nº", width: 7 }, { header: "Secretaria", width: 26 }, { header: "Beneficiário", width: 34 }, { header: "Vereador", width: 26 }, { header: "Tipo", width: 14 },
    { header: "Valor da emenda", width: 16 }, { header: "Empenhado", width: 16 }, { header: "Pago", width: 16 }, { header: "Sem empenhar", width: 16 }, { header: "A pagar", width: 16 },
    { header: "Situação", width: 30 }, { header: "Definida em", width: 13 }, { header: "Economia (não empenhado)", width: 20 }, { header: "Restos a pagar", width: 16 },
    { header: "Empenho a anular", width: 16 }, { header: "Devolução", width: 14 }, { header: "Acima da emenda", width: 16 }, { header: "Fonte do excesso informada", width: 18 },
  ];
  for (const l of linhas)
    we.addRow([
      l.numero, l.secretaria_nome, l.beneficiario_nome ?? "", l.vereador_nome, l.tipo_execucao === "direta" ? "Execução direta" : l.tipo_execucao === "osc" ? "Repasse a OSC" : "Repasse a ente",
      l.valor, l.empenhado, l.pago, l.semEmpenhar || null, l.aPagar || null, textoSituacao(l), l.encerradaEm ?? "", l.economia || null, l.restos || null, l.anular || null, l.devolucao || null, l.excesso || null, l.excesso ? (l.semFonte ? "Não" : "Sim") : "",
    ]);
  for (const c of ["F", "G", "H", "I", "J", "M", "N", "O", "P", "Q"]) we.getColumn(c).numFmt = MOEDA;
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

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="panorama-execucao-${exercicio.ano}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
