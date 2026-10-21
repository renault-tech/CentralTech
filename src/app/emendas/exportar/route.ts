import { NextResponse, type NextRequest } from "next/server";

import { listarEmendas, listarMovimentos, obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { NOME_MODALIDADE, infoEtapa } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Planilha .xlsx das emendas, com os mesmos filtros da lista. Lida com a
 * sessão de quem pede (RLS): cada pessoa só exporta o que pode ver.
 * Colunas na mesma ordem da planilha de acompanhamento antiga, mais a
 * execução estruturada (empenho, pago, datas).
 */
export async function GET(request: NextRequest) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return NextResponse.redirect(new URL("/emendas", request.url));

  const p = request.nextUrl.searchParams;
  const { exercicio } = await resolverExercicio(p.get("ano"));
  if (!exercicio) return NextResponse.redirect(new URL("/emendas", request.url));

  const numeros = (p.get("numeros") ?? "").split(",").filter(Boolean).map(Number);
  const q = normalizar(p.get("q") ?? "");
  const todas = await listarEmendas(exercicio.ano);
  const emendas = todas.filter(
    (r) =>
      (!p.get("v") || r.vereador_id === p.get("v")) &&
      (!p.get("s") || r.secretaria_id === p.get("s")) &&
      (!p.get("etapa") || r.etapa === p.get("etapa")) &&
      (!p.get("situacao") || r.situacao === p.get("situacao")) &&
      (numeros.length === 0 || numeros.includes(r.numero)) &&
      (!q || q.split(/\s+/).every((parte) => normalizar([r.numero, r.objeto, r.beneficiario_nome ?? "", r.vereador_nome, r.secretaria_nome].join(" ")).includes(parte)))
  );
  const movimentos = await listarMovimentos(emendas.map((e) => e.id));
  const empenhos = new Map<string, string[]>();
  for (const m of movimentos) {
    if (m.tipo === "empenho" && m.numero) empenhos.set(m.emenda_id, [...(empenhos.get(m.emenda_id) ?? []), m.numero]);
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Central Cataguases · Emendas";
  wb.created = new Date();
  const ws = wb.addWorksheet(`Emendas ${exercicio.ano}`, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Emenda", key: "numero", width: 9 },
    { header: "ID", key: "id", width: 6 },
    { header: "Vereador", key: "vereador", width: 34 },
    { header: "Objeto", key: "objeto", width: 50 },
    { header: "Descrição", key: "descricao", width: 60 },
    { header: "Valor", key: "valor", width: 15 },
    { header: "Destinação", key: "beneficiario", width: 32 },
    { header: "Funcional", key: "funcional", width: 18 },
    { header: "Natureza", key: "natureza", width: 11 },
    { header: "Nova dotação", key: "ficha", width: 40 },
    { header: "Unidade", key: "unidade", width: 30 },
    { header: "Secretaria", key: "secretaria", width: 24 },
    { header: "Saúde", key: "saude", width: 7 },
    { header: "Modalidade", key: "modalidade", width: 19 },
    { header: "Etapa", key: "etapa", width: 20 },
    { header: "Situação", key: "situacao", width: 11 },
    { header: "Empenho(s)", key: "empenhos", width: 14 },
    { header: "Empenhado", key: "empenhado", width: 15 },
    { header: "Pago", key: "pago", width: 15 },
    { header: "Data do pagamento", key: "dataPagamento", width: 13 },
    { header: "Remanejada", key: "remanejada", width: 11 },
  ];
  for (const e of emendas) {
    ws.addRow({
      numero: e.numero,
      id: e.numero_vereador,
      vereador: `${String(e.vereador_numero).padStart(2, "0")} - ${e.vereador_nome}`,
      objeto: e.objeto,
      descricao: e.descricao,
      valor: e.valor,
      beneficiario: e.beneficiario_nome ?? "",
      funcional: e.funcional_programatica ?? "",
      natureza: e.natureza_despesa ?? "",
      ficha: e.ficha ?? "",
      unidade: `${e.unidade_codigo} - ${e.unidade_nome}`,
      secretaria: e.secretaria_nome,
      saude: e.saude ? "Sim" : "Não",
      modalidade: NOME_MODALIDADE[e.modalidade],
      etapa: infoEtapa(e.etapa).nome,
      situacao: e.situacao === "normal" ? "" : e.situacao === "impedida" ? "Impedida" : "Cancelada",
      empenhos: (empenhos.get(e.id) ?? []).join(", "),
      empenhado: e.empenhado,
      pago: e.pago,
      dataPagamento: e.ultimo_pagamento ? new Date(`${e.ultimo_pagamento}T12:00:00`) : null,
      remanejada: e.remanejada ? "Sim" : "",
    });
  }
  const ultima = emendas.length + 1;
  const total = ws.addRow({ vereador: "Total", valor: { formula: `SUM(F2:F${ultima})` }, empenhado: { formula: `SUM(R2:R${ultima})` }, pago: { formula: `SUM(S2:S${ultima})` } });
  total.font = { bold: true };

  const cabecalho = ws.getRow(1);
  cabecalho.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecalho.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C1D33" } };
  cabecalho.alignment = { vertical: "middle" };
  cabecalho.height = 22;
  for (const k of ["valor", "empenhado", "pago"]) ws.getColumn(k).numFmt = '"R$" #,##0.00';
  ws.getColumn("dataPagamento").numFmt = "dd/mm/yyyy";
  for (const k of ["descricao", "objeto"]) ws.getColumn(k).alignment = { wrapText: true, vertical: "top" };
  ws.autoFilter = { from: "A1", to: "U1" };

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="emendas-${exercicio.ano}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
