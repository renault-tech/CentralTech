"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, SearchX, X } from "lucide-react";

import { BarraFases, macrosDoResumo } from "@/components/emendas/barra-fases";
import { useCatalogo } from "@/components/emendas/catalogo-etapas";
import { CategoriaSelo } from "@/components/emendas/categoria-selo";
import { HoverAndamento } from "@/components/emendas/hover-andamento";
import { MenuExportar } from "@/components/emendas/menu-exportar";
import { VoltarAoTopo } from "@/components/emendas/voltar-ao-topo";
import { EspacoTrabalho } from "@/components/emendas/espaco-trabalho";
import { PainelDetalheEmenda, type AtualizacaoEmenda } from "@/components/emendas/painel-detalhe-emenda";
import { FaixaIndicadores, GraficoFiltro } from "@/components/emendas/grafico-filtro";
import { chipsDosFiltros } from "@/components/emendas/painel-lista";
import { SeloPendencias, TipoSelo } from "@/components/emendas/tipo-selo";
import { Chip, SeloEtapa } from "@/components/emendas/ui";
import { useFiltrosUrl } from "@/components/modulo/use-filtros-url";
import { CLASSE_BOTAO } from "@/components/modulo/ui";
import { ORDEM_TIPOS, TIPOS_EXECUCAO, tipoDaEmenda } from "@/lib/emendas/fases";
import { ordenarEmendasLista } from "@/lib/emendas/ordenacao-lista";
import { filtrarEmendasLista, lerFiltrosLista } from "@/lib/emendas/painel-lista";
import { brl, brlCurto, etapasEmOrdem, numeroVereador } from "@/lib/emendas/regras";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { cn } from "@/lib/utils";
import type { EmendaResumo } from "@/types/emendas";

const CAMPO =
  "h-10 min-w-0 rounded-xl border border-slate-300 bg-white/80 px-3 text-sm text-cataguases-marinho outline-none transition-shadow focus:border-[color:var(--modulo)] focus:ring-2 focus:ring-[color:var(--modulo)]/25";

const SEM_ATUALIZACOES: Record<string, AtualizacaoEmenda> = {};

/**
 * Área de trabalho da lista de Emendas (telas largas): a página não rola, cada painel rola por dentro.
 *   1. Sem emenda escolhida: gráficos e filtros à esquerda, lista à direita.
 *   2. Ao escolher uma emenda: os gráficos recolhem numa faixa, a lista desliza para o lugar deles e o resumo da emenda
 *      abre à direita. Os filtros continuam valendo (chips no topo da lista); a faixa devolve os gráficos.
 * Em telas estreitas vale o empilhado de sempre e tocar numa emenda abre a página dela.
 */
export function AreaTrabalhoEmendas({ emendas: emendasServidor, resumos: resumosServidor, ano, podeCriar }: { emendas: EmendaResumo[]; resumos: Record<string, ResumoLinha>; ano: number; podeCriar: boolean }) {
  // Depois de gravar, a emenda recalculada entra aqui na hora; quando o servidor devolve a lista nova (revalidação em segundo
  // plano) as atualizações locais são descartadas, porque a lista já as traz.
  const [locais, setLocais] = React.useState<{ base: EmendaResumo[]; mapa: Record<string, AtualizacaoEmenda> }>({ base: emendasServidor, mapa: {} });
  const mapaLocal = locais.base === emendasServidor ? locais.mapa : SEM_ATUALIZACOES;
  const temLocais = Object.keys(mapaLocal).length > 0;
  const emendas = React.useMemo(() => (temLocais ? emendasServidor.map((e) => mapaLocal[e.id]?.emenda ?? e) : emendasServidor), [emendasServidor, mapaLocal, temLocais]);
  const resumos = React.useMemo(() => {
    if (!temLocais) return resumosServidor;
    const r = { ...resumosServidor };
    for (const [id, a] of Object.entries(mapaLocal)) r[id] = a.resumo;
    return r;
  }, [resumosServidor, mapaLocal, temLocais]);
  const atualizarLinha = React.useCallback(
    (id: string, dados: AtualizacaoEmenda) => setLocais((ant) => ({ base: emendasServidor, mapa: { ...(ant.base === emendasServidor ? ant.mapa : {}), [id]: dados } })),
    [emendasServidor]
  );
  const catalogo = useCatalogo();
  const { params, definir: definirUrl } = useFiltrosUrl("emendas-lista", String(ano));
  const busca = params.get("q") ?? "";
  const f = { ...lerFiltrosLista((k) => params.get(k), busca), ordem: params.get("ordem") ?? "numero" };
  const escolhidaId = params.get("e") ?? "";
  const escolhida = escolhidaId ? emendas.find((e) => e.id === escolhidaId) : undefined;
  const aberto = !!escolhida;
  // Painel expandido (ocupa a largura toda): guarda a emenda expandida, então trocar de emenda ou fechar volta ao normal.
  const [expandidaId, setExpandidaId] = React.useState("");
  const expandido = aberto && expandidaId === escolhidaId;

  const definir = React.useCallback((m: Record<string, string>) => definirUrl(m), [definirUrl]);

  const filtradas = filtrarEmendasLista(emendas, resumos, f);
  const semTipo = filtrarEmendasLista(emendas, resumos, f, ["t"]);
  const todasEtapas = etapasEmOrdem(catalogo, new Set(emendas.map((r) => r.etapa)));
  const ordenadas = ordenarEmendasLista(filtradas, f.ordem, f.q, resumos, todasEtapas.map((e) => e.chave));
  const total = filtradas.reduce((t, r) => t + r.valor, 0);
  const chips = chipsDosFiltros(f, emendas, catalogo);

  // A altura da área é o que sobra da janela: nada de rolar a página para ver o resultado do filtro.
  const listaRef = React.useRef<HTMLDivElement>(null);

  function escolher(id: string) {
    definir({ e: id });
  }
  function fechar() {
    definir({ e: "" });
  }

  // A seleção rola até ficar visível na lista.
  React.useEffect(() => {
    if (!escolhidaId) return;
    const t = setTimeout(() => listaRef.current?.querySelector(`[data-id="${CSS.escape(escolhidaId)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 120);
    return () => clearTimeout(t);
  }, [escolhidaId]);

  function teclasDaLista(ev: React.KeyboardEvent) {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    const itens = Array.from(listaRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    if (itens.length === 0) return;
    ev.preventDefault();
    const atual = itens.findIndex((i) => i === document.activeElement || i.dataset.id === escolhidaId);
    const prox = Math.min(itens.length - 1, Math.max(0, atual + (ev.key === "ArrowDown" ? 1 : -1)));
    const alvo = itens[prox];
    alvo.focus();
    alvo.scrollIntoView({ block: "nearest" });
    if (aberto) definir({ e: alvo.dataset.id ?? "" });
  }

  const exportar = new URLSearchParams({ ano: String(ano) });
  for (const k of ["v", "s", "etapa", "situacao", "numeros", "t", "fin", "sd", "rem", "cat"] as const) {
    const v = params.get(k);
    if (v) exportar.set(k, v);
  }
  if (busca.trim()) exportar.set("q", busca.trim());

  function limparTudo() {
    definir({ v: "", s: "", etapa: "", p: "", situacao: "", fin: "", sd: "", cat: "", rem: "", pe: "", numeros: "", q: "" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h1 className="!text-[1.25rem] font-semibold leading-tight tracking-[-0.02em] text-cataguases-marinho">Emendas de {ano}</h1>
        <div role="tablist" aria-label="Tipo de execução" className="emd-segmento flex flex-wrap items-center gap-0.5 rounded-xl bg-slate-200/60 p-0.5">
          {[{ chave: "", nome: "Consolidado", cor: "#0C1D33", qtd: semTipo.length }, ...ORDEM_TIPOS.map((t) => ({ chave: t as string, nome: TIPOS_EXECUCAO[t].nome, cor: TIPOS_EXECUCAO[t].cor, qtd: semTipo.filter((r) => tipoDaEmenda(r) === t).length }))].map((t) => (
            <button
              key={t.chave || "todos"}
              type="button"
              role="tab"
              aria-selected={f.t === t.chave}
              onClick={() => definir({ t: t.chave })}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition-all duration-200", f.t === t.chave ? "bg-white font-semibold text-cataguases-marinho shadow-sm" : "font-medium text-slate-600 hover:text-cataguases-marinho")}
            >
              {t.chave && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.cor }} aria-hidden />}
              {t.nome}
              <span className="tabular-nums text-slate-500">{t.qtd}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 print:hidden">
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

      <EspacoTrabalho
        aberto={aberto}
        expandido={expandido}
        aoFechar={fechar}
        aoRecolher={() => setExpandidaId("")}
        filtrosAtivos={chips.length}
        rotuloLista="Lista de emendas"
        rotuloDetalhe="Resumo da emenda"
        graficos={
          <>
              <FaixaIndicadores emendas={emendas} resumos={resumos} filtros={f} definir={definir} />
              <GraficoFiltro emendas={emendas} resumos={resumos} filtros={f} definir={definir} visaoInicial="etapa" className="border-b border-slate-200" />
              <GraficoFiltro emendas={emendas} resumos={resumos} filtros={f} definir={definir} visaoInicial="vereador" />
          </>
        }
        lista={
          <>
          <div className="space-y-2.5 border-b border-slate-200 px-4 pb-3 pt-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[11rem] flex-1">
                <span className="sr-only">Buscar emendas</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                <input type="search" value={busca} onChange={(e) => definirUrl({ q: e.target.value }, true)} placeholder="Buscar objeto, beneficiário ou vereador" className={`${CAMPO} w-full pl-9`} />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span className="sr-only sm:not-sr-only">Ordem</span>
                <select className={`${CAMPO} w-auto`} value={f.ordem} onChange={(e) => definir({ ordem: e.target.value === "numero" ? "" : e.target.value })}>
                  <option value="numero">Número</option>
                  <option value="valor">Maior valor</option>
                  <option value="vereador">Vereador</option>
                  <option value="etapa">Etapa (mais adiantadas)</option>
                  <option value="andamento">Maior % de andamento</option>
                  <option value="atrasadas">Menor % de andamento</option>
                  <option value="parada">Mais tempo sem mudança</option>
                </select>
              </label>
            </div>
            <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1.5" role="group" aria-label="Filtros ativos">
              <span className="text-[0.8125rem] tabular-nums text-slate-600" aria-live="polite">
                <strong className="font-semibold text-cataguases-marinho">{ordenadas.length}</strong> de {emendas.length} emendas · {brlCurto(total)}
              </span>
              {chips.map((c) => (
                <button key={c.chave} type="button" onClick={() => definir({ [c.chave]: "" })} title="Tirar este filtro" className="emd-chip inline-flex min-h-7 items-center gap-1 rounded-full border border-[color:var(--modulo-tinta)]/30 bg-[color-mix(in_srgb,var(--modulo)_10%,transparent)] py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-[color:var(--modulo-tinta)] hover:bg-[color-mix(in_srgb,var(--modulo)_18%,transparent)]">
                  {c.rotulo}
                  <X className="h-3 w-3" aria-hidden />
                  <span className="sr-only">Tirar este filtro</span>
                </button>
              ))}
              {chips.length > 0 && (
                <button type="button" onClick={limparTudo} className="rounded-lg px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-cataguases-marinho">
                  Limpar tudo
                </button>
              )}
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={listaRef} role="listbox" aria-label="Emendas" aria-activedescendant={escolhidaId ? `emenda-${escolhidaId}` : undefined} onKeyDown={teclasDaLista} className="emd-lista min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {ordenadas.length === 0 && (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><SearchX className="h-5 w-5" aria-hidden /></span>
                <p className="text-sm font-medium text-cataguases-marinho">Nenhuma emenda encontrada com esses filtros.</p>
                <button type="button" onClick={limparTudo} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-cataguases-marinho hover:bg-slate-50">Limpar filtros</button>
              </div>
            )}
            {ordenadas.map((r) => {
              const tipo = tipoDaEmenda(r);
              const cor = TIPOS_EXECUCAO[tipo].cor;
              const res = resumos[r.id];
              const sel = r.id === escolhidaId;
              return (
                <div
                  key={r.id}
                  id={`emenda-${r.id}`}
                  data-id={r.id}
                  role="option"
                  aria-selected={sel}
                  tabIndex={sel || (!escolhidaId && r === ordenadas[0]) ? 0 : -1}
                  onClick={(ev) => {
                    if ((ev.target as HTMLElement).closest("button,input,select")) return;
                    const link = (ev.target as HTMLElement).closest("a");
                    if (link && link.dataset.abrir !== "1") return;
                    if (ev.metaKey || ev.ctrlKey) return window.open(`/emendas/${r.id}`, "_blank", "noopener");
                    ev.preventDefault();
                    escolher(r.id);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      escolher(r.id);
                    }
                  }}
                  style={{ ["--tipo" as string]: cor }}
                  className={cn("emd-item group relative grid cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-x-2.5 border-b border-slate-100 py-3 pl-4 pr-4 outline-none", sel && "emd-item-sel")}
                >
                  <span aria-hidden className="emd-item-faixa absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ backgroundColor: cor }} />
                  <span className="pt-0.5 font-mono text-xs tabular-nums text-slate-500">{r.numero}</span>
                  <div className="min-w-0">
                    <Link href={`/emendas/${r.id}`} data-abrir="1" tabIndex={-1} className="line-clamp-2 text-[0.875rem] font-medium leading-snug text-cataguases-marinho">
                      {r.objeto}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-slate-600">
                      {r.beneficiario_nome ? `${r.beneficiario_nome} · ` : ""}
                      {numeroVereador(r.vereador_numero)} {r.vereador_nome} · {r.secretaria_nome}
                    </p>
                    {res && res.total > 0 && (
                      <HoverAndamento emenda={r} resumo={res}>
                        <BarraFases macros={macrosDoResumo(res)} cancelada={r.situacao === "cancelada"} className="mt-1.5" />
                      </HoverAndamento>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <TipoSelo tipo={tipo} />
                      <CategoriaSelo categoria={r.beneficiario_categoria} />
                      {r.saude && <Chip tom="saude">Saúde</Chip>}
                      {r.remanejada && <Chip tom="amarelo">Remanejada</Chip>}
                      <SeloPendencias quantidade={res?.abertas ?? 0} gravidade={res?.gravidade ?? null} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="whitespace-nowrap text-[0.875rem] font-semibold tabular-nums text-cataguases-marinho">{brl(r.valor)}</span>
                    <SeloEtapa etapa={r.etapa} situacao={r.situacao} catalogo={catalogo} />
                  </div>
                </div>
              );
            })}
          </div>
          <VoltarAoTopo alvoRef={listaRef} />
          </div>
          </>
        }
        detalhe={
          escolhida && (
            <PainelDetalheEmenda
              emendaId={escolhida.id}
              emenda={escolhida}
              resumo={resumos[escolhida.id]}
              aoFechar={fechar}
              expandido={expandido}
              aoExpandir={() => setExpandidaId(expandido ? "" : escolhida.id)}
              aoAtualizar={atualizarLinha}
            />
          )
        }
      />
    </div>
  );
}
