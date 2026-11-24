/**
 * Lê uma tabela inteira em páginas de 1000 linhas (limite de linhas por resposta da API).
 *
 * Antes cada página esperava a anterior terminar (3 idas ao banco em série para 2.600 contas). Agora a primeira página
 * já traz o total (`count: "exact"`) e as demais saem juntas: são sempre 2 idas, qualquer que seja o tamanho da tabela.
 * Se o total não vier (resposta inesperada), cai para a leitura em série de sempre.
 */
export const TAMANHO_PAGINA = 1000;

export type OpcoesPagina = { count?: "exact" };
export type RespostaPagina<T> = { data: T[] | null; error: unknown; count?: number | null };
export type BuscaPagina<T> = (de: number, ate: number, opcoes: OpcoesPagina) => PromiseLike<RespostaPagina<T>>;

export async function lerTodasEmParalelo<T>(buscar: BuscaPagina<T>, falhou: (onde: string, erro: unknown) => never, onde: string): Promise<T[]> {
  const primeira = await buscar(0, TAMANHO_PAGINA - 1, { count: "exact" });
  if (primeira.error) falhou(onde, primeira.error);
  const inicio = primeira.data ?? [];
  if (inicio.length < TAMANHO_PAGINA) return inicio;

  const tudo = [...inicio];
  const total = primeira.count;
  if (typeof total === "number" && total > TAMANHO_PAGINA) {
    const inicios: number[] = [];
    for (let de = TAMANHO_PAGINA; de < total; de += TAMANHO_PAGINA) inicios.push(de);
    const paginas = await Promise.all(inicios.map((de) => buscar(de, de + TAMANHO_PAGINA - 1, {})));
    for (const p of paginas) {
      if (p.error) falhou(onde, p.error);
      tudo.push(...(p.data ?? []));
    }
    return tudo;
  }

  // Sem o total: segue em série até a página que não vier cheia.
  for (let de = TAMANHO_PAGINA; ; de += TAMANHO_PAGINA) {
    const p = await buscar(de, de + TAMANHO_PAGINA - 1, {});
    if (p.error) falhou(onde, p.error);
    const pagina = p.data ?? [];
    tudo.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return tudo;
  }
}
