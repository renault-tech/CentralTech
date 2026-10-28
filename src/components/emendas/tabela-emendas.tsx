"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, X } from "lucide-react";

import { Chip, SeloEtapa } from "@/components/emendas/ui";
import { SeloPendencias, TipoSelo } from "@/components/emendas/tipo-selo";
import { atualizarFiltrosNaUrl } from "@/lib/emendas/url-filtros";
import { useCatalogo } from "@/components/emendas/catalogo-etapas";
import { ORDEM_TIPOS, TIPOS_EXECUCAO, tipoDaEmenda } from "@/lib/emendas/fases";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { brl, dataBr, etapasEmOrdem, infoEtapa, numeroVereador } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import type { EmendaResumo, Secretaria, Vereador } from "@/types/emendas";

const ESTILO_CAMPO =
  "h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]";

const POR_PAGINA = 25;

/** Progresso das fases do tipo: barra na cor do tipo + fase atual. */
function RegraFases({ resumo, cor }: { resumo?: ResumoLinha; cor: string }) {
  if (!resumo || resumo.total === 0) return <span className="text-xs text-slate-400">—</span>;
  const pct = Math.round((resumo.concluidas / resumo.total) * 100);
  return (
    <div title={resumo.faseAtual ? `Próxima fase: ${resumo.faseAtual}` : "Todas as fases concluídas"}>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${resumo.concluidas} de ${resumo.total} fases`}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
      </div>
      <div className="mt-1 truncate text-xs text-slate-600">
        <span className="font-medium tabular-nums">{resumo.concluidas}/{resumo.total}</span> · {resumo.faseAtual ?? "Concluída"}
      </div>
    </div>
  );
}

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Lista de emendas: busca, filtros (na URL), ordenação, barra de andamento
 * por linha. A planilha antiga, só que viva. */
export function TabelaEmendas({
  emendas,
  vereadores,
  secretarias,
  resumos,
  ano,
  anos,
}: {
  emendas: EmendaResumo[];
  resumos: Record<string, ResumoLinha>;
  vereadores: Vereador[];
  secretarias: Secretaria[];
  ano: number;
  anos: number[];
}) {
  const catalogo = useCatalogo();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [busca, setBusca] = React.useState(params.get("q") ?? "");
  const [limite, setLimite] = React.useState(POR_PAGINA);

  const f = {
    v: params.get("v") ?? "",
    s: params.get("s") ?? "",
    etapa: params.get("etapa") ?? "",
    t: params.get("t") ?? "",
    p: params.get("p") ?? "",
    situacao: params.get("situacao") ?? "",
    ordem: params.get("ordem") ?? "numero",
    numeros: (params.get("numeros") ?? "").split(",").filter(Boolean).map(Number),
  };

  function definir(m: Record<string, string>) {
    setLimite(POR_PAGINA);
    atualizarFiltrosNaUrl(params, m, pathname, (url) => router.replace(url, { scroll: false }));
  }

  const q = normalizar(busca.trim());
  const semTipo = emendas.filter(
    (r) =>
      (!f.p || (resumos[r.id]?.abertas ?? 0) > 0) &&
      (!f.v || r.vereador_id === f.v) &&
      (!f.s || r.secretaria_id === f.s) &&
      (!f.situacao || r.situacao === f.situacao) &&
      (f.numeros.length === 0 || f.numeros.includes(r.numero)) &&
      (!q ||
        q.split(/\s+/).every((parte) =>
          normalizar(
            [r.numero, r.objeto, r.beneficiario_nome ?? "", r.vereador_nome, r.secretaria_nome, r.unidade_codigo, r.ficha ?? ""].join(" ")
          ).includes(parte)
        ))
  );
  const porTipo = (t: string) => semTipo.filter((r) => tipoDaEmenda(r) === t);
  const base = f.t ? porTipo(f.t) : semTipo;
  const todasEtapas = etapasEmOrdem(catalogo, new Set(emendas.map((r) => r.etapa)));
  const usadas = todasEtapas.filter((e) => base.some((r) => r.etapa === e.chave));
  const filtradas = base.filter((r) => !f.etapa || r.etapa === f.etapa);

  const ordenadas = filtradas.slice().sort((a, b) => {
    switch (f.ordem) {
      case "valor":
        return b.valor - a.valor;
      case "vereador":
        return a.vereador_numero - b.vereador_numero || a.numero_vereador - b.numero_vereador;
      case "etapa":
        return todasEtapas.findIndex((e) => e.chave === b.etapa) - todasEtapas.findIndex((e) => e.chave === a.etapa) || a.numero - b.numero;
      case "parada":
        return a.etapa_atualizada_em.localeCompare(b.etapa_atualizada_em);
      default:
        return a.numero - b.numero;
    }
  });
  const total = filtradas.reduce((t, r) => t + r.valor, 0);
  const pago = filtradas.reduce((t, r) => t + r.pago, 0);

  const exportar = new URLSearchParams({ ano: String(ano) });
  for (const k of ["v", "s", "etapa", "situacao", "numeros", "t"] as const) {
    const v = params.get(k);
    if (v) exportar.set(k, v);
  }
  if (busca.trim()) exportar.set("q", busca.trim());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-cataguases-marinho">Emendas de {ano}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {filtradas.length} emendas · {brl(total)} indicados · {brl(pago)} pagos
          </p>
        </div>
        <a
          href={`/emendas/exportar?${exportar}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm text-cataguases-marinho hover:bg-slate-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          Exportar Excel
        </a>
        <a
          href={`/emendas/exportar?${exportar}&formato=pdf`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm text-cataguases-marinho hover:bg-slate-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          Exportar PDF
        </a>
      </div>

      <div role="tablist" aria-label="Tipo de execução" className="flex flex-wrap gap-1 border-b border-slate-200">
        {[{ chave: "", nome: "Consolidado", cor: "#0C1D33", qtd: semTipo.length }, ...ORDEM_TIPOS.map((t) => ({ chave: t as string, nome: TIPOS_EXECUCAO[t].nome, cor: TIPOS_EXECUCAO[t].cor, qtd: porTipo(t).length }))].map((t) => (
          <button
            key={t.chave || "todos"}
            type="button"
            role="tab"
            aria-selected={f.t === t.chave}
            onClick={() => definir({ t: t.chave })}
            className={cn(
              "-mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3.5 text-sm transition-colors",
              f.t === t.chave ? "font-semibold text-cataguases-marinho" : "border-transparent text-slate-600 hover:text-cataguases-marinho"
            )}
            style={f.t === t.chave ? { borderBottomColor: t.cor } : undefined}
          >
            {t.chave && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.cor }} aria-hidden />}
            {t.nome}
            <span className="tabular-nums text-slate-500">{t.qtd}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-600 sm:max-w-sm">
          Buscar
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setLimite(POR_PAGINA);
            }}
            placeholder="Objeto, beneficiário, vereador, nº ou ficha"
            className={ESTILO_CAMPO}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Exercício
          <select className={ESTILO_CAMPO} value={String(ano)} onChange={(e) => definir({ ano: e.target.value })}>
            {anos.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Vereador
          <select className={ESTILO_CAMPO} value={f.v} onChange={(e) => definir({ v: e.target.value })}>
            <option value="">Todos</option>
            {vereadores.map((v) => (
              <option key={v.id} value={v.id}>
                {numeroVereador(v.numero)} · {v.nome}
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
          Situação
          <select className={ESTILO_CAMPO} value={f.situacao} onChange={(e) => definir({ situacao: e.target.value })}>
            <option value="">Todas</option>
            <option value="normal">Normal</option>
            <option value="impedida">Impedidas</option>
            <option value="cancelada">Canceladas</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Pendências
          <select className={ESTILO_CAMPO} value={f.p} onChange={(e) => definir({ p: e.target.value })}>
            <option value="">Todas</option>
            <option value="1">Só com pendência</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Ordenar por
          <select className={ESTILO_CAMPO} value={f.ordem} onChange={(e) => definir({ ordem: e.target.value === "numero" ? "" : e.target.value })}>
            <option value="numero">Número</option>
            <option value="valor">Maior valor</option>
            <option value="vereador">Vereador</option>
            <option value="etapa">Etapa (mais adiantadas)</option>
            <option value="parada">Há mais tempo sem mudança</option>
          </select>
        </label>
      </div>

      {f.numeros.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
          Mostrando só as emendas do alerta ({f.numeros.length}).
          <button type="button" onClick={() => definir({ numeros: "" })} className="ml-auto inline-flex items-center gap-1 font-medium hover:underline">
            <X className="h-3.5 w-3.5" aria-hidden /> Ver todas
          </button>
        </div>
      )}

      <div role="group" aria-label="Filtrar por etapa" className="flex flex-wrap gap-2">
        {[{ chave: "", nome: "Todas", cor: "#0C1D33" }, ...usadas].map((e) => {
          const ativo = f.etapa === e.chave;
          const qtd = e.chave ? base.filter((r) => r.etapa === e.chave).length : base.length;
          return (
            <button
              key={e.chave || "todas"}
              type="button"
              aria-pressed={ativo}
              onClick={() => definir({ etapa: e.chave })}
              className={cn(
                "inline-flex h-[34px] items-center gap-2 rounded-full border px-3 text-[13px] transition-colors",
                ativo ? "border-cataguases-marinho bg-cataguases-marinho text-white" : "border-slate-300 bg-white text-cataguases-marinho hover:bg-slate-50"
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.cor === "#CBD5E1" ? "#94A3B8" : e.cor }} aria-hidden />
              {e.nome}
              <span className="font-semibold tabular-nums">{qtd}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1000px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th scope="col" className="w-14 px-3.5 py-2.5 font-medium">Nº</th>
              <th scope="col" className="px-3.5 py-2.5 font-medium">Vereador</th>
              <th scope="col" className="px-3.5 py-2.5 font-medium">Objeto e beneficiário</th>
              <th scope="col" className="px-3.5 py-2.5 font-medium">Secretaria</th>
              <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Valor</th>
              <th scope="col" className="w-60 px-3.5 py-2.5 font-medium">Andamento</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.slice(0, limite).map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top hover:brightness-95" style={{ backgroundColor: `${TIPOS_EXECUCAO[tipoDaEmenda(r)].cor}12` }}>
                <td className="py-3 pl-3 pr-3.5 font-mono text-slate-500" style={{ borderLeft: `8px solid ${TIPOS_EXECUCAO[tipoDaEmenda(r)].cor}` }}>
                  {r.numero}
                </td>
                <td className="px-3.5 py-3">
                  {numeroVereador(r.vereador_numero)} · {r.vereador_nome}
                </td>
                <td className="max-w-[420px] px-3.5 py-3">
                  <Link href={`/emendas/${r.id}`} className="font-medium text-cataguases-marinho hover:text-[#4C3494] hover:underline">
                    {r.objeto}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                    {r.beneficiario_nome && <span>{r.beneficiario_nome}</span>}
                    {r.saude && <Chip tom="saude">Saúde</Chip>}
                    <TipoSelo tipo={tipoDaEmenda(r)} />
                    {r.remanejada && <Chip tom="amarelo">Remanejada</Chip>}
                    <Link href={`/emendas/${r.id}?aba=pendencias`} aria-label={`Ver ${resumos[r.id]?.abertas ?? 0} pendência(s) desta emenda`}>
                      <SeloPendencias quantidade={resumos[r.id]?.abertas ?? 0} gravidade={resumos[r.id]?.gravidade ?? null} />
                    </Link>
                  </div>
                </td>
                <td className="px-3.5 py-3 text-slate-700">
                  {r.secretaria_nome}
                  <div className="text-xs text-slate-500">
                    {r.unidade_codigo} {r.unidade_nome}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3.5 py-3 text-right font-medium tabular-nums">{brl(r.valor)}</td>
                <td className="px-3.5 py-3">
                  <RegraFases resumo={resumos[r.id]} cor={TIPOS_EXECUCAO[tipoDaEmenda(r)].cor} />
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                    <SeloEtapa etapa={r.etapa} situacao={r.situacao} catalogo={catalogo} />
                    <span className="text-slate-500">
                      {infoEtapa(r.etapa, catalogo).grupo === 3 && r.ultimo_pagamento ? `pago ${dataBr(r.ultimo_pagamento)}` : ""}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Nenhuma emenda encontrada com esses filtros.</p>}
      </div>

      <div className="flex items-center justify-center gap-3 text-[13px] text-slate-600">
        <span>
          Mostrando {Math.min(limite, filtradas.length)} de {filtradas.length}
        </span>
        {filtradas.length > limite && (
          <button
            type="button"
            onClick={() => setLimite((l) => l + POR_PAGINA)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm text-cataguases-marinho hover:bg-slate-50"
          >
            Mostrar mais {POR_PAGINA}
          </button>
        )}
      </div>
    </div>
  );
}
