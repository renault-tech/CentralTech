import { normalizarTexto } from "@/lib/emendas/painel-lista";
import type { TipoExecucao } from "@/types/emendas";

export type ResumoItem = { codigo: string; nome: string; exigencia: string; aplicaveis: number; atendem: number };
export type LinhaConformidade = { id: string; numero: number; objeto: string; secretaria: string; tipo: TipoExecucao; executada: boolean; faltas: string[] };
export type FiltrosConformidade = { i: string; s: string; t: string; x: string; q: string };

export const rotuloCodigo = (c: string) => (c === "art5" ? "Art. 5º" : `Art. 7º, ${c}`);

/** Os filtros da tela de Conformidade (item, secretaria, tipo, execução e busca); `ignorar` deixa um deles de fora para o gráfico dele. */
export function filtrarConformidade(linhas: LinhaConformidade[], f: FiltrosConformidade, nomesItens: Map<string, string>, ignorar?: keyof FiltrosConformidade): LinhaConformidade[] {
  const q = normalizarTexto(f.q.trim());
  return linhas.filter(
    (l) =>
      l.faltas.length > 0 &&
      (ignorar === "i" || !f.i || l.faltas.includes(f.i)) &&
      (ignorar === "s" || !f.s || l.secretaria === f.s) &&
      (ignorar === "t" || !f.t || l.tipo === f.t) &&
      (ignorar === "x" || !f.x || (f.x === "1" ? l.executada : !l.executada)) &&
      (!q || q.split(/\s+/).every((parte) => normalizarTexto([l.numero, l.objeto, l.secretaria, ...l.faltas.map((c) => `${rotuloCodigo(c)} ${nomesItens.get(c) ?? ""}`)].join(" ")).includes(parte)))
  );
}

/** Frase com os filtros aplicados, para o cabeçalho de cada arquivo exportado. */
export function descreverFiltrosConformidade(f: FiltrosConformidade, nomesItens: Map<string, string>, nomeTipo: (t: string) => string): string {
  const partes = [
    f.i && `Item: ${rotuloCodigo(f.i)} · ${nomesItens.get(f.i) ?? ""}`,
    f.s && `Secretaria: ${f.s}`,
    f.t && `Tipo de execução: ${nomeTipo(f.t)}`,
    f.x && (f.x === "1" ? "Já empenhadas ou pagas" : "Ainda não executadas"),
    f.q.trim() && `Busca: "${f.q.trim()}"`,
  ].filter((x): x is string => !!x);
  return partes.length ? partes.join(" · ") : "Nenhum filtro";
}
