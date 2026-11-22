"use client";

import { COR_DINHEIRO } from "@/lib/emendas/cores-financeiras";

import { useCatalogo } from "@/components/emendas/catalogo-etapas";
import { type FiltroAtivo } from "@/components/emendas/filtros-ativos";
import { CINZA, PALETA } from "@/components/emendas/pizza";
import { CATEGORIAS, INFO_CATEGORIA } from "@/lib/emendas/categorias";
import {
  agruparLista,
  CLASSES_FINANCEIRAS,
  classeFinanceira,
  filtrarEmendasLista,
  type ChaveLista,
  type FiltrosLista,
  type GrupoLista,
} from "@/lib/emendas/painel-lista";
import { ASSUNTO_DA_REGRA } from "@/lib/emendas/pendencias";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { etapasEmOrdem, infoEtapa, numeroVereador } from "@/lib/emendas/regras";
import type { EmendaResumo } from "@/types/emendas";

export type Visao = "etapa" | "vereador" | "secretaria" | "financeiro" | "categoria" | "saude" | "pendencia" | "situacao" | "remanejada";
/** Toda dimensão de filtro da lista é uma aba: não há mais uma caixa de seletores repetindo o que o gráfico faz. */
export const VISOES: { chave: Visao; rotulo: string; param: ChaveLista }[] = [
  { chave: "etapa", rotulo: "Etapa", param: "etapa" },
  { chave: "vereador", rotulo: "Vereador", param: "v" },
  { chave: "secretaria", rotulo: "Secretaria", param: "s" },
  { chave: "financeiro", rotulo: "Situação financeira", param: "fin" },
  { chave: "categoria", rotulo: "Beneficiário", param: "cat" },
  { chave: "saude", rotulo: "Saúde", param: "sd" },
  { chave: "pendencia", rotulo: "Pendência", param: "pe" },
  { chave: "situacao", rotulo: "Situação", param: "situacao" },
  { chave: "remanejada", rotulo: "Remanejamento", param: "rem" },
];

// Paga = verde; empenhada paga em parte = âmbar (falta pagar); empenhada sem pagamento = azul; sem empenho = cinza-azulado.
export const COR_FINANCEIRA: Record<string, string> = { paga: COR_DINHEIRO.pago, paga_parcial: COR_DINHEIRO.aPagar, empenhada_sem_pagamento: COR_DINHEIRO.empenhado, sem_empenho: COR_DINHEIRO.semEmpenhar };
const ZERO = { n: 0, valor: 0, empenhado: 0, pago: 0, comPendencia: 0 };
const NOME_SITUACAO: Record<string, string> = { normal: "Normal", impedida: "Impedida", cancelada: "Cancelada" };
const COR_SITUACAO: Record<string, string> = { normal: "#5C7A1F", impedida: "#B45309", cancelada: "#94A3B8" };

export type Medida = "n" | "valor" | "pago";
export type Item = GrupoLista & { cor: string };

/** Chips dos filtros que estão valendo (o tipo de execução já aparece nas abas da tela; a busca, na própria barra). */
export function chipsDosFiltros(f: FiltrosLista, emendas: EmendaResumo[], catalogo: ReturnType<typeof useCatalogo>): FiltroAtivo[] {
  const nomeDe = (campo: "vereador_id" | "secretaria_id", nome: (e: EmendaResumo) => string, id: string) => {
    const e = emendas.find((x) => x[campo] === id);
    return e ? nome(e) : id;
  };
  const chips = [
    f.v && { chave: "v", rotulo: `Vereador: ${nomeDe("vereador_id", (e) => `${numeroVereador(e.vereador_numero)} · ${e.vereador_nome}`, f.v)}` },
    f.s && { chave: "s", rotulo: `Secretaria: ${nomeDe("secretaria_id", (e) => e.secretaria_nome, f.s)}` },
    f.etapa && { chave: "etapa", rotulo: `Etapa: ${infoEtapa(f.etapa, catalogo).nome}` },
    f.fin && { chave: "fin", rotulo: `Financeiro: ${CLASSES_FINANCEIRAS.find(([k]) => k === f.fin)?.[1] ?? "Paga, sem data de pagamento"}` },
    f.cat && { chave: "cat", rotulo: `Beneficiário: ${INFO_CATEGORIA[f.cat as keyof typeof INFO_CATEGORIA]?.nome ?? f.cat}` },
    f.sd && { chave: "sd", rotulo: f.sd === "1" ? "Só Saúde" : "Fora da Saúde" },
    f.pe && { chave: "pe", rotulo: `Pendência: ${ASSUNTO_DA_REGRA[f.pe]?.nome ?? f.pe}` },
    f.p && { chave: "p", rotulo: "Só com pendência" },
    f.situacao && { chave: "situacao", rotulo: `Situação: ${NOME_SITUACAO[f.situacao] ?? f.situacao}` },
    f.rem && { chave: "rem", rotulo: f.rem === "1" ? "Remanejadas" : "Não remanejadas" },
    f.numeros.length > 0 && { chave: "numeros", rotulo: `Só as emendas do alerta (${f.numeros.length})` },
  ].filter(Boolean) as FiltroAtivo[];
  return chips;
}

/** Grupos de uma dimensão (Etapa, Vereador…) já filtrados pelos OUTROS filtros, com a cor de cada um. Serve a todo gráfico de filtro. */
export function itensDaVisao(visao: Visao, medida: Medida, emendas: EmendaResumo[], resumos: Record<string, ResumoLinha>, f: FiltrosLista, catalogo: ReturnType<typeof useCatalogo>): Item[] {
  const def = VISOES.find((v) => v.chave === visao)!;
    const base = filtrarEmendasLista(emendas, resumos, f, [def.param]);
    const por = (chaves: (e: EmendaResumo) => { chave: string; rotulo: string }[]) => agruparLista(base, resumos, chaves);
    const achar = (gs: GrupoLista[], chave: string, rotulo: string): GrupoLista => gs.find((g) => g.chave === chave) ?? { ...ZERO, chave, rotulo };
    const ordenarPor = (gs: GrupoLista[]) => gs.sort((a, b) => b[medida] - a[medida] || a.rotulo.localeCompare(b.rotulo));
    const colorir = (gs: GrupoLista[]): Item[] => gs.map((g, i) => ({ ...g, cor: i < PALETA.length ? PALETA[i] : CINZA }));

    switch (visao) {
      case "etapa": {
        const gs = por((e) => [{ chave: e.etapa, rotulo: infoEtapa(e.etapa, catalogo).nome }]);
        const emOrdem = etapasEmOrdem(catalogo, new Set(emendas.map((e) => e.etapa)))
          .filter((et) => gs.some((g) => g.chave === et.chave))
          .map((et) => ({ ...achar(gs, et.chave, et.nome), cor: et.cor === "#CBD5E1" ? CINZA : et.cor }));
        // etapa que não está em nenhum fluxo do catálogo (dado antigo) entra no fim: a soma sempre fecha com a lista
        const fora = gs.filter((g) => !emOrdem.some((x) => x.chave === g.chave)).map((g) => ({ ...g, cor: CINZA }));
        return [...emOrdem, ...fora];
      }
      case "vereador":
        return colorir(ordenarPor(por((e) => [{ chave: e.vereador_id, rotulo: `${numeroVereador(e.vereador_numero)} · ${e.vereador_nome}` }])));
      case "secretaria":
        return colorir(ordenarPor(por((e) => [{ chave: e.secretaria_id, rotulo: e.secretaria_nome }])));
      case "financeiro": {
        const gs = por((e) => {
          const c = classeFinanceira(e);
          return [{ chave: c, rotulo: CLASSES_FINANCEIRAS.find(([k]) => k === c)![1] }];
        });
        return CLASSES_FINANCEIRAS.map(([k, nome]) => ({ ...achar(gs, k, nome), cor: COR_FINANCEIRA[k] }));
      }
      case "categoria": {
        const gs = por((e) => {
          const c = e.beneficiario_categoria;
          return [{ chave: c ?? "sem_categoria", rotulo: (c && INFO_CATEGORIA[c]?.nome) || "Sem categoria" }];
        });
        return CATEGORIAS.filter((c) => gs.some((g) => g.chave === c)).map((c) => ({ ...achar(gs, c, INFO_CATEGORIA[c].nome), cor: INFO_CATEGORIA[c].cor }));
      }
      case "saude": {
        const gs = por((e) => [{ chave: e.saude ? "1" : "0", rotulo: e.saude ? "Saúde" : "Fora da Saúde" }]);
        return [
          { ...achar(gs, "1", "Saúde"), cor: "#0E7490" },
          { ...achar(gs, "0", "Fora da Saúde"), cor: CINZA },
        ];
      }
      case "pendencia":
        // uma emenda com duas pendências conta em cada assunto: a soma passa do número de emendas
        return colorir(ordenarPor(por((e) => (resumos[e.id]?.regras ?? []).map((r) => ({ chave: r, rotulo: ASSUNTO_DA_REGRA[r]?.nome ?? r })))));
      case "situacao": {
        const gs = por((e) => [{ chave: e.situacao, rotulo: NOME_SITUACAO[e.situacao] ?? e.situacao }]);
        return Object.keys(NOME_SITUACAO).map((k) => ({ ...achar(gs, k, NOME_SITUACAO[k]), cor: COR_SITUACAO[k] }));
      }
      case "remanejada": {
        const gs = por((e) => [{ chave: e.remanejada ? "1" : "0", rotulo: e.remanejada ? "Remanejadas" : "Não remanejadas" }]);
        return [
          { ...achar(gs, "1", "Remanejadas"), cor: "#6B4FBB" },
          { ...achar(gs, "0", "Não remanejadas"), cor: CINZA },
        ];
      }
    }
}
