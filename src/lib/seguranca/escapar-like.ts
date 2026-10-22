/**
 * Escapa `%`, `_` e `\` para usar texto digitado em `ilike` como igualdade
 * (sem diferenciar maiúsculas). Sem isso, `_` num e-mail casaria com qualquer
 * caractere e um nome `%` casaria com todo mundo.
 */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, "\\$&");
}
