"use client";

import * as React from "react";
import Link from "next/link";

import { decidirPropostas } from "@/lib/emendas/actions-propostas";
import type { PropostaListada } from "@/lib/emendas/dados";
import { dataBr } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";

const BOTAO_PRIMARIO = "inline-flex h-9 items-center rounded-lg bg-[#6B4FBB] px-3.5 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50";
const BOTAO_SECUNDARIO = "inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-cataguases-marinho hover:bg-slate-50 disabled:opacity-50";

const ROTULO_CAMPO: Record<string, string> = {
  numero_termo: "Termo de parceria",
  processo_licitatorio: "Processo licitatório",
  data_envio_pagamento: "Envio para pagamento",
  vigencia_inicio: "Início da vigência",
  vigencia_fim: "Fim da vigência",
  data_publicacao_extrato: "Publicação do extrato",
  conta_bancaria: "Conta bancária",
  gestor_osc: "Gestor na entidade",
  gestor_pmc: "Gestor na Prefeitura",
  observacao: "Observação",
  processo_id: "Processo do Compras (vínculo)",
  localidade: "Localidade beneficiada",
  inicio_previsto: "Início previsto",
  termino_previsto: "Término previsto",
  plano_metas: "Finalidade e metas do plano",
  plano_outras_fontes: "Outras fontes de recurso",
  anuencia_sus: "Anuência do SUS",
  anuencia_sus_data: "Data da anuência do SUS",
  identificador_contabil: "Identificador contábil",
  fonte_recurso: "Fonte de recurso",
};
const SITUACAO: Record<string, string> = { pendente: "Pendente", em_andamento: "Em andamento", concluida: "Concluída", nao_se_aplica: "Não se aplica" };
const ESTADO: Record<string, string> = { conferido: "Conferido", presumido: "Presumido", pendente: "Pendente", nao_se_aplica: "Não se aplica" };

function rotulo(p: PropostaListada): string {
  if (p.alvo === "execucao") return ROTULO_CAMPO[p.campo ?? ""] ?? p.campo ?? "Execução";
  if (p.alvo === "emenda_fases") return `Fase “${p.chave}”`;
  if (p.alvo === "emenda_checklist") return `Documento “${p.chave}”`;
  return p.alvo;
}

function mostrar(p: PropostaListada, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (p.campo === "processo_id" && v === p.valor_proposto && p.processo_proposto) return p.processo_proposto;
  if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}$/.test(v) ? dataBr(v) : v;
  const o = v as Record<string, string | null>;
  if (p.alvo === "emenda_fases")
    return [SITUACAO[o.situacao ?? ""] ?? o.situacao, o.data ? dataBr(o.data) : null, o.documento, o.observacao].filter(Boolean).join(" · ");
  if (p.alvo === "emenda_checklist") return ESTADO[o.estado ?? ""] ?? String(o.estado);
  return JSON.stringify(v);
}

export function ListaAprovacoes({ pendentes, decididas, gestor }: { pendentes: PropostaListada[]; decididas: PropostaListada[]; gestor: boolean }) {
  const [marcadas, setMarcadas] = React.useState<Set<string>>(new Set());
  const [pendente, iniciar] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const decidiveis = pendentes.filter((p) => p.status === "pendente");

  const porEmenda = new Map<string, PropostaListada[]>();
  for (const p of pendentes) (porEmenda.get(p.emenda_id) ?? porEmenda.set(p.emenda_id, []).get(p.emenda_id)!).push(p);

  function alternar(id: string) {
    setMarcadas((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function decidir(ids: string[], aprovar: boolean) {
    setMsg(null);
    iniciar(async () => {
      const r = await decidirPropostas({ ids, aprovar });
      if (!r.sucesso) return setMsg(r.erro);
      setMarcadas(new Set());
      setMsg(`${aprovar ? `${r.aprovadas ?? 0} aprovada(s)` : "Rejeitada(s)"}${r.conflitos ? ` · ${r.conflitos} em conflito (o dado mudou desde a proposta)` : ""}${r.falhas ? ` · ${r.falhas} com falha` : ""}.`);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {gestor && decidiveis.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setMarcadas(new Set(marcadas.size === decidiveis.length ? [] : decidiveis.map((p) => p.id)))}>
            {marcadas.size === decidiveis.length ? "Desmarcar todas" : `Marcar todas (${decidiveis.length})`}
          </button>
          <button type="button" className={BOTAO_PRIMARIO} disabled={pendente || marcadas.size === 0} onClick={() => decidir(Array.from(marcadas), true)}>
            Aprovar marcadas ({marcadas.size})
          </button>
          <button type="button" className={BOTAO_SECUNDARIO} disabled={pendente || marcadas.size === 0} onClick={() => decidir(Array.from(marcadas), false)}>
            Rejeitar marcadas
          </button>
        </div>
      )}
      {msg && <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" role="status">{msg}</p>}

      {porEmenda.size === 0 && <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Nenhuma proposta aguardando.</p>}
      {Array.from(porEmenda.entries()).map(([emendaId, ps]) => (
        <section key={emendaId} className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm">
            <Link href={`/emendas/${emendaId}`} className="font-semibold text-cataguases-marinho hover:underline">
              Emenda nº {ps[0].emenda_numero}
            </Link>
            <span className="ml-2 text-slate-600">{ps[0].emenda_objeto}</span>
          </h2>
          <ul className="divide-y divide-slate-100">
            {ps.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-4 py-3 text-[13px]">
                {gestor && p.status === "pendente" && (
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#6B4FBB]" checked={marcadas.has(p.id)} onChange={() => alternar(p.id)} aria-label={`Marcar ${rotulo(p)}`} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-cataguases-marinho">
                    {rotulo(p)}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {p.origem === "importacao" ? "importação" : `por ${p.autor_nome ?? "secretaria"}`} · {new Date(p.criado_em).toLocaleDateString("pt-BR")}
                    </span>
                    {p.status === "conflito" && <span className="ml-2 rounded bg-amber-100 px-1.5 py-px text-xs text-amber-900">conflito: o dado mudou</span>}
                  </p>
                  <p className="mt-0.5 grid gap-x-3 sm:grid-cols-2">
                    <span className="text-slate-600">Hoje: <span className="text-slate-800">{mostrar(p, p.valor_atual)}</span></span>
                    <span className="text-slate-600">Proposto: <strong className="text-cataguases-marinho">{mostrar(p, p.valor_proposto)}</strong></span>
                  </p>
                </div>
                {gestor && p.status === "pendente" && (
                  <div className="flex gap-1.5">
                    <button type="button" className={cn(BOTAO_PRIMARIO, "h-8 px-3")} disabled={pendente} onClick={() => decidir([p.id], true)}>Aprovar</button>
                    <button type="button" className={cn(BOTAO_SECUNDARIO, "h-8 px-3")} disabled={pendente} onClick={() => decidir([p.id], false)}>Rejeitar</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {decididas.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-cataguases-marinho">Decididas recentemente ({decididas.length})</summary>
          <ul className="divide-y divide-slate-100">
            {decididas.map((p) => (
              <li key={p.id} className="px-4 py-2.5 text-[13px] text-slate-700">
                <span className={p.status === "aprovada" ? "text-green-700" : "text-slate-500"}>{p.status === "aprovada" ? "Aprovada" : "Rejeitada"}</span> · nº {p.emenda_numero} · {rotulo(p)}: {mostrar(p, p.valor_proposto)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
