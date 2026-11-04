import "server-only";

import { interpretarPlanilha, type AbaBruta, type ResultadoLeitura } from "@/lib/frotas/importacao/planilha";

/** Valor de célula do ExcelJS → texto (número, data, texto rico, fórmula, link). */
function textoDaCelula(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "object") {
    const v = valor as { richText?: { text: string }[]; text?: unknown; result?: unknown };
    if (Array.isArray(v.richText)) return v.richText.map((p) => p.text).join("");
    if (v.result !== undefined) return textoDaCelula(v.result);
    if (v.text !== undefined) return textoDaCelula(v.text);
    return "";
  }
  return String(valor);
}

/** Lê o .xlsx (todas as abas) e interpreta como cadastro de veículos. */
export async function lerPlanilhaVeiculos(arquivo: ArrayBuffer): Promise<ResultadoLeitura> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arquivo);

  const abas: AbaBruta[] = wb.worksheets.map((ws) => {
    const linhas: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, numero) => {
      const celulas: string[] = [];
      row.eachCell({ includeEmpty: true }, (c, col) => {
        celulas[col - 1] = textoDaCelula(c.value);
      });
      // Preenche os buracos (`eachCell` pula colunas vazias no fim) para o índice bater com o cabeçalho.
      linhas[numero - 1] = Array.from(celulas, (c) => c ?? "");
    });
    return { nome: ws.name, linhas: Array.from(linhas, (l) => l ?? []) };
  });
  return interpretarPlanilha(abas);
}
