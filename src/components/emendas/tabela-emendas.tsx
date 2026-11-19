"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { Chip, SeloEtapa } from "@/components/emendas/ui";
import { PainelLista } from "@/components/emendas/painel-lista";
import { MenuExportar } from "@/components/emendas/menu-exportar";
import { CLASSE_BOTAO } from "@/components/modulo/ui";
import { CategoriaSelo } from "@/components/emendas/categoria-selo";
import { SeloPendencias, TipoSelo } from "@/components/emendas/tipo-selo";
import { atualizarFiltrosNaUrl } from "@/lib/filtros-url";
import { useCatalogo } from "@/components/emendas/catalogo-etapas";
import { ORDEM_TIPOS, TIPOS_EXECUCAO, tipoDaEmenda } from "@/lib/emendas/fases";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { brl, dataBr, etapasEmOrdem, infoEtapa, numeroVereador } from "@/lib/emendas/regras";
import { filtrarEmendasLista, lerFiltrosLista } from "@/lib/emendas/painel-lista";
import { cn } from "@/lib/utils";
import type { EmendaResumo } from "@/types/emendas";

const ESTILO_CAMPO =
  "h-[38px] min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]";

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

/** Lista de emendas: busca, filtros (na URL), ordenação, barra de andamento
 * por linha. A planilha antiga, só que viva. */
export function TabelaEmendas({
  emendas,
  resumos,
  ano,
  podeCriar,
}: {
  emendas: EmendaResumo[];
  resumos: Record<string, ResumoLinha>;
  ano: number;
  /** Gestor: mostra "Nova emenda" na linha do título (antes ficava sozinho numa linha da faixa de abas). */
  podeCriar: boolean;
}) {
  const catalogo = useCatalogo();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [busca, setBusca] = React.useState(params.get("q") ?? "");
  const pausaUrl = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [limite, setLimite] = React.useState(POR_PAGINA);

  const f = { ...lerFiltrosLista((k) => params.get(k), busca), ordem: params.get("ordem") ?? "numero" };

  function definir(m: Record<string, string>) {
    setLimite(POR_PAGINA);
    atualizarFiltrosNaUrl(params, m, pathname, (url) => router.replace(url, { scroll: false }));
  }

  // Os mesmos filtros alimentam a tabela e o dashboard; cada aba de tipo conta com todos os filtros, menos o de tipo.
  const filtradas = filtrarEmendasLista(emendas, resumos, f);
  const semTipo = filtrarEmendasLista(emendas, resumos, f, ["t"]);
  const porTipo = (t: string) => semTipo.filter((r) => tipoDaEmenda(r) === t);
  const todasEtapas = etapasEmOrdem(catalogo, new Set(emendas.map((r) => r.etapa)));

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
  for (const k of ["v", "s", "etapa", "situacao", "numeros", "t", "fin", "sd", "rem", "cat"] as const) {
    const v = params.get(k);
    if (v) exportar.set(k, v);
  }
  if (busca.trim()) exportar.set("q", busca.trim());

  // Barra enxuta: só o que o gráfico não faz (buscar texto e ordenar). Todo o resto se filtra clicando no painel.
  const barra = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="relative min-w-[14rem] flex-1">
        <span className="sr-only">Buscar emendas</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
        <input
          type="search"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setLimite(POR_PAGINA);
            // grava na URL (para o link reproduzir a busca) depois de uma pausa; o filtro local é imediato
            const texto = e.target.value.trim();
            if (pausaUrl.current) clearTimeout(pausaUrl.current);
            pausaUrl.current = setTimeout(() => atualizarFiltrosNaUrl(new URLSearchParams(window.location.search), { q: texto }, pathname, () => {}), 250);
          }}
          placeholder="Buscar objeto, beneficiário ou vereador"
          className={`${ESTILO_CAMPO} w-full pl-9`}
        />
      </label>
      <label className="inline-flex items-center gap-2 text-sm text-slate-600">
        Ordenar por
        <select className={`${ESTILO_CAMPO} w-auto`} value={f.ordem} onChange={(e) => definir({ ordem: e.target.value === "numero" ? "" : e.target.value })}>
          <option value="numero">Número</option>
          <option value="valor">Maior valor</option>
          <option value="vereador">Vereador</option>
          <option value="etapa">Etapa (mais adiantadas)</option>
          <option value="parada">Há mais tempo sem mudança</option>
        </select>
      </label>
    </div>
  );

  function limparTudo() {
    setBusca("");
    setLimite(POR_PAGINA);
    definir({ v: "", s: "", etapa: "", p: "", situacao: "", fin: "", sd: "", cat: "", rem: "", pe: "", numeros: "", q: "" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-cataguases-marinho">Emendas de {ano}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {filtradas.length} emendas · {brl(total)} indicados · {brl(pago)} pagos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <MenuExportar
            opcoes={[
              { rotulo: "Excel (.xlsx)", detalhe: "Planilha completa, com execução e parceria", href: `/emendas/exportar?${exportar}` },
              { rotulo: "PDF", detalhe: "Lista resumida para imprimir ou enviar", href: `/emendas/exportar?${exportar}&formato=pdf` },
            ]}
          />
          {podeCriar && (
            <Link href="/emendas/nova" className={CLASSE_BOTAO}>
              <Plus className="h-4 w-4" aria-hidden />
              Nova emenda
            </Link>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="Tipo de execução" className="flex flex-wrap gap-1 border-b border-slate-300">
        {[{ chave: "", nome: "Consolidado", cor: "#0C1D33", qtd: semTipo.length }, ...ORDEM_TIPOS.map((t) => ({ chave: t as string, nome: TIPOS_EXECUCAO[t].nome, cor: TIPOS_EXECUCAO[t].cor, qtd: porTipo(t).length }))].map((t) => (
          <button
            key={t.chave || "todos"}
            type="button"
            role="tab"
            aria-selected={f.t === t.chave}
            onClick={() => definir({ t: t.chave })}
            className={cn(
              "-mb-px inline-flex h-11 items-center gap-2 rounded-t-lg border-b-[3px] px-4 text-sm transition-colors",
              f.t === t.chave ? "font-semibold text-cataguases-marinho" : "border-transparent font-medium text-slate-700 hover:bg-slate-100 hover:text-cataguases-marinho"
            )}
            style={f.t === t.chave ? { borderBottomColor: t.cor, backgroundColor: `${t.cor}14` } : undefined}
          >
            {t.chave && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.cor }} aria-hidden />}
            {t.nome}
            <span className="tabular-nums text-slate-500">{t.qtd}</span>
          </button>
        ))}
      </div>

      <PainelLista emendas={emendas} resumos={resumos} filtros={f} definir={definir} barra={barra} aoLimparTudo={limparTudo} />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1000px] border-collapse text-[0.8125rem]">
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
                    <CategoriaSelo categoria={r.beneficiario_categoria} />
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

      <div className="flex items-center justify-center gap-3 text-[0.8125rem] text-slate-600">
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
