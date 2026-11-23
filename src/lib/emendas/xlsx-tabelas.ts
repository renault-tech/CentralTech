import "server-only";

import type { TabelaPdf } from "@/lib/emendas/pdf";

/** Excel a partir das mesmas tabelas do PDF (uma aba por tabela): cabeçalho fixo, moeda e total em negrito. */
export async function xlsxDeTabelas(
  tabelas: TabelaPdf[],
  resumo?: { titulo: string; linhas: [string, string | number][] },
): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Central Cataguases · Emendas";
  wb.created = new Date();
  if (resumo) {
    const w = wb.addWorksheet("Resumo");
    w.columns = [{ width: 34 }, { width: 70 }];
    w.addRow([resumo.titulo]).font = { bold: true, size: 13 };
    for (const [k, v] of resumo.linhas) w.addRow([k, v]);
    w.getColumn(1).font = { bold: true };
  }
  for (const t of tabelas) {
    const ws = wb.addWorksheet(
      t.titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, " "),
      { views: [{ state: "frozen", ySplit: 1 }] },
    );
    ws.columns = t.colunas.map((c, i) => ({
      header: c,
      width: Math.min(
        60,
        Math.max(
          10,
          c.length + 2,
          ...t.linhas.slice(0, 80).map((l) => String(l[i] ?? "").length + 2),
        ),
      ),
    }));
    for (const l of t.linhas) ws.addRow(l);
    if (t.total) ws.addRow(t.total).font = { bold: true };
    t.colunas.forEach((_, i) => {
      if (t.monetarias.includes(i))
        ws.getColumn(i + 1).numFmt = '"R$" #,##0.00';
    });
    const cab = ws.getRow(1);
    cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cab.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0C1D33" },
    };
    cab.alignment = { vertical: "middle", wrapText: true };
    cab.height = 22;
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
