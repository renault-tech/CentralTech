/**
 * Filtros do painel e da lista vivem na URL (para compartilhar o recorte por
 * link), mas quem filtra é o navegador sobre dados que já chegaram. Por isso
 * a URL é atualizada com `history.replaceState` — o Next sincroniza
 * `useSearchParams` com ela sem refazer a página no servidor. Só a troca de
 * exercício (`ano`) precisa de dados novos e continua indo ao servidor.
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
