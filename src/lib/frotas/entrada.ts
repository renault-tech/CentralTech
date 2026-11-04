/** Leitura de campos digitados nos formulários do Frotas (funções puras, testadas em `entrada.test.ts`). */

/** "R$ 1.234,56", "1234,56" e "1234.56" → número; vazio → null; ilegível → NaN. */
export function lerValor(texto: string): number | null {
  const bruto = texto.replace(/R\$|\s/g, "");
  if (!bruto) return null;
  // Com vírgula, o ponto é separador de milhar ("1.234,56"); sem vírgula, o ponto é decimal ("1234.56").
  const normal = bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
  return /^\d+(\.\d+)?$/.test(normal) ? Number(normal) : Number.NaN;
}

/** Número → texto de campo ("1234.5" → "1234,50"). */
export function valorParaCampo(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "" : valor.toFixed(2).replace(".", ",");
}
