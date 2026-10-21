"use client";

import * as React from "react";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";

import { confirmarImportacao, previaImportacao, type PreviaImportacao } from "@/lib/emendas/actions-config";
import { brl, dataBr } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";

/**
 * Importação em três passos (prévia → revisão → confirmação). A prévia não
 * grava nada; a confirmação relê o arquivo no servidor e grava tudo numa
 * transação só — se algo falhar (ex.: cota estourada), nada entra.
 */
export function Importador({ anos }: { anos: number[] }) {
  const [arquivo, setArquivo] = React.useState<File | null>(null);
  const [ano, setAno] = React.useState(String(anos[0] ?? new Date().getFullYear()));
  const [previa, setPrevia] = React.useState<Extract<PreviaImportacao, { sucesso: true }> | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [processando, setProcessando] = React.useState<"previa" | "gravando" | null>(null);
  const [resultado, setResultado] = React.useState<{ criadas: number; ignoradas: number; remanejamentos: number; movimentos: number } | null>(null);
  const [verTodas, setVerTodas] = React.useState(false);

  function dados() {
    const fd = new FormData();
    if (arquivo) fd.set("arquivo", arquivo);
    fd.set("ano", ano);
    return fd;
  }

  async function gerarPrevia() {
    setErro(null);
    setPrevia(null);
    setResultado(null);
    setProcessando("previa");
    const r = await previaImportacao(dados());
    setProcessando(null);
    if (!r.sucesso) return setErro(r.erro);
    setPrevia(r);
  }

  async function gravar() {
    setErro(null);
    setProcessando("gravando");
    const r = await confirmarImportacao(dados());
    setProcessando(null);
    if (!r.sucesso) return setErro(r.erro);
    setResultado(r);
    setPrevia(null);
  }

  const pendentes = previa?.linhas.filter((l) => l.pendencias.length) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-[15px] font-semibold text-cataguases-marinho">Importar planilha de acompanhamento</h2>
        <p className="mt-1 max-w-3xl text-[13px] text-slate-600">
          Mesmo formato da planilha usada até aqui (colunas Emenda, ID, Vereador, Descrição, Valor, Destinação, Dotação, Nova dotação, Secretaria,
          Saúde e STATUS). Se ela tiver duas abas — a original e a de depois dos remanejamentos —, a mais recente vira a situação atual e a
          diferença entra no histórico de cada emenda. “EXECUTADA - EMP: nº - DP: data” vira empenho e pagamento.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Exercício
            <select className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm" value={ano} onChange={(e) => setAno(e.target.value)}>
              {anos.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <input
            id="planilha"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              setArquivo(e.target.files?.[0] ?? null);
              setPrevia(null);
              setResultado(null);
            }}
          />
          <label htmlFor="planilha" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm text-cataguases-marinho hover:bg-slate-50">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            {arquivo ? arquivo.name : "Escolher planilha (.xlsx)"}
          </label>
          <button
            type="button"
            disabled={!arquivo || processando !== null}
            onClick={gerarPrevia}
            className="h-10 rounded-lg bg-[#6B4FBB] px-4 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50"
          >
            {processando === "previa" ? "Lendo…" : "1. Gerar prévia"}
          </button>
        </div>
        {erro && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {erro}
          </p>
        )}
      </section>

      {resultado && (
        <section className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-900" role="status">
          <strong>Importação concluída.</strong> {resultado.criadas} emendas criadas, {resultado.ignoradas} já existiam (ignoradas),{" "}
          {resultado.remanejamentos} remanejamentos e {resultado.movimentos} movimentos financeiros registrados.{" "}
          <Link href={`/emendas?ano=${ano}`} className="font-medium underline">
            Abrir o painel
          </Link>
        </section>
      )}

      {previa && (
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-[15px] font-semibold text-cataguases-marinho">2. Revise antes de gravar</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 text-sm">
            {[
              ["Emendas", String(previa.linhas.length)],
              ["Valor total", brl(previa.totais.valor)],
              ["Na Saúde", `${brl(previa.totais.saude)} (${((previa.totais.saude / (previa.totais.valor || 1)) * 100).toFixed(1).replace(".", ",")}%)`],
              ["Pagas / em execução", `${previa.totais.pagas} / ${previa.totais.empenhadas}`],
              ["Remanejadas", String(previa.totais.remanejadas)],
              ["Para conferir", String(previa.totais.comPendencia)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-slate-200 p-3">
                <span className="text-xs text-slate-600">{k}</span>
                <div className="mt-0.5 font-semibold tabular-nums text-cataguases-marinho">{v}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600">Abas lidas: {previa.abas.join(" · ")}</p>

          {previa.erros.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <strong>Corrija antes de importar:</strong>
              <ul className="mt-1 list-disc pl-5">
                {previa.erros.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {previa.avisos.map((a) => (
            <p key={a} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {a}
            </p>
          ))}

          {pendentes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-cataguases-marinho">Situações que precisam de conferência ({pendentes.length})</h3>
              <p className="text-xs text-slate-600">Entram assim mesmo; depois dá para completar nº de empenho/data no detalhe de cada emenda (aparecem nos alertas do painel).</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
                {pendentes.map((l) => (
                  <li key={l.numero} className="flex flex-wrap gap-2">
                    <span className="font-mono text-slate-500">nº {l.numero}</span>
                    <span className="text-slate-700">“{l.status_original}”</span>
                    <span className="text-amber-800">→ {l.pendencias.join("; ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2 font-medium">Nº</th>
                  <th className="px-3 py-2 font-medium">Vereador</th>
                  <th className="px-3 py-2 font-medium">Objeto</th>
                  <th className="px-3 py-2 font-medium">Unidade</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Situação lida</th>
                </tr>
              </thead>
              <tbody>
                {(verTodas ? previa.linhas : previa.linhas.slice(0, 20)).map((l) => (
                  <tr key={l.numero} className={cn("border-t border-slate-100", previa.jaCadastradas.includes(l.numero) && "opacity-50")}>
                    <td className="px-3 py-2 font-mono">{l.numero}</td>
                    <td className="px-3 py-2">{String(l.vereador_numero).padStart(2, "0")} · {l.vereador_nome}</td>
                    <td className="max-w-[320px] truncate px-3 py-2" title={l.objeto}>
                      {l.objeto}
                      {l.remanejamento && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[11px] text-amber-900">remanejada</span>}
                    </td>
                    <td className="px-3 py-2">{l.unidade_codigo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(l.valor)}</td>
                    <td className="px-3 py-2">
                      {l.etapa === "paga"
                        ? `Paga${l.empenho ? ` · EMP ${l.empenho}` : ""}${l.data_pagamento ? ` · ${dataBr(l.data_pagamento)}` : ""}`
                        : l.etapa === "empenhada"
                          ? `Empenhada${l.empenho ? ` · EMP ${l.empenho}` : ""}`
                          : "Indicada"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!verTodas && previa.linhas.length > 20 && (
            <button type="button" onClick={() => setVerTodas(true)} className="self-start text-sm text-cataguases-azul hover:underline">
              Ver as {previa.linhas.length} linhas
            </button>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-600">Grava tudo de uma vez: se qualquer linha falhar, nada entra.</span>
            <button
              type="button"
              disabled={previa.erros.length > 0 || processando !== null}
              onClick={gravar}
              className="h-10 rounded-lg bg-[#6B4FBB] px-5 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50"
            >
              {processando === "gravando" ? "Gravando…" : `3. Importar ${previa.linhas.length - previa.jaCadastradas.length} emendas`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
