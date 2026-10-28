"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { TipoSelo } from "@/components/emendas/tipo-selo";
import { ORDEM_TIPOS, TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { NOME_GRAVIDADE, type Gravidade } from "@/lib/emendas/pendencias";
import { atualizarFiltrosNaUrl } from "@/lib/emendas/url-filtros";
import { brl, dataBr } from "@/lib/emendas/regras";
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
  base?: string;
  /** Pendência já justificada (fica fora da contagem, a menos que o filtro peça). */
  justificativa?: string;
  justificadaEm?: string;
};

const COR: Record<Gravidade, string> = { alta: "#B91C1C", media: "#B45309", baixa: "#64748B" };
const ESTILO_CAMPO =
  "h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]";
const POR_PAGINA = 40;

export function ListaPendencias({ linhas, secretarias }: { linhas: LinhaPendencia[]; secretarias: { id: string; nome: string }[] }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const [limite, setLimite] = React.useState(POR_PAGINA);
  const f = { t: params.get("t") ?? "", g: params.get("g") ?? "", s: params.get("s") ?? "", r: params.get("r") ?? "", j: params.get("j") ?? "" };
  const definir = (m: Record<string, string>) => {
    setLimite(POR_PAGINA);
    atualizarFiltrosNaUrl(params, m, pathname, () => {});
  };

  const regras = Array.from(new Map(linhas.map((l) => [l.regra.split(":")[0], l.titulo])).entries());
  const totalJustificadas = linhas.filter((l) => l.justificativa).length;
  const filtradas = linhas.filter(
    (l) => (f.j === "1" || !l.justificativa) && (!f.t || l.tipo === f.t) && (!f.g || l.gravidade === f.g) && (!f.s || l.secretariaId === f.s) && (!f.r || l.regra.split(":")[0] === f.r)
  );
  const porGravidade = (g: Gravidade) => filtradas.filter((l) => l.gravidade === g).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Tipo
          <select className={ESTILO_CAMPO} value={f.t} onChange={(e) => definir({ t: e.target.value })}>
            <option value="">Todos</option>
            {ORDEM_TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPOS_EXECUCAO[t].nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Gravidade
          <select className={ESTILO_CAMPO} value={f.g} onChange={(e) => definir({ g: e.target.value })}>
            <option value="">Todas</option>
            {(["alta", "media", "baixa"] as const).map((g) => (
              <option key={g} value={g}>
                {NOME_GRAVIDADE[g]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Secretaria
          <select className={ESTILO_CAMPO} value={f.s} onChange={(e) => definir({ s: e.target.value })}>
            <option value="">Todas</option>
            {secretarias.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Assunto
          <select className={ESTILO_CAMPO} value={f.r} onChange={(e) => definir({ r: e.target.value })}>
            <option value="">Todos</option>
            {regras.map(([r, titulo]) => (
              <option key={r} value={r}>
                {titulo}
              </option>
            ))}
          </select>
        </label>
        {totalJustificadas > 0 && (
          <label className="flex h-[38px] items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-[#6B4FBB]" checked={f.j === "1"} onChange={(e) => definir({ j: e.target.checked ? "1" : "" })} />
            Mostrar justificadas ({totalJustificadas})
          </label>
        )}
        <p className="ml-auto text-sm text-slate-600">
          <strong className="tabular-nums text-cataguases-marinho">{filtradas.length}</strong> pendências ·{" "}
          <span style={{ color: COR.alta }}>{porGravidade("alta")} altas</span> · <span style={{ color: COR.media }}>{porGravidade("media")} médias</span> ·{" "}
          {porGravidade("baixa")} baixas
        </p>
      </div>

      <ul className="flex flex-col gap-2">
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
        <button type="button" onClick={() => setLimite((x) => x + POR_PAGINA)} className="mx-auto h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm text-cataguases-marinho hover:bg-slate-50">
          Mostrar mais {POR_PAGINA}
        </button>
      )}
    </div>
  );
}
