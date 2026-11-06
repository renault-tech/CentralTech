import "server-only";

import { lerPlanilhaContas, type AbaBruta, type Celula, type ResultadoPlanilhaContas } from "@/lib/imoveis/importacao/planilha-contas";

/** Valor de célula do ExcelJS → número ou texto (fórmula usa o resultado; data vira texto AAAA-MM-DD). */
export function valorDaCelula(valor: unknown): Celula {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number" || typeof valor === "string") return valor;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "object") {
    const v = valor as { richText?: { text: string }[]; text?: unknown; result?: unknown };
    if (Array.isArray(v.richText)) return v.richText.map((p) => p.text).join("");
    if (v.result !== undefined) return valorDaCelula(v.result);
    if (v.text !== undefined) return valorDaCelula(v.text);
  }
  return null;
}

/** Lê o .xlsx (todas as abas, números como números) e interpreta como planilha de controle de contas. */
export async function lerArquivoContas(arquivo: ArrayBuffer): Promise<ResultadoPlanilhaContas> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arquivo);
  const abas: AbaBruta[] = wb.worksheets.map((ws) => {
    const linhas: Celula[][] = [];
    // Planilhas do Excel podem declarar milhares de colunas vazias (uma aba real tem 16.382): lê só até a coluna 40.
    ws.eachRow({ includeEmpty: true }, (row, numero) => {
      const celulas: Celula[] = [];
      for (let col = 1; col <= Math.min(40, row.cellCount || 40); col++) celulas[col - 1] = valorDaCelula(row.getCell(col).value);
      linhas[numero - 1] = Array.from(celulas, (c) => c ?? null);
    });
    return { nome: ws.name, linhas: Array.from(linhas, (l) => l ?? []) };
  });
  return lerPlanilhaContas(abas);
}
