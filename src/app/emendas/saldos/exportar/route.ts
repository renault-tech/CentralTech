import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";

import { listarConciliacoes, listarEmendas, obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { linhasDeSaldo, porSecretaria, temTipo, totaisDeSaldo, type TipoSaldo } from "@/lib/emendas/saldos";

export const dynamic = "force-dynamic";

/** Excel dos saldos da conciliação com o IPM (mesmos filtros da tela), sob a RLS de quem pede. */
export async function GET(request: NextRequest) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return NextResponse.redirect(new URL("/emendas", request.url));
  const p = request.nextUrl.searchParams;
  const { exercicio } = await resolverExercicio(p.get("ano"));
  if (!exercicio) return NextResponse.redirect(new URL("/emendas", request.url));
  const emendas = await listarEmendas(exercicio.ano);
  const conc = await listarConciliacoes(emendas.map((e) => e.id));
  const s = p.get("s");
  const k = p.get("k");
  const linhas = linhasDeSaldo(emendas, conc).filter((l) => (!s || l.secretariaId === s) && (!k || temTipo(l, k as TipoSaldo)));
  const t = totaisDeSaldo(linhas);

  const wb = new ExcelJS.Workbook();
  const MOEDA = '"R$" #,##0.00';
  const cabecalho = (ws: ExcelJS.Worksheet) => {
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C1D33" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const resumo = wb.addWorksheet("Resumo");
  resumo.columns = [{ header: "Indicador", width: 40 }, { header: "Valor", width: 18 }, { header: "Detalhe", width: 48 }];
  resumo.addRows([
    ["Saldo não executado (registrado)", t.naoExecutadoRegistrado, ""],
    ["Saldo não executado (a registrar)", t.naoExecutadoARegistrar, `${t.qtdARegistrar} emenda(s)`],
    ["Empenho a anular no IPM", t.empenhoAAnular, `${t.qtdAnular} emenda(s); ${t.anularSolicitado.toFixed(2).replace(".", ",")} já solicitado`],
    ["Excesso sobre o valor da emenda", t.excesso, `${t.excessoSemFonte.toFixed(2).replace(".", ",")} sem fonte informada`],
  ]);
  for (const r of [2, 3, 4, 5]) resumo.getCell(`B${r}`).numFmt = MOEDA;
  cabecalho(resumo);

  const sec = wb.addWorksheet("Por secretaria");
  sec.columns = [{ header: "Secretaria", width: 34 }, { header: "Emendas", width: 10 }, { header: "Não executado", width: 18 }, { header: "Empenho a anular", width: 18 }, { header: "Excesso", width: 16 }];
  for (const r of porSecretaria(linhas)) sec.addRow([r.secretaria, r.emendas, r.naoExecutado, r.empenhoAAnular, r.excesso]);
  for (const c of ["C", "D", "E"]) sec.getColumn(c).numFmt = MOEDA;
  cabecalho(sec);

  const ws = wb.addWorksheet("Por emenda");
  ws.columns = [
    { header: "Nº", width: 7 }, { header: "Secretaria", width: 26 }, { header: "Beneficiário", width: 34 }, { header: "Vereador", width: 26 },
    { header: "Valor da emenda", width: 16 }, { header: "Empenhado", width: 16 }, { header: "Pago", width: 16 },
    { header: "Saldo não executado", width: 18 }, { header: "Situação do saldo", width: 22 },
    { header: "Empenho a anular", width: 18 }, { header: "Anulação", width: 34 },
    { header: "Excesso", width: 14 }, { header: "Fonte do excesso", width: 36 },
  ];
  for (const l of linhas)
    ws.addRow([
      l.numero, l.secretaria, l.beneficiario, l.vereador, l.valor, l.empenhado, l.pago,
      l.naoExecutado || null, l.naoExecutado ? (l.naoExecutadoRegistrado ? `Registrado em ${l.registradoEm ?? ""}` : "A registrar") : "",
      l.empenhoAAnular || null, l.empenhoAAnular ? (l.anulacaoSolicitadaEm ? `Solicitada em ${l.anulacaoSolicitadaEm}${l.anulacaoDocumento ? ` · ${l.anulacaoDocumento}` : ""}` : "A solicitar") : "",
      l.excesso || null, l.excessoFonte ?? (l.excesso ? "Sem fonte" : ""),
    ]);
  for (const c of ["E", "F", "G", "H", "J", "L"]) ws.getColumn(c).numFmt = MOEDA;
  cabecalho(ws);

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="saldos-conciliacao-${exercicio.ano}.xlsx"`,
    },
  });
}
