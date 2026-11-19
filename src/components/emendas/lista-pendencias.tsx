"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { TipoSelo } from "@/components/emendas/tipo-selo";
import { ORDEM_TIPOS, TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { NOME_GRAVIDADE, type Gravidade } from "@/lib/emendas/pendencias";
import { MenuExportar } from "@/components/emendas/menu-exportar";
import { PainelPendencias } from "@/components/emendas/painel-pendencias";
import { areaDaLinha, chaveRegra, filtrarPendencias, lerFiltros, nomeDaRegra, porMotivo, type EmendaPainel, type LinhaDocFaltando, type LinhaPendencia } from "@/lib/emendas/painel-pendencias";
import { atualizarFiltrosNaUrl } from "@/lib/filtros-url";
import { brl, dataBr } from "@/lib/emendas/regras";

export type { LinhaPendencia };

const COR: Record<Gravidade, string> = { alta: "#B91C1C", media: "#B45309", baixa: "#64748B" };
const ESTILO_CAMPO =
  "h-11 rounded-lg border border-slate-300 sm:h-9 bg-white px-2.5 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]";
const POR_PAGINA = 40;

export function ListaPendencias({ linhas, docs, emendas, secretarias, ano }: { linhas: LinhaPendencia[]; docs: LinhaDocFaltando[]; emendas: EmendaPainel[]; secretarias: { id: string; nome: string }[]; ano: number }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const [limite, setLimite] = React.useState(POR_PAGINA);
  const [busca, setBusca] = React.useState(params.get("q") ?? "");
  const pausaUrl = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const f = lerFiltros((k) => params.get(k));
  const definir = (m: Record<string, string>) => {
    setLimite(POR_PAGINA);
    atualizarFiltrosNaUrl(params, m, pathname, () => {});
  };

  const areaDe = areaDaLinha;
  const totalJustificadas = linhas.filter((l) => l.justificativa).length;
  // Tudo menos o próprio filtro de assunto/área: os números dos seletores respondem aos outros filtros.
  const base = filtrarPendencias(linhas, { ...f, q: busca }, ["a", "r"]);
  const contagem = (fn: (l: LinhaPendencia) => string) => {
    const m = new Map<string, number>();
    for (const l of base) m.set(fn(l), (m.get(fn(l)) ?? 0) + 1);
    return m;
  };
  const porRegra = contagem(chaveRegra);
  const nomeRegra = (r: string) => {
    const l = linhas.find((x) => chaveRegra(x) === r);
    return l ? nomeDaRegra(l) : r;
  };
  const regras = Array.from(new Set(linhas.map(chaveRegra)))
    .filter((r) => !f.a || areaDe(linhas.find((x) => chaveRegra(x) === r)!) === f.a)
    .sort((x, y) => nomeRegra(x).localeCompare(nomeRegra(y)));
  // Motivos disponíveis: respondem a todos os filtros, menos ao próprio motivo.
  const motivos = porMotivo(filtrarPendencias(linhas, { ...f, q: busca }, ["m"]), !f.r);
  const filtradas = filtrarPendencias(linhas, { ...f, q: busca });
  const consultaExcel = (() => {
    const p = new URLSearchParams(params.toString());
    p.set("ano", String(ano));
    if (busca.trim()) p.set("q", busca.trim());
    return p.toString();
  })();

  const temFiltro = !!(f.t || f.g || f.s || f.r || f.a || f.m || f.j || busca.trim());
  const campo = `${ESTILO_CAMPO} min-w-0 max-w-full`;

  const controles = (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Tipo de execução" className={`${campo} max-sm:w-[calc(50%-0.25rem)] sm:w-[150px]`} value={f.t} onChange={(e) => definir({ t: e.target.value })}>
        <option value="">Todos os tipos</option>
        {ORDEM_TIPOS.map((t) => (
          <option key={t} value={t}>
            {TIPOS_EXECUCAO[t].nome}
          </option>
        ))}
      </select>
      <select aria-label="Gravidade" className={`${campo} max-sm:w-[calc(50%-0.25rem)] sm:w-[170px]`} value={f.g} onChange={(e) => definir({ g: e.target.value })}>
        <option value="">Todas as gravidades</option>
        {(["alta", "media", "baixa"] as const).map((g) => (
          <option key={g} value={g}>
            {NOME_GRAVIDADE[g]}
          </option>
        ))}
      </select>
      <select aria-label="Secretaria" className={`${campo} max-sm:w-[calc(50%-0.25rem)] sm:w-[180px]`} value={f.s} onChange={(e) => definir({ s: e.target.value })}>
        <option value="">Todas as secretarias</option>
        {secretarias.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
      <select aria-label="Assunto" className={`${campo} max-sm:w-[calc(50%-0.25rem)] sm:w-[200px]`} value={f.r} onChange={(e) => definir({ r: e.target.value, m: "" })}>
        <option value="">Todos os assuntos</option>
        {regras.map((r) => (
          <option key={r} value={r}>
            {nomeRegra(r)} ({porRegra.get(r) ?? 0})
          </option>
        ))}
      </select>
      {(motivos.length > 0 || f.m) && (
        <select aria-label="Motivo" className={`${campo} max-sm:w-[calc(50%-0.25rem)] sm:w-[230px]`} value={f.m} onChange={(e) => definir({ m: e.target.value })}>
          <option value="">Todos os motivos</option>
          {f.m && !motivos.some((m) => m.chave === f.m) && <option value={f.m}>{f.m}</option>}
          {motivos.map((m) => (
            <option key={m.chave} value={m.chave}>
              {m.rotulo} ({m.total})
            </option>
          ))}
        </select>
      )}
      <input
        type="search"
        aria-label="Buscar"
        value={busca}
        placeholder="Buscar nº, objeto…"
        className={`${campo} max-sm:min-w-0 max-sm:flex-1 sm:w-40`}
        onChange={(e) => {
          setBusca(e.target.value);
          setLimite(POR_PAGINA);
          // o filtro local é imediato; só a gravação na URL espera uma pausa na digitação
          const texto = e.target.value.trim();
          if (pausaUrl.current) clearTimeout(pausaUrl.current);
          pausaUrl.current = setTimeout(() => atualizarFiltrosNaUrl(new URLSearchParams(window.location.search), { q: texto }, pathname, () => {}), 250);
        }}
      />
      {totalJustificadas > 0 && (
        <label className="flex h-11 items-center gap-1.5 text-[13px] text-slate-700 sm:h-9">
          <input type="checkbox" className="h-4 w-4 accent-[#6B4FBB]" checked={f.j === "1"} onChange={(e) => definir({ j: e.target.checked ? "1" : "" })} />
          Justificadas ({totalJustificadas})
        </label>
      )}
      {temFiltro && (
        <button
          type="button"
          onClick={() => {
            setBusca("");
            definir({ t: "", g: "", s: "", r: "", a: "", m: "", j: "", q: "" });
          }}
          className="h-11 rounded-lg px-2.5 text-[13px] font-medium text-[#5B3FA8] hover:bg-violet-50 sm:h-9"
        >
          Limpar
        </button>
      )}
      <div className="ml-auto">
        <MenuExportar
          opcoes={[
            { rotulo: "Excel (.xlsx)", detalhe: "Totais por corte e a lista, com os filtros atuais", href: `/emendas/pendencias/exportar?${consultaExcel}` },
            { rotulo: "PDF (imprimir)", detalhe: "Só o painel, com os filtros atuais", imprimir: true },
          ]}
        />
      </div>
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
              <p className="mt-0.5 text-[13px] text-slate-700">{l.detalhe}</p>
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
