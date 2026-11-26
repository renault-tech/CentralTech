"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Download, Search, SearchX, X } from "lucide-react";

import { EspacoTrabalho } from "@/components/modulo/espaco-trabalho";
import { GraficoDimensao } from "@/components/modulo/grafico-dimensao";
import { useFiltrosUrl } from "@/components/modulo/use-filtros-url";
import { CLASSE_BOTAO_COMPACTO } from "@/components/modulo/ui";
import { VoltarAoTopo } from "@/components/modulo/voltar-ao-topo";
import { listaParaCsv, type ColunaCsv } from "@/lib/modulo/csv";
import { agruparPorDimensao, contarFiltros, filtrarItens, type Dimensao, type Medida } from "@/lib/modulo/area-trabalho";
import { cn } from "@/lib/utils";

const CAMPO =
  "h-10 min-w-0 rounded-[0.75rem] border border-slate-300 bg-white px-3 text-sm text-cataguases-marinho outline-none transition-shadow focus:border-[color:var(--modulo)] focus:ring-2 focus:ring-[color:var(--modulo)]/25";

function baixarCsv(nome: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type Kpi = { rotulo: string; valor: string; apoio?: string };
export type OrdemLista<T> = { chave: string; rotulo: string; comparar: (a: T, b: T) => number };

export type PropsAreaTrabalho<T> = {
  /** Chave da memória de filtros (por aba do navegador) e do contexto que a invalida. */
  chave: string;
  contexto?: string;
  titulo: string;
  unidades: { singular: string; plural: string };
  itens: T[];
  id: (item: T) => string;
  dims: Dimensao<T>[];
  medidas: Medida<T>[];
  /** Dimensão inicial de cada um dos dois gráficos. */
  graficos: [string, string];
  textoBusca: (item: T) => string;
  placeholderBusca: string;
  ordens: OrdemLista<T>[];
  kpis: (filtrados: T[], todos: T[]) => Kpi[];
  /** Conteúdo de uma linha da lista (função de módulo, de identidade estável: a linha é memoizada). */
  renderLinha: (item: T) => React.ReactNode;
  corLinha: (item: T) => string;
  /** Resumo ao lado (só consulta). */
  renderResumo: (item: T) => React.ReactNode;
  tituloResumo: (item: T) => string;
  subtituloResumo?: (item: T) => string;
  /** Página própria do item, onde ele é editado. */
  hrefPagina: (item: T) => string | null;
  rotuloPagina: string;
  /** Botões do alto (exportar, novo…); a função recebe os filtros atuais para que "Exportar" leve a lista como está na tela. */
  acoes?: React.ReactNode | ((params: URLSearchParams) => React.ReactNode);
  vazio: string;
  /** Colunas do arquivo "lista filtrada (CSV)": sai exatamente o que a tela mostra, com os filtros dos gráficos, a busca e a ordem. */
  exportar?: { arquivo: string; colunas: ColunaCsv<T>[] };
};

type PropsLinha<T> = { item: T; id: string; sel: boolean; primeira: boolean; render: (i: T) => React.ReactNode; cor: string; escolher: (id: string) => void; href: string | null };

function LinhaBase<T>({ item, id, sel, primeira, render, cor, escolher, href }: PropsLinha<T>) {
  return (
    <div
      id={`item-${id}`}
      data-id={id}
      role="option"
      aria-selected={sel}
      tabIndex={sel || primeira ? 0 : -1}
      onClick={(ev) => {
        if ((ev.target as HTMLElement).closest("button,input,select,a")) return;
        if ((ev.metaKey || ev.ctrlKey) && href) return void window.open(href, "_blank", "noopener");
        escolher(id);
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          escolher(id);
        }
      }}
      style={{ ["--tipo" as string]: cor }}
      className={cn("emd-item group relative cursor-pointer border-b border-slate-100 py-3 pl-4 pr-4 outline-none", sel && "emd-item-sel")}
    >
      <span aria-hidden className="emd-item-faixa absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ backgroundColor: cor }} />
      {render(item)}
    </div>
  );
}
/** Memoizada: escolher um item só refaz a linha que perdeu e a que ganhou a seleção. */
const Linha = React.memo(LinhaBase) as typeof LinhaBase;

/**
 * Área de trabalho de uma lista (telas largas), a mesma do módulo Emendas: gráficos que também são filtros à esquerda, a lista no
 * meio e, ao escolher um item, o resumo à direita (só consulta; a edição continua na página própria do item). Os gráficos recolhem
 * numa faixa quando o resumo abre. Em tela estreita o resumo abre como folha por cima da lista. Os filtros moram na URL (`?e=`
 * guarda o item aberto) e são lembrados ao voltar de uma página de edição.
 */
export function AreaTrabalhoLista<T>(p: PropsAreaTrabalho<T>) {
  const { params, definir: definirUrl } = useFiltrosUrl(p.chave, p.contexto ?? "");
  const ler = React.useCallback((k: string) => params.get(k), [params]);
  const q = params.get("q") ?? "";
  const ordemChave = params.get("ordem") ?? p.ordens[0].chave;
  const ordem = p.ordens.find((o) => o.chave === ordemChave) ?? p.ordens[0];
  const escolhidaId = params.get("e") ?? "";
  const escolhida = escolhidaId ? p.itens.find((i) => p.id(i) === escolhidaId) : undefined;
  const aberto = !!escolhida;
  const definir = React.useCallback((m: Record<string, string>) => definirUrl(m), [definirUrl]);
  const busca = { texto: p.textoBusca, q };

  const filtrados = filtrarItens(p.itens, p.dims, ler, busca);
  const ordenados = [...filtrados].sort(ordem.comparar);
  const filtros = contarFiltros(p.dims, ler, q);
  const kpis = p.kpis(filtrados, p.itens);

  const chips = p.dims
    .filter((d) => !!ler(d.param))
    .map((d) => {
      const bruto = ler(d.param) as string;
      const grupo = agruparPorDimensao(p.itens, d).find((g) => g.chave === bruto);
      return { param: d.param, rotulo: `${d.rotulo}: ${grupo?.rotulo ?? d.rotulosAlias?.[bruto] ?? bruto}` };
    });

  const listaRef = React.useRef<HTMLDivElement>(null);
  const escolher = React.useCallback((id: string) => definir({ e: id }), [definir]);
  const fechar = React.useCallback(() => definir({ e: "" }), [definir]);
  const limparTudo = () => definir({ ...Object.fromEntries(p.dims.map((d) => [d.param, ""])), q: "" });

  React.useEffect(() => {
    if (!escolhidaId) return;
    const t = setTimeout(() => listaRef.current?.querySelector(`[data-id="${CSS.escape(escolhidaId)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 120);
    return () => clearTimeout(t);
  }, [escolhidaId]);

  function teclasDaLista(ev: React.KeyboardEvent) {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    const linhas = Array.from(listaRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    if (linhas.length === 0) return;
    ev.preventDefault();
    const atual = linhas.findIndex((i) => i === document.activeElement || i.dataset.id === escolhidaId);
    const alvo = linhas[Math.min(linhas.length - 1, Math.max(0, atual + (ev.key === "ArrowDown" ? 1 : -1)))];
    alvo.focus();
    alvo.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (aberto) definir({ e: alvo.dataset.id ?? "" });
  }

  const graficoProps = { itens: p.itens, dims: p.dims, medidas: p.medidas, ler, definir, busca, unidades: p.unidades };
  const noSemItens = p.itens.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h1 className="!text-[1.25rem] font-semibold leading-tight tracking-[-0.02em] text-cataguases-marinho">{p.titulo}</h1>
        {(p.acoes || p.exportar) && (
          <div className="ml-auto flex flex-wrap items-center gap-2 print:hidden">
            {p.exportar && (
              <button
                type="button"
                title={`Baixa as ${ordenados.length} ${p.unidades.plural} que estão na lista, com os filtros atuais`}
                onClick={() => baixarCsv(`${p.exportar!.arquivo}-${new Date().toISOString().slice(0, 10)}.csv`, listaParaCsv(p.exportar!.colunas, ordenados))}
                className={cn(CLASSE_BOTAO_COMPACTO, "gap-1.5")}
              >
                <Download className="h-4 w-4" aria-hidden />
                Lista filtrada (CSV)
              </button>
            )}
            {typeof p.acoes === "function" ? p.acoes(params) : p.acoes}
          </div>
        )}
      </div>

      <EspacoTrabalho
        aberto={aberto}
        expandido={false}
        aoFechar={fechar}
        aoRecolher={() => undefined}
        filtrosAtivos={chips.length}
        aoLimpar={limparTudo}
        rotuloLista={`Lista de ${p.unidades.plural}`}
        rotuloDetalhe={`Resumo`}
        graficos={
          <>
            {kpis.length > 0 && (
              <div className="grid grid-cols-2 border-b border-slate-200 sm:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ ["--n" as string]: kpis.length }}>
                {kpis.map((k) => (
                  <div key={k.rotulo} className="min-w-0 border-slate-200 px-3 py-2 max-sm:[&:nth-child(even)]:border-l max-sm:[&:nth-child(n+3)]:border-t sm:border-l sm:first:border-l-0">
                    <p className="truncate text-xs font-medium text-slate-600">{k.rotulo}</p>
                    <p className="truncate text-base font-semibold leading-tight tabular-nums text-cataguases-marinho">{k.valor}</p>
                    {k.apoio && <p className="truncate text-xs tabular-nums text-slate-500">{k.apoio}</p>}
                  </div>
                ))}
              </div>
            )}
            <GraficoDimensao {...graficoProps} dimInicial={p.graficos[0]} className="border-b border-slate-200" />
            <GraficoDimensao {...graficoProps} dimInicial={p.graficos[1]} />
          </>
        }
        lista={
          <>
            <div className="space-y-2.5 border-b border-slate-200 px-4 pb-3 pt-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-[11rem] flex-1">
                  <span className="sr-only">Buscar</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                  <input type="search" value={q} onChange={(e) => definirUrl({ q: e.target.value }, true)} placeholder={p.placeholderBusca} className={`${CAMPO} w-full pl-9`} />
                </label>
                {p.ordens.length > 1 && (
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="sr-only sm:not-sr-only">Ordem</span>
                    <select className={`${CAMPO} w-auto`} value={ordem.chave} onChange={(e) => definir({ ordem: e.target.value === p.ordens[0].chave ? "" : e.target.value })}>
                      {p.ordens.map((o) => (
                        <option key={o.chave} value={o.chave}>
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1.5" role="group" aria-label="Filtros ativos">
                <span className="text-[0.8125rem] tabular-nums text-slate-600" aria-live="polite">
                  <strong className="font-semibold text-cataguases-marinho">{ordenados.length}</strong> de {p.itens.length} {p.unidades.plural}
                </span>
                {chips.map((c) => (
                  <button key={c.param} type="button" onClick={() => definir({ [c.param]: "" })} title="Tirar este filtro" className="emd-chip inline-flex min-h-7 items-center gap-1 rounded-full border border-[color:var(--modulo-tinta)]/30 bg-[color-mix(in_srgb,var(--modulo)_10%,transparent)] py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-[color:var(--modulo-tinta)] hover:bg-[color-mix(in_srgb,var(--modulo)_18%,transparent)]">
                    {c.rotulo}
                    <X className="h-3 w-3" aria-hidden />
                    <span className="sr-only">Tirar este filtro</span>
                  </button>
                ))}
                {filtros > 0 && (
                  <button type="button" onClick={limparTudo} className="rounded-lg px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-cataguases-marinho">
                    Limpar tudo
                  </button>
                )}
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div ref={listaRef} role="listbox" aria-label={p.titulo} aria-activedescendant={escolhidaId ? `item-${escolhidaId}` : undefined} onKeyDown={teclasDaLista} className="emd-lista min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {ordenados.length === 0 && (
                  <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <SearchX className="h-5 w-5" aria-hidden />
                    </span>
                    <p className="text-sm font-medium text-cataguases-marinho">{noSemItens ? p.vazio : `Nenhum item encontrado com esses filtros.`}</p>
                    {!noSemItens && (
                      <button type="button" onClick={limparTudo} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-cataguases-marinho hover:bg-slate-50">
                        Limpar filtros
                      </button>
                    )}
                  </div>
                )}
                {ordenados.map((item, i) => {
                  const id = p.id(item);
                  return <Linha key={id} item={item} id={id} sel={id === escolhidaId} primeira={!escolhidaId && i === 0} render={p.renderLinha} cor={p.corLinha(item)} escolher={escolher} href={p.hrefPagina(item)} />;
                })}
              </div>
              <VoltarAoTopo alvoRef={listaRef} />
            </div>
          </>
        }
        detalhe={
          escolhida && (
            <div className="flex h-full min-h-0 flex-col">
              <header className="flex items-start gap-2 border-b border-slate-200 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-base font-semibold leading-snug text-cataguases-marinho">{p.tituloResumo(escolhida)}</h2>
                  {p.subtituloResumo && <p className="mt-0.5 truncate text-xs text-slate-600">{p.subtituloResumo(escolhida)}</p>}
                </div>
                {p.hrefPagina(escolhida) && (
                  <Link href={p.hrefPagina(escolhida) as string} className={cn(CLASSE_BOTAO_COMPACTO, "flex-none")}>
                    {p.rotuloPagina}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                )}
                <button type="button" onClick={fechar} aria-label="Fechar o resumo" title="Fechar (Esc)" className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-cataguases-marinho">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </header>
              <div className="emd-rola min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{p.renderResumo(escolhida)}</div>
            </div>
          )
        }
      />
    </div>
  );
}
