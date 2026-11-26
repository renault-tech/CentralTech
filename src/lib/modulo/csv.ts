export type ColunaCsv<T> = { titulo: string; valor: (item: T) => string | number | boolean | null | undefined };

function celula(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  let t = typeof v === "number" ? String(v).replace(".", ",") : typeof v === "boolean" ? (v ? "Sim" : "Não") : v;
  // Planilha não executa fórmula vinda de texto: "=", "+", "-" e "@" no começo viram texto.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** CSV no formato que o Excel brasileiro abre direto: BOM, `;` como separador e vírgula decimal. */
export function listaParaCsv<T>(colunas: ColunaCsv<T>[], itens: T[]): string {
  const linhas = [colunas.map((c) => celula(c.titulo)).join(";"), ...itens.map((i) => colunas.map((c) => celula(c.valor(i))).join(";"))];
  return `﻿${linhas.join("\r\n")}\r\n`;
}
