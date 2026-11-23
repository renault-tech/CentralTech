/**
 * Cálculos do dashboard de Pendências (puro, testado em `painel-pendencias.test.ts`). A tela, a impressão e o
 * Excel usam estas mesmas funções, então os números nunca divergem entre si.
 */

import { ASSUNTO_DA_REGRA, AREAS_PENDENCIA, type Gravidade, type Motivo } from "@/lib/emendas/pendencias";
import type { TipoExecucao } from "@/types/emendas";

export type LinhaPendencia = {
  emendaId: string;
  numero: number;
  objeto: string;
  valor: number;
  tipo: TipoExecucao;
  secretariaId: string;
  secretaria: string;
  regra: string;
  gravidade: Gravidade;
  titulo: string;
  detalhe: string;
  /** Causas específicas dentro do assunto (ver `Pendencia.motivos`). */
  motivos?: Motivo[];
  base?: string;
  /** Pendência já justificada (fica fora da contagem, a menos que o filtro peça). */
  justificativa?: string;
  justificadaEm?: string;
};

/** Documento exigido por lei que ainda não foi ligado no Drive (um por emenda e documento). */
export type LinhaDocFaltando = {
  emendaId: string;
  numero: number;
  objeto: string;
  valor: number;
  tipo: TipoExecucao;
  secretariaId: string;
  secretaria: string;
  /** Tipo do documento (`termo`, `plano_trabalho`, `extrato`, `anuencia_sus`). */
  doc: string;
  rotulo: string;
};

/** Emenda do exercício (só o que o painel precisa), para dizer "X de Y emendas". */
export type EmendaPainel = { id: string; numero: number; objeto: string; valor: number; tipo: TipoExecucao; secretariaId: string; secretaria: string };

export type FiltrosPainel = { t: string; g: string; s: string; r: string; a: string; m: string; j: string; q: string };
export type ChaveFiltro = keyof Pick<FiltrosPainel, "t" | "g" | "s" | "r" | "a" | "m">;

export const chaveRegra = (l: { regra: string }) => l.regra.split(":")[0];
export const areaDaLinha = (l: { regra: string }) => ASSUNTO_DA_REGRA[chaveRegra(l)]?.area ?? "Cadastro";
export const nomeDaRegra = (l: { regra: string; titulo: string }) => ASSUNTO_DA_REGRA[chaveRegra(l)]?.nome ?? l.titulo;

const texto = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();

type Base = { numero: number; objeto: string; secretaria: string; secretariaId: string; tipo: TipoExecucao; /** Outro texto da linha em que a busca por palavra também procura. */ textoBusca?: string };

/** Filtros que valem para qualquer coisa ligada a uma emenda (tipo, secretaria, busca). */
export function combinaEmenda(e: Base, f: FiltrosPainel, ignorar?: ChaveFiltro[]): boolean {
  const q = texto(f.q);
  return (
    (ignorar?.includes("t") || !f.t || e.tipo === f.t) &&
    (ignorar?.includes("s") || !f.s || e.secretariaId === f.s) &&
    (!q || q.split(/\s+/).every((parte) => texto(`${e.numero} ${e.objeto} ${e.secretaria} ${e.textoBusca ?? ""}`).includes(parte)))
  );
}

/** Tudo o que a linha mostra: título, explicação, causas e o assunto. É onde a busca por palavra procura. */
export const textoDaLinha = (l: LinhaPendencia) => [l.titulo, l.detalhe, nomeDaRegra(l), ...(l.motivos ?? []).map((m) => m.rotulo)].join(" ");

/** Pendências que passam nos filtros. `ignorar` tira o próprio filtro de um gráfico, para ele mostrar todas as opções. */
export function filtrarPendencias(linhas: LinhaPendencia[], f: FiltrosPainel, ignorar?: ChaveFiltro[]): LinhaPendencia[] {
  return linhas.filter(
    (l) =>
      (f.j === "1" || !l.justificativa) &&
      combinaEmenda({ ...l, textoBusca: textoDaLinha(l) }, f, ignorar) &&
      (ignorar?.includes("g") || !f.g || l.gravidade === f.g) &&
      (ignorar?.includes("a") || !f.a || areaDaLinha(l) === f.a) &&
      (ignorar?.includes("r") || !f.r || chaveRegra(l) === f.r) &&
      (ignorar?.includes("m") || !f.m || (l.motivos ?? []).some((m) => m.chave === f.m))
  );
}

export type Grupo = {
  chave: string;
  rotulo: string;
  alta: number;
  media: number;
  baixa: number;
  total: number;
  /** Emendas diferentes com ao menos uma pendência no grupo. */
  emendas: number;
  /** Soma do valor dessas emendas (cada emenda conta uma vez). */
  valor: number;
};

/** Agrupa pendências por uma chave; cada grupo conta as emendas afetadas uma vez só. */
export function agruparPendencias(linhas: LinhaPendencia[], chave: (l: LinhaPendencia) => { chave: string; rotulo: string }): Grupo[] {
  const m = new Map<string, Grupo & { ids: Set<string> }>();
  for (const l of linhas) {
    const k = chave(l);
    let g = m.get(k.chave);
    if (!g) {
      g = { chave: k.chave, rotulo: k.rotulo, alta: 0, media: 0, baixa: 0, total: 0, emendas: 0, valor: 0, ids: new Set() };
      m.set(k.chave, g);
    }
    g[l.gravidade] += 1;
    g.total += 1;
    if (!g.ids.has(l.emendaId)) {
      g.ids.add(l.emendaId);
      g.emendas += 1;
      g.valor += l.valor;
    }
  }
  return Array.from(m.values())
    .map((g) => ({ chave: g.chave, rotulo: g.rotulo, alta: g.alta, media: g.media, baixa: g.baixa, total: g.total, emendas: g.emendas, valor: g.valor }))
    .sort((x, y) => y.total - x.total || x.rotulo.localeCompare(y.rotulo));
}

/** Áreas na ordem fixa do sistema, incluindo as sem nenhuma pendência (zero também informa). */
export function porArea(linhas: LinhaPendencia[]): Grupo[] {
  const m = new Map(agruparPendencias(linhas, (l) => ({ chave: areaDaLinha(l), rotulo: areaDaLinha(l) })).map((g) => [g.chave, g]));
  return AREAS_PENDENCIA.map((a) => m.get(a) ?? { chave: a, rotulo: a, alta: 0, media: 0, baixa: 0, total: 0, emendas: 0, valor: 0 });
}

export const porAssunto = (linhas: LinhaPendencia[]) => agruparPendencias(linhas, (l) => ({ chave: chaveRegra(l), rotulo: nomeDaRegra(l) }));
export const porSecretaria = (linhas: LinhaPendencia[]) => agruparPendencias(linhas, (l) => ({ chave: l.secretariaId, rotulo: l.secretaria }));
export const porTipo = (linhas: LinhaPendencia[]) => agruparPendencias(linhas, (l) => ({ chave: l.tipo, rotulo: l.tipo }));

/**
 * Pendências por motivo. Uma pendência pode ter mais de um motivo (publicidade: vários itens faltando) e então conta
 * uma vez em cada; por isso a soma pode passar do total de pendências. Assuntos sem motivo específico ficam de fora.
 * `comAssunto` prefixa o nome do assunto ("Datas fora de ordem · Pagamento antes do extrato"), útil quando vários
 * assuntos aparecem juntos.
 */
export function porMotivo(linhas: LinhaPendencia[], comAssunto = false): Grupo[] {
  const pares = linhas.flatMap((l) => (l.motivos ?? []).map((m) => ({ ...l, motivoDaLinha: m })));
  const motivoDe = (l: LinhaPendencia) => (l as LinhaPendencia & { motivoDaLinha: Motivo }).motivoDaLinha;
  return agruparPendencias(pares, (l) => {
    const m = motivoDe(l);
    const assunto = nomeDaRegra(l);
    // "Vigência encerrada" já diz o assunto: não repete "Vigência (…) · Vigência encerrada"
    const repete = m.rotulo.toLowerCase().startsWith(assunto.split(/[\s(]/)[0].toLowerCase());
    return { chave: m.chave, rotulo: comAssunto && !repete ? `${assunto} · ${m.rotulo}` : m.rotulo };
  });
}

export type Indicadores = {
  pendencias: number;
  altas: number;
  emendasAfetadas: number;
  emendasNoRecorte: number;
  valorAfetado: number;
  valorNoRecorte: number;
  justificadas: number;
};

/** Números do topo: quantas pendências, quantas emendas e quanto dinheiro elas envolvem. */
export function indicadores(linhas: LinhaPendencia[], todas: LinhaPendencia[], emendas: EmendaPainel[], f: FiltrosPainel): Indicadores {
  const noRecorte = emendas.filter((e) => combinaEmenda(e, f));
  const afetadas = new Map<string, number>();
  for (const l of linhas) afetadas.set(l.emendaId, l.valor);
  return {
    pendencias: linhas.length,
    altas: linhas.filter((l) => l.gravidade === "alta").length,
    emendasAfetadas: afetadas.size,
    emendasNoRecorte: noRecorte.length,
    valorAfetado: Array.from(afetadas.values()).reduce((s, v) => s + v, 0),
    valorNoRecorte: noRecorte.reduce((s, e) => s + e.valor, 0),
    justificadas: todas.filter((l) => l.justificativa && combinaEmenda({ ...l, textoBusca: textoDaLinha(l) }, f)).length,
  };
}

export type GrupoDoc = { doc: string; rotulo: string; emendas: { emendaId: string; numero: number; secretaria: string }[]; valor: number };

/** Documentos faltando por tipo de documento (só filtros de tipo de execução, secretaria e busca se aplicam). */
export function documentosFaltando(docs: LinhaDocFaltando[], f: FiltrosPainel): GrupoDoc[] {
  const m = new Map<string, GrupoDoc>();
  for (const d of docs.filter((x) => combinaEmenda({ ...x, textoBusca: x.rotulo }, f))) {
    let g = m.get(d.doc);
    if (!g) {
      g = { doc: d.doc, rotulo: d.rotulo, emendas: [], valor: 0 };
      m.set(d.doc, g);
    }
    g.emendas.push({ emendaId: d.emendaId, numero: d.numero, secretaria: d.secretaria });
    g.valor += d.valor;
  }
  for (const g of m.values()) g.emendas.sort((a, b) => a.numero - b.numero);
  return Array.from(m.values()).sort((a, b) => b.emendas.length - a.emendas.length);
}

/** Texto curto dos filtros aplicados, para o cabeçalho da impressão e do Excel. */
export function descreverFiltros(f: FiltrosPainel, nomes: { tipo?: string; secretaria?: string; gravidade?: string; assunto?: string; motivo?: string }): string {
  const partes = [
    f.t && `tipo: ${nomes.tipo ?? f.t}`,
    f.g && `gravidade: ${nomes.gravidade ?? f.g}`,
    f.s && `secretaria: ${nomes.secretaria ?? f.s}`,
    f.a && `área: ${f.a}`,
    f.r && `assunto: ${nomes.assunto ?? f.r}`,
    f.m && `motivo: ${nomes.motivo ?? f.m}`,
    f.q && `busca: ${f.q}`,
    f.j === "1" && "com justificadas",
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "sem filtros";
}

export function lerFiltros(get: (k: string) => string | null | undefined): FiltrosPainel {
  const v = (k: string) => get(k) ?? "";
  return { t: v("t"), g: v("g"), s: v("s"), r: v("r"), a: v("a"), m: v("m"), j: v("j"), q: v("q") };
}
