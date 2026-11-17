"use client";

import * as React from "react";
import Link from "next/link";

import { ORDEM_TIPOS, TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { NOME_GRAVIDADE, type Gravidade } from "@/lib/emendas/pendencias";
import {
  agruparPendencias,
  descreverFiltros,
  documentosFaltando,
  filtrarPendencias,
  indicadores,
  nomeDaRegra,
  porArea,
  porAssunto,
  porSecretaria,
  type ChaveFiltro,
  type EmendaPainel,
  type FiltrosPainel,
  type Grupo,
  type LinhaDocFaltando,
  type LinhaPendencia,
} from "@/lib/emendas/painel-pendencias";
import { brlCurto, pct } from "@/lib/emendas/regras";

const COR: Record<Gravidade, string> = { alta: "#B91C1C", media: "#B45309", baixa: "#64748B" };
/** Cores das fatias quando a dimensão não tem cor própria (área, assunto, secretaria, documento). */
const PALETA = ["#6B4FBB", "#0E7490", "#C2410C", "#5C7A1F", "#BE185D", "#1D4ED8", "#A16207", "#0F766E"];
const CINZA = "#94A3B8";
const ZERO = { alta: 0, media: 0, baixa: 0, total: 0, emendas: 0, valor: 0 };

type Visao = "area" | "gravidade" | "assunto" | "secretaria" | "tipo" | "documentos";
const VISOES: { chave: Visao; rotulo: string; param?: ChaveFiltro }[] = [
  { chave: "area", rotulo: "Área", param: "a" },
  { chave: "gravidade", rotulo: "Gravidade", param: "g" },
  { chave: "assunto", rotulo: "Assunto", param: "r" },
  { chave: "secretaria", rotulo: "Secretaria", param: "s" },
  { chave: "tipo", rotulo: "Tipo", param: "t" },
  { chave: "documentos", rotulo: "Documentos" },
];

type Item = {
  chave: string;
  rotulo: string;
  n: number;
  valor: number;
  cor: string;
  alta: number;
  media: number;
  baixa: number;
  /** Só documentos: números das emendas que ainda não têm o documento. */
  emendas?: { emendaId: string; numero: number; secretaria: string }[];
};

const doGrupo = (g: Grupo, cor: string): Item => ({ chave: g.chave, rotulo: g.rotulo, n: g.total, valor: g.valor, cor, alta: g.alta, media: g.media, baixa: g.baixa });

/** Pizza (anel) em SVG puro: cada fatia é um botão que filtra a lista; no centro, o total ou a fatia sob o cursor. */
function Pizza({
  fatias,
  selecionada,
  aoEscolher,
  dinheiro,
  rotuloTotal,
}: {
  fatias: { chave: string; rotulo: string; v: number; cor: string; clicavel: boolean }[];
  selecionada: string;
  aoEscolher: (chave: string) => void;
  dinheiro: boolean;
  rotuloTotal: string;
}) {
  const [sobre, setSobre] = React.useState<string | null>(null);
  const R = 38;
  const C = 2 * Math.PI * R;
  const total = fatias.reduce((s, f) => s + f.v, 0);
  const fmt = (v: number) => (dinheiro ? brlCurto(v) : String(v));
  let acumulado = 0;
  const arcos = fatias
    .filter((f) => f.v > 0)
    .map((f) => {
      const comprimento = (f.v / total) * C;
      const arco = { ...f, comprimento, inicio: acumulado };
      acumulado += comprimento;
      return arco;
    })
    // a fatia escolhida é desenhada por último: o traço mais grosso cobre os vizinhos, não o contrário
    .sort((a, b) => Number(a.chave === selecionada) - Number(b.chave === selecionada));
  const foco = fatias.find((f) => f.chave === (sobre ?? selecionada));
  const corta = (t: string) => (t.length > 17 ? `${t.slice(0, 16)}…` : t);

  return (
    <svg viewBox="0 0 100 100" className="h-[196px] w-[196px] shrink-0 text-cataguases-marinho" role="group" aria-label="Gráfico de pizza">
      {total === 0 ? (
        <circle cx="50" cy="50" r={R} fill="none" stroke={CINZA} strokeOpacity="0.35" strokeWidth="15" />
      ) : (
        arcos.map((a) => {
          const ativa = a.chave === selecionada;
          const apagada = (selecionada || sobre) && !ativa && a.chave !== sobre;
          return (
            <circle
              key={a.chave}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={a.cor}
              strokeWidth={ativa || a.chave === sobre ? 19 : 15}
              strokeDasharray={`${a.comprimento} ${C - a.comprimento}`}
              strokeDashoffset={-a.inicio}
              transform="rotate(-90 50 50)"
              opacity={apagada ? 0.4 : 1}
              className={`outline-none transition-[stroke-width,opacity] duration-150 motion-reduce:transition-none ${a.clicavel ? "cursor-pointer" : ""}`}
              role={a.clicavel ? "button" : undefined}
              tabIndex={a.clicavel ? 0 : undefined}
              aria-pressed={a.clicavel ? ativa : undefined}
              aria-label={`${a.rotulo}: ${fmt(a.v)} (${pct(a.v / total, 0)})`}
              onMouseEnter={() => setSobre(a.chave)}
              onMouseLeave={() => setSobre(null)}
              onFocus={() => setSobre(a.chave)}
              onBlur={() => setSobre(null)}
              onClick={() => a.clicavel && aoEscolher(ativa ? "" : a.chave)}
              onKeyDown={(e) => {
                if (a.clicavel && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  aoEscolher(ativa ? "" : a.chave);
                }
              }}
            />
          );
        })
      )}
      <g textAnchor="middle" className="pointer-events-none fill-current">
        <text x="50" y={dinheiro ? 51 : 52} fontSize={dinheiro ? 8.2 : 17} fontWeight="600" className="tabular-nums">
          {foco ? fmt(foco.v) : fmt(total)}
        </text>
        <text x="50" y="61" fontSize="4.6" opacity="0.7">
          {foco ? corta(foco.rotulo) : rotuloTotal}
        </text>
        {foco && total > 0 && (
          <text x="50" y="68" fontSize="4.6" opacity="0.7" className="tabular-nums">
            {pct(foco.v / total, 0)}
          </text>
        )}
      </g>
    </svg>
  );
}

/**
 * Painel de Pendências numa caixa só: filtros, indicadores, abas por dimensão e, abaixo delas, a pizza ao lado do
 * ranking. Tudo responde aos mesmos filtros da lista, e escolher uma fatia/linha filtra a lista. Cada visão ignora o
 * próprio filtro para sempre mostrar todas as opções.
 */
export function PainelPendencias({
  linhas,
  docs,
  emendas,
  secretarias,
  filtros,
  definir,
  ano,
  controles,
}: {
  linhas: LinhaPendencia[];
  docs: LinhaDocFaltando[];
  emendas: EmendaPainel[];
  secretarias: { id: string; nome: string }[];
  filtros: FiltrosPainel;
  definir: (m: Record<string, string>) => void;
  ano: number;
  /** Linha de filtros (selects, busca, exportar), desenhada pela lista para dividir o mesmo estado. */
  controles: React.ReactNode;
}) {
  const f = filtros;
  const [visao, setVisao] = React.useState<Visao>("area");
  const [medida, setMedida] = React.useState<"n" | "valor">("n");
  const [abertos, setAbertos] = React.useState<Set<string>>(new Set());

  const sem = (...c: ChaveFiltro[]) => filtrarPendencias(linhas, f, c);
  const filtradas = filtrarPendencias(linhas, f);
  const ind = indicadores(filtradas, linhas, emendas, f);
  const faltando = documentosFaltando(docs, f);
  const totalDocs = faltando.reduce((s, g) => s + g.emendas.length, 0);
  const emendasSemDoc = new Set(faltando.flatMap((g) => g.emendas.map((e) => e.emendaId))).size;

  const itens: Item[] = React.useMemo(() => {
    switch (visao) {
      case "gravidade":
        return (["alta", "media", "baixa"] as const).map((g) => {
          const achado = agruparPendencias(sem("g"), (l) => ({ chave: l.gravidade, rotulo: NOME_GRAVIDADE[l.gravidade] })).find((x) => x.chave === g);
          return doGrupo({ ...ZERO, ...(achado ?? {}), chave: g, rotulo: NOME_GRAVIDADE[g] }, COR[g]);
        });
      case "tipo":
        return ORDEM_TIPOS.map((t) => {
          const achado = agruparPendencias(sem("t"), (l) => ({ chave: l.tipo, rotulo: l.tipo })).find((x) => x.chave === t);
          return doGrupo({ ...ZERO, ...(achado ?? {}), chave: t, rotulo: TIPOS_EXECUCAO[t].nome }, TIPOS_EXECUCAO[t].cor);
        });
      case "area":
        return porArea(sem("a", "r")).map((g, i) => doGrupo(g, PALETA[i % PALETA.length]));
      case "assunto":
        return porAssunto(sem("r")).map((g, i) => doGrupo(g, i < PALETA.length ? PALETA[i] : CINZA));
      case "secretaria":
        return porSecretaria(sem("s")).map((g, i) => doGrupo(g, i < PALETA.length ? PALETA[i] : CINZA));
      case "documentos":
        return faltando.map((g, i) => ({
          chave: g.doc,
          rotulo: g.rotulo,
          n: g.emendas.length,
          valor: g.valor,
          cor: PALETA[i % PALETA.length],
          alta: 0,
          media: 0,
          baixa: 0,
          emendas: g.emendas,
        }));
    }
    // `sem` e `faltando` derivam de linhas/docs/filtros, que já estão nas dependências
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao, linhas, docs, f.t, f.g, f.s, f.r, f.a, f.j, f.q]);

  const def = VISOES.find((v) => v.chave === visao)!;
  const param = def.param;
  const selecionada = param ? f[param] : "";
  const valorDe = (i: Item) => (medida === "n" ? i.n : i.valor);
  const total = itens.reduce((s, i) => s + valorDe(i), 0);
  const maximo = Math.max(1, ...itens.map(valorDe));
  const escolher = (chave: string) => {
    if (!param) return;
    definir({ [param]: chave, ...(param === "a" ? { r: "" } : {}) });
  };

  // Pizza: as 8 maiores fatias e um "demais" agregado (não clicável) para não virar confete.
  const ordenadas = [...itens].filter((i) => valorDe(i) > 0);
  const fatias = ordenadas.slice(0, 8).map((i) => ({ chave: i.chave, rotulo: i.rotulo, v: valorDe(i), cor: i.cor, clicavel: !!param }));
  const resto = ordenadas.slice(8).reduce((s, i) => s + valorDe(i), 0);
  if (resto > 0) fatias.push({ chave: "__demais", rotulo: "Demais", v: resto, cor: CINZA, clicavel: false });
  if (selecionada && !fatias.some((x) => x.chave === selecionada)) {
    // a opção escolhida mora entre os "demais": mostra ela também, para a pizza não esconder o filtro ativo
    const i = itens.find((x) => x.chave === selecionada);
    if (i && valorDe(i) > 0) fatias.splice(fatias.length - 1, 0, { chave: i.chave, rotulo: i.rotulo, v: valorDe(i), cor: i.cor, clicavel: true });
  }

  const alta = ind.altas;
  const media = filtradas.filter((l) => l.gravidade === "media").length;
  const baixa = filtradas.length - alta - media;
  const descricao = descreverFiltros(f, {
    tipo: f.t ? TIPOS_EXECUCAO[f.t as keyof typeof TIPOS_EXECUCAO]?.nome : undefined,
    gravidade: f.g ? NOME_GRAVIDADE[f.g as Gravidade] : undefined,
    secretaria: secretarias.find((s) => s.id === f.s)?.nome,
    assunto: f.r ? nomeDaRegra(linhas.find((l) => l.regra.split(":")[0] === f.r) ?? { regra: f.r, titulo: f.r }) : undefined,
  });

  const celula = "min-w-0 px-5 py-3.5";
  return (
    <section aria-label="Visão geral das pendências" className="rounded-xl border border-slate-200 bg-white">
      {/* proporção de gravidade da seleção atual, como um fio no topo da caixa */}
      <div className="flex h-1 overflow-hidden rounded-t-xl bg-slate-100" aria-hidden>
        <span style={{ width: `${filtradas.length ? (alta / filtradas.length) * 100 : 0}%`, backgroundColor: COR.alta }} />
        <span style={{ width: `${filtradas.length ? (media / filtradas.length) * 100 : 0}%`, backgroundColor: COR.media }} />
        <span style={{ width: `${filtradas.length ? (baixa / filtradas.length) * 100 : 0}%`, backgroundColor: COR.baixa }} />
      </div>

      <div className="border-b border-slate-200 px-3 py-2.5 print:hidden">{controles}</div>
      <p className="hidden border-b border-slate-200 px-4 py-2 text-xs text-slate-600 print:block">
        Exercício {ano} · Filtros: {descricao} · Gerado em {new Date().toLocaleDateString("pt-BR")}
      </p>

      <dl className="grid grid-cols-2 divide-slate-200 border-b border-slate-200 max-lg:[&>div:nth-child(n+3)]:border-t max-lg:[&>div:nth-child(even)]:border-l max-lg:[&>div]:border-slate-200 lg:grid-cols-4 lg:divide-x">
        <div className={celula}>
          <dt className="text-xs font-medium text-slate-600">Pendências abertas</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className="whitespace-nowrap text-xl font-semibold leading-tight tabular-nums text-cataguases-marinho sm:text-2xl">{ind.pendencias}</span>
            <span className="text-xs tabular-nums" style={{ color: alta > 0 ? COR.alta : undefined }}>
              {alta} {alta === 1 ? "alta" : "altas"}
            </span>
          </dd>
        </div>
        <div className={celula}>
          <dt className="text-xs font-medium text-slate-600">Emendas afetadas</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className="whitespace-nowrap text-xl font-semibold leading-tight tabular-nums text-cataguases-marinho sm:text-2xl">{ind.emendasAfetadas}</span>
            <span className="text-xs tabular-nums text-slate-600">
              de {ind.emendasNoRecorte} ({ind.emendasNoRecorte ? pct(ind.emendasAfetadas / ind.emendasNoRecorte, 0) : "0%"})
            </span>
          </dd>
        </div>
        <div className={celula}>
          <dt className="text-xs font-medium text-slate-600">Valor das emendas afetadas</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className="whitespace-nowrap text-xl font-semibold leading-tight tabular-nums text-cataguases-marinho sm:text-2xl">{brlCurto(ind.valorAfetado)}</span>
            <span className="text-xs tabular-nums text-slate-600">de {brlCurto(ind.valorNoRecorte)}</span>
          </dd>
        </div>
        <div className={celula}>
          <dt className="text-xs font-medium text-slate-600">Documentos faltando</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className="whitespace-nowrap text-xl font-semibold leading-tight tabular-nums text-cataguases-marinho sm:text-2xl">{totalDocs}</span>
            <span className="text-xs tabular-nums text-slate-600">em {emendasSemDoc} emendas</span>
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-slate-200 px-2 print:border-0">
        <div
          role="tablist"
          aria-label="Dimensão do gráfico"
          className="flex flex-wrap"
          onKeyDown={(e) => {
            const i = VISOES.findIndex((v) => v.chave === visao);
            const novo = e.key === "ArrowRight" ? (i + 1) % VISOES.length : e.key === "ArrowLeft" ? (i - 1 + VISOES.length) % VISOES.length : e.key === "Home" ? 0 : e.key === "End" ? VISOES.length - 1 : -1;
            if (novo < 0) return;
            e.preventDefault();
            setVisao(VISOES[novo].chave);
            document.getElementById(`aba-pend-${VISOES[novo].chave}`)?.focus();
          }}
        >
          {VISOES.map((v) => {
            const ativa = v.chave === visao;
            const filtrada = v.param && f[v.param];
            return (
              <button
                key={v.chave}
                type="button"
                role="tab"
                id={`aba-pend-${v.chave}`}
                aria-selected={ativa}
                aria-controls="painel-pend-corpo"
                tabIndex={ativa ? 0 : -1}
                onClick={() => setVisao(v.chave)}
                className={`relative inline-flex min-h-11 items-center gap-1.5 px-2.5 text-[13px] font-medium transition-colors motion-reduce:transition-none sm:min-h-10 sm:px-3 ${
                  ativa ? "text-cataguases-marinho" : "text-slate-600 hover:text-cataguases-marinho"
                } ${ativa ? "print:block" : "print:hidden"}`}
              >
                {v.rotulo}
                {filtrada && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--modulo)" }} title="Filtro ativo" />}
                {ativa && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ backgroundColor: "var(--modulo)" }} aria-hidden />}
              </button>
            );
          })}
        </div>
        <div role="group" aria-label="Medida" className="my-1 inline-flex rounded-lg bg-slate-100 p-0.5 text-xs print:hidden">
          {([["n", visao === "documentos" ? "Emendas" : "Pendências"], ["valor", "R$"]] as const).map(([m, rotulo]) => (
            <button
              key={m}
              type="button"
              aria-pressed={medida === m}
              onClick={() => setMedida(m)}
              className={`min-h-11 rounded-md px-3 font-medium sm:min-h-8 sm:px-2.5 transition-colors motion-reduce:transition-none ${medida === m ? "bg-white text-cataguases-marinho shadow-sm" : "text-slate-600"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div id="painel-pend-corpo" role="tabpanel" aria-labelledby={`aba-pend-${visao}`} className="grid lg:grid-cols-[280px_1fr]">
        <div className="flex items-center justify-center p-5 max-lg:border-b max-lg:border-slate-200 lg:border-r lg:border-slate-200">
          <Pizza fatias={fatias} selecionada={selecionada} aoEscolher={escolher} dinheiro={medida === "valor"} rotuloTotal={medida === "valor" ? "em emendas" : visao === "documentos" ? "emendas" : "pendências"} />
        </div>

        <ul className="max-h-60 overflow-y-auto overscroll-contain py-2 lg:max-h-[236px] print:max-h-none" aria-label={`Por ${def.rotulo.toLowerCase()}`}>
          {itens.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Nada a mostrar com esses filtros.</li>}
          {itens.map((i) => {
            const v = valorDe(i);
            const ativo = selecionada === i.chave;
            const aberto = abertos.has(i.chave);
            const clicavel = !!param || !!i.emendas;
            const detalhe = `${i.n} ${visao === "documentos" ? "emendas" : "pendências"}${param ? ` (${i.alta} altas, ${i.media} médias, ${i.baixa} baixas)` : ""}, ${brlCurto(i.valor)}`;
            return (
              <li key={i.chave}>
                <button
                  type="button"
                  disabled={!clicavel}
                  aria-pressed={param ? ativo : undefined}
                  aria-expanded={i.emendas ? aberto : undefined}
                  aria-label={`${i.rotulo}: ${detalhe}`}
                  title={detalhe}
                  onClick={() => {
                    if (param) escolher(ativo ? "" : i.chave);
                    else if (i.emendas)
                      setAbertos((a) => {
                        const n = new Set(a);
                        if (n.has(i.chave)) n.delete(i.chave);
                        else n.add(i.chave);
                        return n;
                      });
                  }}
                  className={`grid min-h-11 w-full grid-cols-[10px_minmax(0,1fr)_auto_36px] sm:grid-cols-[10px_minmax(0,11rem)_minmax(0,1fr)_auto_40px] items-center gap-x-3 px-6 py-1 text-left transition-colors motion-reduce:transition-none sm:min-h-9 ${
                    ativo ? "bg-violet-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.cor }} aria-hidden />
                  <span className="truncate text-[13px] text-cataguases-marinho">{i.rotulo}</span>
                  <span className="hidden h-2 overflow-hidden rounded-full bg-slate-100 sm:flex" aria-hidden>
                    {param && medida === "n" ? (
                      (["alta", "media", "baixa"] as const).map((g) => <span key={g} style={{ width: `${(i[g] / maximo) * 100}%`, backgroundColor: COR[g] }} />)
                    ) : (
                      <span style={{ width: `${(v / maximo) * 100}%`, backgroundColor: i.cor }} />
                    )}
                  </span>
                  <span className="whitespace-nowrap text-right text-[13px] font-semibold tabular-nums text-cataguases-marinho">{medida === "valor" ? brlCurto(v) : v}</span>
                  <span className="text-right text-xs tabular-nums text-slate-600">{total ? pct(v / total, 0) : "0%"}</span>
                </button>
                {i.emendas && aberto && (
                  <p className="flex flex-wrap gap-1.5 px-6 pb-2 pl-[46px] print:hidden">
                    {i.emendas.map((e) => (
                      <Link
                        key={e.emendaId}
                        href={`/emendas/${e.emendaId}?aba=documentacao`}
                        title={e.secretaria}
                        className="inline-flex h-7 items-center rounded-full border border-slate-300 bg-white px-2.5 font-mono text-xs text-cataguases-marinho hover:bg-slate-50"
                      >
                        {e.numero}
                      </Link>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
          {visao === "documentos" && itens.length > 0 && (
            <li className="px-6 pb-1 pt-2 text-xs text-slate-600 print:hidden">Exigidos por lei e ainda não ligados no Drive (repasses). Clique para ver quais emendas.</li>
          )}
        </ul>
      </div>
    </section>
  );
}
