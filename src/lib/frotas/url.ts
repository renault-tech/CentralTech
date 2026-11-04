/** Monta uma URL com parâmetros, descartando os vazios (mantém os filtros ao abrir um registro). */
export function montarUrl(base: string, params: Record<string, string | undefined | null | false>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const texto = q.toString();
  return texto ? `${base}?${texto}` : base;
}
