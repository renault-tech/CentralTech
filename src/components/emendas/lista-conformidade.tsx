"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { BaseLegalLinha } from "@/components/emendas/base-legal";
import { CaixaInfo, CaixaLinhas, CaixaNota, CaixaTitulo } from "@/components/modulo/caixa-info";
import { EspacoTrabalho } from "@/components/modulo/espaco-trabalho";
import { MenuExportar } from "@/components/emendas/menu-exportar";
import { PainelDetalheEmenda } from "@/components/emendas/painel-detalhe-emenda";
import { CINZA, PALETA, Pizza } from "@/components/modulo/pizza";
import { VoltarAoTopo } from "@/components/modulo/voltar-ao-topo";
import { TipoSelo } from "@/components/emendas/tipo-selo";
import { useFiltrosUrl } from "@/components/modulo/use-filtros-url";
import { ORDEM_TIPOS, TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { normalizarTexto, pontuarBusca } from "@/lib/emendas/painel-lista";
import { pct } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import type { TipoExecucao } from "@/types/emendas";

export type ResumoItem = { codigo: string; nome: string; exigencia: string; aplicaveis: number; atendem: number };
export type LinhaConformidade = { id: string; numero: number; objeto: string; secretaria: string; tipo: TipoExecucao; executada: boolean; faltas: string[] };

const CAMPO =
  "h-10 min-w-0 rounded-[0.75rem] border border-slate-300 bg-white px-3 text-sm text-cataguases-marinho outline-none transition-shadow focus:border-[color:var(--modulo)] focus:ring-2 focus:ring-[color:var(--modulo)]/25";
const POR_PAGINA = 40;
const rotuloCodigo = (c: string) => (c === "art5" ? "Art. 5º" : `Art. 7º, ${c}`);

type Dim = "item" | "secretaria" | "tipo" | "situacao";
const DIMENSOES: { chave: Dim; rotulo: string; param: "i" | "s" | "t" | "x" }[] = [
  { chave: "item", rotulo: "Item exigido", param: "i" },
  { chave: "secretaria", rotulo: "Secretaria", param: "s" },
  { chave: "tipo", rotulo: "Tipo de execução", param: "t" },
  { chave: "situacao", rotulo: "Execução", param: "x" },
];
type Filtros = { i: string; s: string; t: string; x: string; q: string };
type ItemGrafico = { chave: string; rotulo: string; n: number; cor: string; dica?: string };

function filtrar(linhas: LinhaConformidade[], f: Filtros, ignorar?: keyof Filtros): LinhaConformidade[] {
  const q = normalizarTexto(f.q.trim());
  return linhas.filter(
    (l) =>
      l.faltas.length > 0 &&
      (ignorar === "i" || !f.i || l.faltas.includes(f.i)) &&
      (ignorar === "s" || !f.s || l.secretaria === f.s) &&
      (ignorar === "t" || !f.t || l.tipo === f.t) &&
      (ignorar === "x" || !f.x || (f.x === "1" ? l.executada : !l.executada)) &&
      (!q || pontuarBusca({ numero: l.numero, objeto: l.objeto, outros: [l.secretaria] }, q) > 0)
  );
}

function GraficoConformidade({ linhas, resumo, filtros: f, definir, visaoInicial, className }: { linhas: LinhaConformidade[]; resumo: ResumoItem[]; filtros: Filtros; definir: (m: Record<string, string>) => void; visaoInicial: Dim; className?: string }) {
  const [dim, setDim] = React.useState<Dim>(visaoInicial);
  const [sobre, setSobre] = React.useState<string | null>(null);
  const id = React.useId();
  const def = DIMENSOES.find((d) => d.chave === dim)!;
  const base = filtrar(linhas, f, def.param);
  const selecionada = f[def.param];

  const itens: ItemGrafico[] = (() => {
    if (dim === "item")
      return resumo
        .map((r, i) => ({ chave: r.codigo, rotulo: `${rotuloCodigo(r.codigo)} · ${r.nome}`, n: base.filter((l) => l.faltas.includes(r.codigo)).length, cor: PALETA[i % PALETA.length], dica: `${r.atendem} de ${r.aplicaveis} atendem${r.aplicaveis ? ` (${pct(r.atendem / r.aplicaveis, 0)})` : ""}. ${r.exigencia}` }))
        .filter((i) => i.n > 0 || i.chave === selecionada)
        .sort((a, b) => b.n - a.n);
    if (dim === "secretaria") {
      const m = new Map<string, number>();
      for (const l of base) m.set(l.secretaria, (m.get(l.secretaria) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([nome, n], i) => ({ chave: nome, rotulo: nome, n, cor: i < PALETA.length ? PALETA[i] : CINZA }));
    }
    if (dim === "tipo") return ORDEM_TIPOS.map((t) => ({ chave: t, rotulo: TIPOS_EXECUCAO[t].nome, n: base.filter((l) => l.tipo === t).length, cor: TIPOS_EXECUCAO[t].cor }));
    return [
      { chave: "1", rotulo: "Já empenhadas ou pagas", n: base.filter((l) => l.executada).length, cor: "#B91C1C", dica: "Prioridade: a execução já começou e faltam itens a divulgar." },
      { chave: "0", rotulo: "Ainda não executadas", n: base.filter((l) => !l.executada).length, cor: "#94A3B8" },
    ];
  })();

  const total = itens.reduce((s, i) => s + i.n, 0);
  const maximo = Math.max(1, ...itens.map((i) => i.n));
  const fatias = itens.filter((i) => i.n > 0).slice(0, 8).map((i) => ({ chave: i.chave, rotulo: i.rotulo, v: i.n, cor: i.cor, clicavel: true }));
  const resto = itens.filter((i) => i.n > 0).slice(8).reduce((s, i) => s + i.n, 0);
  if (resto > 0) fatias.push({ chave: "__demais", rotulo: "Demais", v: resto, cor: CINZA, clicavel: false });
  const escolher = (chave: string) => definir({ [def.param]: chave });

  return (
    <section aria-label={`Gráfico por ${def.rotulo.toLowerCase()}`} style={{ flex: `${Math.max(5, itens.length) + 2} 1 0%` }} className={cn("emd-grafico flex min-h-[13rem] flex-col", className)}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 pb-1.5 pt-2.5">
        <label className="relative">
          <span className="sr-only">Dimensão do gráfico</span>
          <select value={dim} onChange={(e) => setDim(e.target.value as Dim)} className="h-9 cursor-pointer appearance-none rounded-[0.75rem] border border-slate-300 bg-white py-0 pl-3 pr-8 text-sm font-semibold text-cataguases-marinho outline-none transition-shadow focus:border-[color:var(--modulo)] focus:ring-2 focus:ring-[color:var(--modulo)]/25">
            {DIMENSOES.map((d) => (
              <option key={d.chave} value={d.chave}>{d.rotulo}</option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.625rem] text-slate-500">▾</span>
        </label>
        {selecionada && (
          <button type="button" onClick={() => escolher("")} title="Tirar o filtro deste gráfico" className="inline-flex h-7 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--modulo)_14%,transparent)] pl-2.5 pr-1.5 text-xs font-semibold text-[color:var(--modulo-tinta)] hover:bg-[color-mix(in_srgb,var(--modulo)_22%,transparent)]">
            filtrando
            <X className="h-3 w-3" aria-hidden />
            <span className="sr-only">Tirar o filtro deste gráfico</span>
          </button>
        )}
        <span className="ml-auto text-xs text-slate-600">emendas com item faltando</span>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(9.5rem,34%)_minmax(0,1fr)]">
        <div className="flex min-h-0 items-center justify-center py-1 pl-2 pr-1">
          <Pizza fatias={fatias} destaque={sobre} selecionada={selecionada} aoEscolher={escolher} dinheiro={false} className="aspect-square h-full max-h-[14.5rem] min-h-[9rem] w-auto max-w-full" rotuloTotal={dim === "item" ? "itens faltando" : "emendas"} />
        </div>
        <ul id={id} className="emd-foco flex min-h-0 flex-col overflow-y-auto overscroll-contain py-0.5 pr-1 [&>li:first-child]:mt-auto [&>li:last-child]:mb-auto" aria-label={`Por ${def.rotulo.toLowerCase()}`}>
          {itens.length === 0 && <li className="p-6 text-center text-sm text-slate-600">Nada a mostrar com esses filtros.</li>}
          {itens.map((i) => {
            const ativo = selecionada === i.chave;
            return (
              <CaixaInfo
                key={i.chave}
                as="li"
                style={{ flex: "1 0 2.25rem", maxHeight: "2.75rem" }}
                className="flex"
                conteudo={
                  <>
                    <CaixaTitulo rotulo={def.rotulo} valor={i.rotulo} lado={String(i.n)} ladoApoio={total ? `${pct(i.n / total, 0)} do gráfico` : undefined} />
                    {i.dica && <CaixaNota>{i.dica}</CaixaNota>}
                    <CaixaNota>Emendas com algum item faltando neste recorte. Clique para filtrar a lista.</CaixaNota>
                  </>
                }
              >
                <button
                  type="button"
                  aria-pressed={ativo}
                  aria-label={`${i.rotulo}: ${i.n}`}
                  onClick={() => escolher(ativo ? "" : i.chave)}
                  onMouseEnter={() => setSobre(i.chave)}
                  onMouseLeave={() => setSobre(null)}
                  onFocus={() => setSobre(i.chave)}
                  onBlur={() => setSobre(null)}
                  className={cn("grid h-full min-h-9 w-full grid-cols-[0.625rem_minmax(4.5rem,1fr)_minmax(1.5rem,3.5rem)_auto_2.25rem] items-center gap-x-2 rounded-lg px-2.5 py-0.5 text-left transition-colors", ativo ? "bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)]" : "hover:bg-slate-50")}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.cor }} aria-hidden />
                  <span className="line-clamp-2 text-[0.8125rem] leading-tight text-cataguases-marinho">{i.rotulo}</span>
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <span className="emd-preenche" style={{ width: `${(i.n / maximo) * 100}%`, backgroundColor: i.cor }} />
                  </span>
                  <span className="whitespace-nowrap text-right text-[0.8125rem] font-semibold tabular-nums text-cataguases-marinho">{i.n}</span>
                  <span className="text-right text-xs tabular-nums text-slate-600">{total ? pct(i.n / total, 0) : "0%"}</span>
                </button>
              </CaixaInfo>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * Conformidade no padrão da área de trabalho: indicadores e dois gráficos de filtro à esquerda (item exigido, secretaria, tipo ou
 * execução), a lista de emendas com itens a completar ao lado e, ao escolher uma emenda, os detalhes à direita na aba Parceria
 * (onde se preenche a publicidade do art. 7º).
 */
export function ListaConformidade({ ano, resumo, linhas, relatoriosPendentes, contasIrregulares }: { ano: number; resumo: ResumoItem[]; linhas: LinhaConformidade[]; relatoriosPendentes: number; contasIrregulares: number }) {
  const { params, definir: definirUrl } = useFiltrosUrl("emendas-conformidade", String(ano));
  const [limite, setLimite] = React.useState(POR_PAGINA);
  const [expandidaId, setExpandidaId] = React.useState("");
  const listaRef = React.useRef<HTMLUListElement>(null);
  // Identidade estável enquanto os filtros não mudam: escolher uma emenda (`e`) não refaz gráficos nem a lista.
  const fTexto = JSON.stringify({ i: params.get("i") ?? "", s: params.get("s") ?? "", t: params.get("t") ?? "", x: params.get("x") ?? "", q: params.get("q") ?? "" });
  const f = JSON.parse(fTexto) as Filtros;
  const escolhidaId = params.get("e") ?? "";
  const aberto = !!escolhidaId;
  const expandido = aberto && expandidaId === escolhidaId;
  const definir = (m: Record<string, string>) => {
    setLimite(POR_PAGINA);
    definirUrl(m);
  };

  const completas = linhas.filter((l) => l.faltas.length === 0).length;
  const execIncompletas = linhas.filter((l) => l.executada && l.faltas.length > 0).length;
  const filtradas = filtrar(linhas, f);
  const nomeItem = (c: string) => resumo.find((r) => r.codigo === c)?.nome ?? c;
  const chips = [
    f.i && { chave: "i", rotulo: `${rotuloCodigo(f.i)} · ${nomeItem(f.i)}` },
    f.s && { chave: "s", rotulo: `Secretaria: ${f.s}` },
    f.t && { chave: "t", rotulo: `Tipo: ${TIPOS_EXECUCAO[f.t as TipoExecucao]?.nome ?? f.t}` },
    f.x && { chave: "x", rotulo: f.x === "1" ? "Já executadas" : "Ainda não executadas" },
  ].filter(Boolean) as { chave: string; rotulo: string }[];
  const kpis: [string, string, string, string][] = [
    ["Emendas completas", `${completas} de ${linhas.length}`, completas === linhas.length ? "#166534" : "#0C1D33", "todas as informações exigidas"],
    ["Executadas incompletas", String(execIncompletas), execIncompletas ? "#B91C1C" : "#166534", "já empenhadas ou pagas: prioridade"],
    ["Relatórios de gestão", String(relatoriosPendentes), relatoriosPendentes ? "#B45309" : "#166534", "pendentes após o pagamento"],
    ["Contas irregulares", String(contasIrregulares), contasIrregulares ? "#B45309" : "#166534", "art. 6º: repetida ou fora de banco oficial"],
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-cataguases-marinho">Conformidade · IN TCE-MG 05/2025 · {ano}</h1>
        <details className="group min-w-0 flex-1 basis-80 text-xs text-slate-600">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-0.5">
            <BaseLegalLinha chave="publicidade" />
            <span className="font-medium text-[color:var(--modulo-tinta)] underline-offset-2 group-open:underline">Como usar</span>
          </summary>
          <div className="mt-1 max-w-3xl rounded-[0.75rem] border border-slate-200 bg-slate-50 px-3 py-2 text-[0.8125rem] leading-relaxed text-slate-700">
            Mostra o que o art. 7º manda divulgar <strong>antes da execução</strong> (e o identificador contábil do art. 5º). O sistema <strong>alerta</strong>; não impede o empenho. Os gráficos contam as emendas que ainda não têm cada informação: clique numa fatia ou linha para filtrar, escolha uma emenda na lista e preencha o que falta na aba “Parceria” (também listado em “Documentos”).
          </div>
        </details>
      </div>

      <EspacoTrabalho
        aberto={aberto}
        expandido={expandido}
        aoFechar={() => definirUrl({ e: "" })}
        aoRecolher={() => setExpandidaId("")}
        filtrosAtivos={chips.length}
        aoLimpar={() => definir({ i: "", s: "", t: "", x: "", q: "" })}
        rotuloLista="Emendas com itens a completar"
        rotuloDetalhe="Emenda escolhida"
        graficos={
          <>
            <dl className="grid flex-none grid-cols-2 divide-slate-200 border-b border-slate-200 lg:grid-cols-4 lg:divide-x">
              {kpis.map(([k, v, cor, apoio]) => (
                <CaixaInfo
                  key={k}
                  as="div"
                  className="min-w-0 px-3 py-2.5"
                  conteudo={
                    <>
                      <CaixaTitulo rotulo={k} valor={v} />
                      {(k === "Emendas completas" || k === "Executadas incompletas") && <CaixaLinhas linhas={[{ rotulo: "Emendas no exercício", valor: String(linhas.length) }, { rotulo: "Com item faltando", valor: String(linhas.length - completas), forte: true }, { rotulo: "Já executadas e incompletas", valor: String(execIncompletas), cor: "#B91C1C" }]} />}
                      <CaixaNota>{apoio}.</CaixaNota>
                    </>
                  }
                >
                  <dt className="text-xs font-medium text-slate-600">{k}</dt>
                  <dd className="text-lg font-semibold leading-tight tabular-nums" style={{ color: cor }}>{v}</dd>
                  <dd className="text-[0.75rem] leading-snug text-slate-600">{apoio}</dd>
                </CaixaInfo>
              ))}
            </dl>
            <GraficoConformidade linhas={linhas} resumo={resumo} filtros={f} definir={definir} visaoInicial="item" className="border-b border-slate-200" />
            <GraficoConformidade linhas={linhas} resumo={resumo} filtros={f} definir={definir} visaoInicial="secretaria" />
          </>
        }
        lista={
          <>
            <div className="space-y-2.5 border-b border-slate-200 px-4 pb-3 pt-3.5 print:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-[11rem] flex-1">
                  <span className="sr-only">Buscar emendas</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                  <input type="search" value={f.q} placeholder="Buscar nº, objeto ou secretaria" className={`${CAMPO} w-full pl-9`} onChange={(e) => definirUrl({ q: e.target.value }, true)} />
                </label>
                <MenuExportar opcoes={[{ rotulo: "Imprimir / salvar como PDF", detalhe: "Usa a impressão do navegador", imprimir: true }]} />
              </div>
              <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1.5" role="group" aria-label="Filtros ativos">
                <span className="text-[0.8125rem] tabular-nums text-slate-600" aria-live="polite">
                  <strong className="font-semibold text-cataguases-marinho">{filtradas.length}</strong> emendas com itens a completar
                </span>
                {chips.map((c) => (
                  <button key={c.chave} type="button" onClick={() => definir({ [c.chave]: "" })} title="Tirar este filtro" className="emd-chip inline-flex min-h-7 items-center gap-1 rounded-full border border-[color:var(--modulo-tinta)]/30 bg-[color-mix(in_srgb,var(--modulo)_10%,transparent)] py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-[color:var(--modulo-tinta)] hover:bg-[color-mix(in_srgb,var(--modulo)_18%,transparent)]">
                    {c.rotulo}
                    <X className="h-3 w-3" aria-hidden />
                    <span className="sr-only">Tirar este filtro</span>
                  </button>
                ))}
                {chips.length > 0 && (
                  <button type="button" onClick={() => definir({ i: "", s: "", t: "", x: "", q: "" })} className="rounded-lg px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-cataguases-marinho">
                    Limpar tudo
                  </button>
                )}
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col">
            <ul ref={listaRef} className="emd-lista min-h-0 flex-1 overflow-y-auto overscroll-contain print:hidden" aria-label="Emendas com itens a completar">
              {filtradas.slice(0, limite).map((l) => {
                const sel = l.id === escolhidaId;
                const cor = l.executada ? "#B91C1C" : "#94A3B8";
                return (
                  <li key={l.id} className="border-b border-slate-100">
                    <button type="button" aria-pressed={sel} onClick={() => definirUrl({ e: sel ? "" : l.id })} className={cn("emd-item relative block w-full py-3 pl-5 pr-4 text-left outline-none", sel && "emd-item-sel")} style={{ ["--tipo" as string]: cor }}>
                      <span aria-hidden className="emd-item-faixa absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ backgroundColor: cor }} />
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className="font-mono text-xs text-slate-600">nº {l.numero}</span>
                        <strong className="min-w-0 flex-1 text-[0.875rem] text-cataguases-marinho">{l.objeto}</strong>
                        {l.executada && <span className="text-xs font-medium text-red-700">já executada</span>}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                        <TipoSelo tipo={l.tipo} />
                        <span>{l.secretaria}</span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-slate-600">Falta preencher:</span>
                        {l.faltas.map((c) => (
                          <span key={c} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700" title={rotuloCodigo(c)}>{nomeItem(c)}</span>
                        ))}
                      </span>
                    </button>
                  </li>
                );
              })}
              {filtradas.length === 0 && <li className="p-8 text-center text-sm text-slate-600">Nenhuma emenda com itens faltando nesse filtro.</li>}
              {filtradas.length > limite && (
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
        detalhe={aberto && <PainelDetalheEmenda emendaId={escolhidaId} abaInicial="parceria" aoFechar={() => definirUrl({ e: "" })} expandido={expandido} aoExpandir={() => setExpandidaId(expandido ? "" : escolhidaId)} />}
      />
    </div>
  );
}
