/**
 * Número de processo do Compras digitado na emenda. O Compras usa dois formatos:
 * `numero` = AAAA/NNNN (ano primeiro, ex.: 2026/0062) e `numero_licitacao` = NNN/AAAA
 * (ano por último, ex.: 136/2026).
 */
export type BuscaProcesso = { coluna: "numero" | "numero_licitacao"; valor: string };

export function interpretarNumeroProcesso(texto: string): BuscaProcesso | null {
  const t = texto.trim().replace(/\s+/g, "");
  let m = /^(20\d{2})\/(\d{1,5})$/.exec(t);
  if (m) return { coluna: "numero", valor: `${m[1]}/${m[2].padStart(4, "0")}` };
  m = /^(\d{1,5})\/(\d{4})$/.exec(t);
  if (m) return { coluna: "numero_licitacao", valor: `${m[1].replace(/^0+(?=\d)/, "")}/${m[2]}` };
  return null;
}
