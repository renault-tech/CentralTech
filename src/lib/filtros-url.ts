/**
 * Filtros de lista de TODOS os módulos: valem na hora (sem botão "Filtrar") e vivem na URL, para o recorte
 * poder ser compartilhado por link. Dois caminhos, conforme onde a lista é filtrada:
 *  - lista que chega inteira ao navegador (Emendas): `atualizarFiltrosNaUrl`, com `history.replaceState`;
 *  - lista filtrada no servidor (Frotas, Feedback): `FormularioFiltros`, que usa `montarUrlComParametros`.
 */

/** Monta `caminho?a=1&b=2` descartando valores vazios. */
export function montarUrlComParametros(caminho: string, params: Record<string, string | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const texto = q.toString();
  return texto ? `${caminho}?${texto}` : caminho;
}

/**
 * Atualiza a URL sem refazer a página no servidor: o Next sincroniza `useSearchParams` com `replaceState`.
 * Só a troca de exercício (`ano`) precisa de dados novos e continua indo ao servidor.
 */
export function atualizarFiltrosNaUrl(
  params: URLSearchParams,
  mudancas: Record<string, string | undefined>,
  pathname: string,
  irAoServidor: (url: string) => void
) {
  const p = new URLSearchParams(params.toString());
  for (const [k, v] of Object.entries(mudancas)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const url = `${pathname}${p.toString() ? `?${p}` : ""}`;
  if ("ano" in mudancas) irAoServidor(url);
  else window.history.replaceState(null, "", url);
}
