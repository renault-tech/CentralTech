"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { TipoSelo } from "@/components/emendas/tipo-selo";
import { NOME_GRAVIDADE, type Gravidade } from "@/lib/emendas/pendencias";
import { MenuExportar } from "@/components/emendas/menu-exportar";
import { PainelPendencias } from "@/components/emendas/painel-pendencias";
import { filtrarPendencias, lerFiltros, type EmendaPainel, type LinhaDocFaltando, type LinhaPendencia } from "@/lib/emendas/painel-pendencias";
import { useFiltrosUrl } from "@/components/modulo/use-filtros-url";
import { brl, dataBr } from "@/lib/emendas/regras";

export type { LinhaPendencia };

const COR: Record<Gravidade, string> = { alta: "#B91C1C", media: "#B45309", baixa: "#64748B" };
const ESTILO_CAMPO =
  "h-11 min-w-0 max-w-full rounded-lg border border-slate-300 sm:h-10 bg-white px-2.5 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]";
const POR_PAGINA = 40;

export function ListaPendencias({ linhas, docs, emendas, secretarias, ano }: { linhas: LinhaPendencia[]; docs: LinhaDocFaltando[]; emendas: EmendaPainel[]; secretarias: { id: string; nome: string }[]; ano: number }) {
  const { params, definir: definirUrl } = useFiltrosUrl("emendas-pendencias", String(ano));
  const [limite, setLimite] = React.useState(POR_PAGINA);
  const busca = params.get("q") ?? "";
  const f = lerFiltros((k) => params.get(k));
  const definir = (m: Record<string, string>) => {
    setLimite(POR_PAGINA);
    definirUrl(m);
  };

  const totalJustificadas = linhas.filter((l) => l.justificativa).length;
  const filtradas = filtrarPendencias(linhas, { ...f, q: busca });
  const consultaExcel = (() => {
    const p = new URLSearchParams(params.toString());
    p.set("ano", String(ano));
    if (busca.trim()) p.set("q", busca.trim());
    return p.toString();
  })();

  function limparTudo() {
    definir({ t: "", g: "", s: "", r: "", a: "", m: "", j: "", q: "" });
  }

  // Tipo, gravidade, secretaria, assunto e motivo se filtram clicando no painel (abas, fatias e linhas): a barra só
  // tem o que o gráfico não faz. Tudo numa linha, sem botão sozinho em linha própria.
  const controles = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="relative min-w-[14rem] flex-1">
        <span className="sr-only">Buscar pendências</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
        <input
          type="search"
          value={busca}
          placeholder="Buscar nº, objeto ou secretaria"
          className={`${ESTILO_CAMPO} w-full pl-9`}
          onChange={(e) => {
            setLimite(POR_PAGINA);
            definirUrl({ q: e.target.value }, true);
          }}
        />
      </label>
      {totalJustificadas > 0 && (
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700 sm:min-h-10">
          <input type="checkbox" className="h-4 w-4 accent-[#6B4FBB]" checked={f.j === "1"} onChange={(e) => definir({ j: e.target.checked ? "1" : "" })} />
          Incluir justificadas ({totalJustificadas})
        </label>
      )}
      <MenuExportar
        opcoes={[
          { rotulo: "Excel (.xlsx)", detalhe: "Totais por corte e a lista, com os filtros atuais", href: `/emendas/pendencias/exportar?${consultaExcel}` },
          { rotulo: "PDF (imprimir)", detalhe: "Só o painel, com os filtros atuais", imprimir: true },
        ]}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <PainelPendencias
        linhas={linhas}
        docs={docs}
        emendas={emendas}
        secretarias={secretarias}
        filtros={{ ...f, q: busca }}
        definir={definir}
        ano={ano}
        controles={controles}
        aoLimparTudo={limparTudo}
      />

      <ul className="flex flex-col gap-2 print:hidden">
        {filtradas.slice(0, limite).map((l) => (
          <li key={`${l.emendaId}:${l.regra}`}>
            <Link
              href={`/emendas/${l.emendaId}?aba=pendencias`}
              className="block rounded-lg border border-slate-200 bg-white p-3.5 hover:bg-violet-50/40"
              style={{ borderLeft: `4px solid ${COR[l.gravidade]}` }}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <strong className="text-sm text-cataguases-marinho">{l.titulo}</strong>
                <span className="text-xs font-medium" style={{ color: COR[l.gravidade] }}>
                  {NOME_GRAVIDADE[l.gravidade]}
                </span>
                <span className="ml-auto text-xs tabular-nums text-slate-600">{brl(l.valor)}</span>
              </div>
              {!!l.motivos?.length && (
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {l.motivos.map((m) => (
                    <span key={m.chave} className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                      {m.rotulo}
                    </span>
                  ))}
                </p>
              )}
              <p className="mt-0.5 text-[0.8125rem] text-slate-700">{l.detalhe}</p>
              {l.justificativa && (
                <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  <strong>Justificada{l.justificadaEm ? ` em ${dataBr(l.justificadaEm.slice(0, 10))}` : ""}:</strong> {l.justificativa}
                </p>
              )}
              {l.base && <p className="text-xs text-slate-500">Base legal: {l.base}</p>}
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                <span className="font-mono">nº {l.numero}</span>
                <TipoSelo tipo={l.tipo} />
                <span>{l.secretaria}</span>
                <span className="truncate">{l.objeto}</span>
                <span className="ml-auto font-medium text-[#5B3FA8]">Abrir emenda {l.numero} →</span>
              </p>
            </Link>
          </li>
        ))}
        {filtradas.length === 0 && <li className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Nenhuma pendência com esses filtros.</li>}
      </ul>
      {filtradas.length > limite && (
        <button type="button" onClick={() => setLimite((x) => x + POR_PAGINA)} className="mx-auto h-11 rounded-lg print:hidden sm:h-9 border border-slate-300 bg-white px-4 text-sm text-cataguases-marinho hover:bg-slate-50">
          Mostrar mais {POR_PAGINA}
        </button>
      )}
    </div>
  );
}
