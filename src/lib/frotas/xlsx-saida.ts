import "server-only";

import type { Tabela } from "@/lib/frotas/relatorios";

/** Nome de aba do Excel: até 31 caracteres, sem \ / ? * [ ] : e sem repetir. */
function nomeDaAba(titulo: string, usados: Set<string>): string {
  const base = titulo.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Planilha";
  let nome = base;
  for (let i = 2; usados.has(nome.toLowerCase()); i++) nome = `${base.slice(0, 28)} ${i}`;
  usados.add(nome.toLowerCase());
  return nome;
}

/** Excel com uma aba por tabela: cabeçalho fixo e em negrito, moeda nas colunas em reais, total em negrito. */
export async function tabelasParaXlsx(opts: { criador: string; tabelas: Tabela[] }): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = opts.criador;
  wb.created = new Date();
  const usados = new Set<string>();

  for (const t of opts.tabelas) {
    const ws = wb.addWorksheet(nomeDaAba(t.aba ?? t.titulo, usados), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = t.colunas.map((c, i) => {
      const maior = Math.max(c.length, ...t.linhas.map((l) => String(l[i] ?? "").length), ...(t.total ? [String(t.total[i] ?? "").length] : []));
      return { header: c, key: `c${i}`, width: Math.min(Math.max(maior + 2, 10), 60) };
    });
    const cabecalho = ws.getRow(1);
    cabecalho.font = { bold: true, color: { argb: "FF1F2937" } };
    cabecalho.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9ECDF" } };
    cabecalho.alignment = { vertical: "middle", wrapText: true };

    for (const linha of t.linhas) ws.addRow(linha.map((v) => (v === "" ? null : v)));
    if (t.total) {
      const l = ws.addRow(t.total.map((v) => (v === "" ? null : v)));
      l.font = { bold: true };
      l.border = { top: { style: "thin" } };
    }
    for (const i of t.monetarias) ws.getColumn(i + 1).numFmt = '"R$" #,##0.00';
  }
  if (opts.tabelas.length === 0) wb.addWorksheet("Vazio");
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
