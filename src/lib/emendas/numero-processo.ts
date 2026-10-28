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

const PARADAS = new Set([
  "para", "com", "sem", "dos", "das", "por", "uma", "uns", "umas", "que", "como", "mais", "entre", "sobre", "ate", "até",
  "aquisicao", "aquisição", "contratacao", "contratação", "servico", "serviço", "servicos", "serviços", "municipal", "municipio", "município",
  "cataguases", "prefeitura", "secretaria", "emenda", "impositiva", "recursos",
]);

/** Palavras do objeto que servem de pista para achar o processo (só letras/dígitos: seguras em filtro PostgREST). */
export function palavrasChave(texto: string, max = 4): string[] {
  const vistas = new Set<string>();
  for (const p of texto.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (p.length >= 4 && !PARADAS.has(p)) vistas.add(p);
  }
  return [...vistas].sort((a, b) => b.length - a.length).slice(0, max);
}

export type ConsultaSugestao =
  | { tipo: "vazia" }
  | { tipo: "numero"; trecho: string }
  | { tipo: "texto"; palavras: string[] };

/** Decide o que o texto digitado é: parte de um número (2026/00, 136/, 62) ou palavras do objeto. */
export function classificarBusca(texto: string): ConsultaSugestao {
  const t = texto.trim().replace(/\s+/g, "");
  if (!t) return { tipo: "vazia" };
  if (/^[\d/]+$/.test(t)) return { tipo: "numero", trecho: t.slice(0, 12) };
  const palavras = texto.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((p) => p.length >= 2).slice(0, 5);
  return palavras.length ? { tipo: "texto", palavras } : { tipo: "vazia" };
}
