/**
 * Regras puras das áreas de trabalho (gráficos | lista | resumo) dos módulos Frotas e Imóveis: filtrar uma lista por "dimensões"
 * (cada gráfico é um filtro), buscar por texto e agrupar para os gráficos. Tudo sobre a lista que a RLS já liberou; o componente
 * só desenha. Os filtros moram na URL (cada dimensão tem o seu parâmetro, os mesmos dos links antigos das telas).
 */

export type ValorDimensao = { chave: string; rotulo: string; cor?: string };

export type Dimensao<T> = {
  chave: string;
  rotulo: string;
  /** Parâmetro da URL que guarda a opção escolhida. */
  param: string;
  /** A(s) opção(ões) a que o item pertence. */
  valores: (item: T) => ValorDimensao[];
  /** Valores de URL que valem por várias opções (ex.: "andamento" = todas as etapas abertas). */
  aliases?: Record<string, string[]>;
  /** Texto do chip de filtro para cada apelido (sem ele, o próprio valor da URL). */
  rotulosAlias?: Record<string, string>;
  /** Valor que vale quando o parâmetro está vazio (ex.: "ativas" esconde as NFs antigas). Não conta como filtro ativo. */
  padrao?: string;
  /** Ordem fixa das opções (o que não estiver aqui vem depois, por quantidade). */
  ordem?: string[];
};

export type Medida<T> = { chave: string; rotulo: string; titulo: string; valor: (item: T) => number; dinheiro: boolean };

export type LerParametro = (param: string) => string | null | undefined;

/** Sem acento e em minúsculas, para a busca ignorar os dois. */
export function normalizarBusca(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Opções que o parâmetro da dimensão está pedindo; `null` = sem filtro. */
export function opcoesPedidas<T>(dim: Dimensao<T>, ler: LerParametro): string[] | null {
  const bruto = ler(dim.param) || dim.padrao || "";
  if (!bruto) return null;
  const lista = dim.aliases?.[bruto];
  if (lista) return lista.length === 0 ? null : lista;
  return [bruto];
}

/** Opção escolhida de forma explícita (o padrão e os apelidos de várias opções não contam). */
export function opcaoEscolhida<T>(dim: Dimensao<T>, ler: LerParametro): string {
  const bruto = ler(dim.param) || "";
  if (!bruto) return "";
  const lista = dim.aliases?.[bruto];
  return lista ? (lista.length === 1 ? lista[0] : "") : bruto;
}

/**
 * Filtra pelas dimensões e pela busca. `ignorar` lista parâmetros que NÃO se aplicam (o gráfico de uma dimensão mostra todas as
 * suas opções, mas respeita os filtros das outras).
 */
export function filtrarItens<T>(
  itens: T[],
  dims: Dimensao<T>[],
  ler: LerParametro,
  busca: { texto: (item: T) => string; q: string } | null,
  ignorar: string[] = []
): T[] {
  const q = busca ? normalizarBusca(busca.q) : "";
  const regras = dims
    .filter((d) => !ignorar.includes(d.param))
    .map((d) => ({ d, pedidas: opcoesPedidas(d, ler) }))
    .filter((r): r is { d: Dimensao<T>; pedidas: string[] } => r.pedidas !== null);
  return itens.filter((item) => {
    for (const { d, pedidas } of regras) {
      if (!d.valores(item).some((v) => pedidas.includes(v.chave))) return false;
    }
    if (q && busca && !normalizarBusca(busca.texto(item)).includes(q)) return false;
    return true;
  });
}

export type GrupoDimensao<T = unknown> = { chave: string; rotulo: string; cor?: string; n: number; soma: number; itens: T[] };

/** Agrupa os itens pelas opções da dimensão (um item pode cair em mais de uma). `soma` é a medida escolhida. */
export function agruparPorDimensao<T>(itens: T[], dim: Dimensao<T>, medida?: Medida<T>): GrupoDimensao<T>[] {
  const mapa = new Map<string, GrupoDimensao<T>>();
  for (const item of itens) {
    for (const v of dim.valores(item)) {
      const g = mapa.get(v.chave) ?? { chave: v.chave, rotulo: v.rotulo, cor: v.cor, n: 0, soma: 0, itens: [] };
      g.n += 1;
      g.itens.push(item);
      g.soma += medida ? medida.valor(item) : 1;
      mapa.set(v.chave, g);
    }
  }
  const ordem = dim.ordem ?? [];
  const posicao = (chave: string) => {
    const i = ordem.indexOf(chave);
    return i === -1 ? ordem.length : i;
  };
  return [...mapa.values()].sort((a, b) => posicao(a.chave) - posicao(b.chave) || b.n - a.n || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Quantos filtros estão valendo (dimensões com opção escolhida + busca), sem contar os padrões. */
export function contarFiltros<T>(dims: Dimensao<T>[], ler: LerParametro, q: string): number {
  return dims.filter((d) => !!ler(d.param)).length + (q.trim() ? 1 : 0);
}
