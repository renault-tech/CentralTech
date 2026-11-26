"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { EspacoTrabalho } from "@/components/modulo/espaco-trabalho";
import { MenuExportar } from "@/components/emendas/menu-exportar";
import { PainelDetalheEmenda } from "@/components/emendas/painel-detalhe-emenda";
import { PainelPendencias, chipsDePendencias, removerFiltroPendencia } from "@/components/emendas/painel-pendencias";
import { VoltarAoTopo } from "@/components/modulo/voltar-ao-topo";
import { TipoSelo } from "@/components/emendas/tipo-selo";
import { useFiltrosUrl } from "@/components/modulo/use-filtros-url";
import { normalizarTexto, pontuarBusca } from "@/lib/emendas/painel-lista";
import { docsDoFiltro, filtrarPendencias, lerFiltros, textoDaLinha, type EmendaPainel, type LinhaDocFaltando, type LinhaPendencia } from "@/lib/emendas/painel-pendencias";
import { NOME_GRAVIDADE, type Gravidade } from "@/lib/emendas/pendencias";
import { brl, dataBr } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";

export type { LinhaPendencia };

const COR: Record<Gravidade, string> = { alta: "#B91C1C", media: "#B45309", baixa: "#64748B" };
const CAMPO =
  "h-10 min-w-0 rounded-[0.75rem] border border-slate-300 bg-white px-3 text-sm text-cataguases-marinho outline-none transition-shadow focus:border-[color:var(--modulo)] focus:ring-2 focus:ring-[color:var(--modulo)]/25";
const POR_PAGINA = 40;

/**
 * Pendências no padrão da área de trabalho: o painel de gráficos filtra, a lista responde ao lado e, ao escolher uma pendência,
 * a emenda abre à direita (na aba Pendências) sem sair da lista.
 */
export function ListaPendencias({ linhas, docs, emendas, secretarias, ano }: { linhas: LinhaPendencia[]; docs: LinhaDocFaltando[]; emendas: EmendaPainel[]; secretarias: { id: string; nome: string }[]; ano: number }) {
  const { params, definir: definirUrl } = useFiltrosUrl("emendas-pendencias", String(ano));
  const [limite, setLimite] = React.useState(POR_PAGINA);
  const [expandidaId, setExpandidaId] = React.useState("");
  const listaRef = React.useRef<HTMLUListElement>(null);
  const busca = params.get("q") ?? "";
  // Identidade estável enquanto os filtros não mudam: escolher uma emenda (`e`) não refaz gráficos nem a lista.
  const fTexto = JSON.stringify(lerFiltros((k) => params.get(k)));
  const f = JSON.parse(fTexto) as ReturnType<typeof lerFiltros>;
  const escolhidaId = params.get("e") ?? "";
  const aberto = !!escolhidaId;
  const expandido = aberto && expandidaId === escolhidaId;
  const definir = (m: Record<string, string>) => {
    setLimite(POR_PAGINA);
    definirUrl(m);
  };

  const totalJustificadas = linhas.filter((l) => l.justificativa).length;
  const achadas = filtrarPendencias(linhas, { ...f, q: busca });
  // Com texto na busca, a emenda cujo número é o digitado vem primeiro, depois as mais parecidas; sem busca, a ordem de sempre.
  const textoBusca = normalizarTexto(busca.trim());
  const filtradas = textoBusca
    ? achadas
        .map((l, i) => ({ l, i, p: pontuarBusca({ numero: l.numero, objeto: l.objeto, outros: [l.secretaria, textoDaLinha(l)] }, textoBusca) }))
        .sort((a, b) => b.p - a.p || a.i - b.i)
        .map((x) => x.l)
    : achadas;
  const consultaExcel = (() => {
    const p = new URLSearchParams(params.toString());
    p.delete("e");
    p.set("ano", String(ano));
    if (busca.trim()) p.set("q", busca.trim());
    return p.toString();
  })();
  const chips = chipsDePendencias({ ...f, q: busca }, linhas, secretarias, docs);
  const limparTudo = () => definir({ t: "", g: "", s: "", r: "", a: "", m: "", j: "", q: "", d: "" });
  // Com um documento faltando escolhido, a lista passa a ser das emendas que ainda não o têm (uma linha por emenda).
  const modoDoc = !!f.d;
  const semDoc = docsDoFiltro(docs, { ...f, q: busca });
  const rotuloDoc = docs.find((x) => x.doc === f.d)?.rotulo ?? f.d;
  const total = modoDoc ? semDoc.length : filtradas.length;

  return (
    <EspacoTrabalho
      aberto={aberto}
      expandido={expandido}
      aoFechar={() => definirUrl({ e: "" })}
      aoRecolher={() => setExpandidaId("")}
      aoExpandir={() => setExpandidaId(expandido ? "" : escolhidaId)}
      filtrosAtivos={chips.length}
      aoLimpar={limparTudo}
      rotuloLista="Lista de pendências"
      rotuloDetalhe="Emenda escolhida"
      graficos={<PainelPendencias linhas={linhas} docs={docs} emendas={emendas} secretarias={secretarias} filtros={{ ...f, q: busca }} definir={definir} ano={ano} />}
      lista={
        <>
          <div className="space-y-2.5 border-b border-slate-200 px-4 pb-3 pt-3.5 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[11rem] flex-1">
                <span className="sr-only">Buscar pendências</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                <input
                  type="search"
                  value={busca}
                  placeholder="Buscar nº, objeto ou secretaria"
                  className={`${CAMPO} w-full pl-9`}
                  onChange={(e) => {
                    setLimite(POR_PAGINA);
                    definirUrl({ q: e.target.value }, true);
                  }}
                />
              </label>
              <MenuExportar
                opcoes={[
                  { rotulo: "Excel (.xlsx)", detalhe: modoDoc ? "Totais por corte e as emendas sem o documento" : "Totais por corte e a lista, com os filtros atuais", href: `/emendas/pendencias/exportar?${consultaExcel}` },
                  { rotulo: "PDF", detalhe: modoDoc ? "As emendas sem o documento, com os filtros atuais" : "A lista de pendências, com os filtros atuais", href: `/emendas/pendencias/exportar?${consultaExcel}&formato=pdf` },
                  { rotulo: "Imprimir o painel", detalhe: "Gráficos e filtros, pela impressão do navegador", imprimir: true },
                ]}
              />
            </div>
            <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1.5" role="group" aria-label="Filtros ativos">
              <span className="text-[0.8125rem] tabular-nums text-slate-600" aria-live="polite">
                <strong className="font-semibold text-cataguases-marinho">{total}</strong> {modoDoc ? `emendas sem ${rotuloDoc.toLowerCase()}` : "pendências"}
              </span>
              {!modoDoc && totalJustificadas > 0 && (
                <label className="inline-flex min-h-7 cursor-pointer items-center gap-1.5 text-[0.8125rem] text-slate-700">
                  <input type="checkbox" className="h-4 w-4 accent-[color:var(--modulo)]" checked={f.j === "1"} onChange={(e) => definir({ j: e.target.checked ? "1" : "" })} />
                  Incluir justificadas ({totalJustificadas})
                </label>
              )}
              {chips.map((c) => (
                <button key={c.chave} type="button" onClick={() => definir(removerFiltroPendencia(c.chave))} title="Tirar este filtro" className="emd-chip inline-flex min-h-7 items-center gap-1 rounded-full border border-[color:var(--modulo-tinta)]/30 bg-[color-mix(in_srgb,var(--modulo)_10%,transparent)] py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-[color:var(--modulo-tinta)] hover:bg-[color-mix(in_srgb,var(--modulo)_18%,transparent)]">
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
          <ul ref={listaRef} className="emd-lista min-h-0 flex-1 overflow-y-auto overscroll-contain print:hidden" aria-label="Pendências">
            {modoDoc &&
              semDoc.slice(0, limite).map((d) => {
                const sel = d.emendaId === escolhidaId;
                return (
                  <li key={`${d.emendaId}:${d.doc}`} className="border-b border-slate-100">
                    <button
                      type="button"
                      aria-pressed={sel}
                      onClick={() => definirUrl({ e: sel ? "" : d.emendaId })}
                      className={cn("emd-item relative block w-full py-3 pl-5 pr-4 text-left outline-none", sel && "emd-item-sel")}
                      style={{ ["--tipo" as string]: COR.media }}
                    >
                      <span aria-hidden className="emd-item-faixa absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ backgroundColor: COR.media }} />
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <strong className="text-[0.875rem] text-cataguases-marinho">Emenda nº {d.numero}</strong>
                        <span className="text-xs font-medium text-amber-700">Falta: {d.rotulo}</span>
                        <span className="ml-auto text-xs tabular-nums text-slate-600">{brl(d.valor)}</span>
                      </span>
                      <span className="mt-0.5 block text-[0.8125rem] text-slate-700">{d.objeto}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                        <TipoSelo tipo={d.tipo} />
                        <span>{d.secretaria}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            {modoDoc && semDoc.length === 0 && <li className="p-8 text-center text-sm text-slate-600">Nenhuma emenda sem este documento com esses filtros.</li>}
            {modoDoc && semDoc.length > limite && (
              <li className="p-3 text-center">
                <button type="button" onClick={() => setLimite((x) => x + POR_PAGINA)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-4 py-1 text-sm text-cataguases-marinho hover:bg-slate-50">
                  Mostrar mais {POR_PAGINA}
                </button>
              </li>
            )}
            {!modoDoc && filtradas.slice(0, limite).map((l) => {
              const sel = l.emendaId === escolhidaId;
              return (
                <li key={`${l.emendaId}:${l.regra}`} className="border-b border-slate-100">
                  <button
                    type="button"
                    aria-pressed={sel}
                    onClick={() => definirUrl({ e: sel ? "" : l.emendaId })}
                    className={cn("emd-item relative block w-full py-3 pl-5 pr-4 text-left outline-none", sel && "emd-item-sel")}
                    style={{ ["--tipo" as string]: COR[l.gravidade] }}
                  >
                    <span aria-hidden className="emd-item-faixa absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ backgroundColor: COR[l.gravidade] }} />
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <strong className="text-[0.875rem] text-cataguases-marinho">{l.titulo}</strong>
                      <span className="text-xs font-medium" style={{ color: COR[l.gravidade] }}>{NOME_GRAVIDADE[l.gravidade]}</span>
                      <span className="ml-auto text-xs tabular-nums text-slate-600">{brl(l.valor)}</span>
                    </span>
                    {!!l.motivos?.length && (
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {l.motivos.map((m) => (
                          <span key={m.chave} className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{m.rotulo}</span>
                        ))}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[0.8125rem] text-slate-700">{l.detalhe}</span>
                    {l.justificativa && (
                      <span className="mt-1 block rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
                        <strong>Justificada{l.justificadaEm ? ` em ${dataBr(l.justificadaEm.slice(0, 10))}` : ""}:</strong> {l.justificativa}
                      </span>
                    )}
                    {l.base && <span className="block text-xs text-slate-600">Base legal: {l.base}</span>}
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                      <span className="font-mono">nº {l.numero}</span>
                      <TipoSelo tipo={l.tipo} />
                      <span>{l.secretaria}</span>
                      <span className="min-w-0 truncate">{l.objeto}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!modoDoc && filtradas.length === 0 && <li className="p-8 text-center text-sm text-slate-600">Nenhuma pendência com esses filtros.</li>}
            {!modoDoc && filtradas.length > limite && (
              <li className="p-3 text-center">
                <button type="button" onClick={() => setLimite((x) => x + POR_PAGINA)} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm text-cataguases-marinho hover:bg-slate-50">
                  Mostrar mais {POR_PAGINA}
                </button>
              </li>
            )}
          </ul>
          <VoltarAoTopo alvoRef={listaRef} />
          </div>
        </>
      }
      detalhe={
        aberto && (
          <PainelDetalheEmenda
            emendaId={escolhidaId}
            abaInicial={modoDoc ? "documentacao" : "pendencias"}
            aoFechar={() => definirUrl({ e: "" })}
            expandido={expandido}
            aoExpandir={() => setExpandidaId(expandido ? "" : escolhidaId)}
          />
        )
      }
    />
  );
}
