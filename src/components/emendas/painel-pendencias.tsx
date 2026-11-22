"use client";

import * as React from "react";

import { type FiltroAtivo } from "@/components/emendas/filtros-ativos";
import { FaixaPendencias, GraficoPendencias } from "@/components/emendas/grafico-pendencias";
import { TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { NOME_GRAVIDADE, type Gravidade } from "@/lib/emendas/pendencias";
import { descreverFiltros, nomeDaRegra, type EmendaPainel, type FiltrosPainel, type LinhaDocFaltando, type LinhaPendencia } from "@/lib/emendas/painel-pendencias";

/** Filtros que estão valendo, como chips (a lista os mostra; o painel só responde a eles). */
export function chipsDePendencias(f: FiltrosPainel, linhas: LinhaPendencia[], secretarias: { id: string; nome: string }[]): FiltroAtivo[] {
  return [
    f.t && { chave: "t", rotulo: `Tipo: ${TIPOS_EXECUCAO[f.t as keyof typeof TIPOS_EXECUCAO]?.nome ?? f.t}` },
    f.g && { chave: "g", rotulo: `Gravidade: ${NOME_GRAVIDADE[f.g as Gravidade] ?? f.g}` },
    f.s && { chave: "s", rotulo: `Secretaria: ${secretarias.find((x) => x.id === f.s)?.nome ?? f.s}` },
    f.a && { chave: "a", rotulo: `Área: ${f.a}` },
    f.r && { chave: "r", rotulo: `Assunto: ${nomeDaRegra(linhas.find((l) => l.regra.split(":")[0] === f.r) ?? { regra: f.r, titulo: f.r })}` },
    f.m && { chave: "m", rotulo: `Motivo: ${linhas.flatMap((l) => l.motivos ?? []).find((m) => m.chave === f.m)?.rotulo ?? f.m}` },
    f.j === "1" && { chave: "j", rotulo: "Com justificadas" },
  ].filter(Boolean) as FiltroAtivo[];
}

/** Remove um filtro; trocar a área ou o assunto zera o que estava abaixo dele. */
export function removerFiltroPendencia(chave: string): Record<string, string> {
  return { [chave]: "", ...(chave === "a" ? { r: "", m: "" } : chave === "r" ? { m: "" } : {}) };
}

/**
 * Painel esquerdo de Pendências, igual ao da lista de Emendas: uma faixa de indicadores e DOIS gráficos de filtro, cada um com a
 * sua dimensão (área, gravidade, assunto, motivo, secretaria, tipo ou documentos faltando). Clicar numa fatia ou linha filtra a
 * lista; cada gráfico ignora o próprio filtro e respeita o do outro, então os dois se combinam.
 */
export function PainelPendencias({
  linhas,
  docs,
  emendas,
  secretarias,
  filtros,
  definir,
  ano,
}: {
  linhas: LinhaPendencia[];
  docs: LinhaDocFaltando[];
  emendas: EmendaPainel[];
  secretarias: { id: string; nome: string }[];
  filtros: FiltrosPainel;
  definir: (m: Record<string, string>) => void;
  ano: number;
}) {
  const descricao = descreverFiltros(filtros, {
    tipo: filtros.t ? TIPOS_EXECUCAO[filtros.t as keyof typeof TIPOS_EXECUCAO]?.nome : undefined,
    gravidade: filtros.g ? NOME_GRAVIDADE[filtros.g as Gravidade] : undefined,
    secretaria: secretarias.find((s) => s.id === filtros.s)?.nome,
    assunto: filtros.r ? nomeDaRegra(linhas.find((l) => l.regra.split(":")[0] === filtros.r) ?? { regra: filtros.r, titulo: filtros.r }) : undefined,
    motivo: filtros.m ? linhas.flatMap((l) => l.motivos ?? []).find((m) => m.chave === filtros.m)?.rotulo : undefined,
  });
  return (
    <section aria-label="Visão geral das pendências" className="flex h-full min-h-0 flex-col">
      <FaixaPendencias linhas={linhas} docs={docs} emendas={emendas} filtros={filtros} />
      <p className="hidden border-b border-slate-200 px-4 py-2 text-xs text-slate-600 print:block">
        Exercício {ano} · Filtros: {descricao} · Gerado em {new Date().toLocaleDateString("pt-BR")}
      </p>
      <GraficoPendencias linhas={linhas} docs={docs} filtros={filtros} definir={definir} visaoInicial="area" className="border-b border-slate-200" />
      <GraficoPendencias linhas={linhas} docs={docs} filtros={filtros} definir={definir} visaoInicial="assunto" />
    </section>
  );
}
