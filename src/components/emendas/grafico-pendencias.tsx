"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { CaixaInfo, CaixaLinhas, CaixaNota, CaixaTitulo } from "@/components/emendas/caixa-info";
import { CINZA, PALETA, Pizza } from "@/components/emendas/pizza";
import { ORDEM_TIPOS, TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { NOME_GRAVIDADE, type Gravidade } from "@/lib/emendas/pendencias";
import {
  agruparPendencias,
  documentosFaltando,
  filtrarPendencias,
  indicadores,
  porArea,
  porAssunto,
  porMotivo,
  porSecretaria,
  type ChaveFiltro,
  type EmendaPainel,
  type FiltrosPainel,
  type Grupo,
  type LinhaDocFaltando,
  type LinhaPendencia,
} from "@/lib/emendas/painel-pendencias";
import { brl, brlCurto, pct } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";

const COR: Record<Gravidade, string> = { alta: "#B91C1C", media: "#B45309", baixa: "#64748B" };
const ZERO = { alta: 0, media: 0, baixa: 0, total: 0, emendas: 0, valor: 0 };

export type VisaoPend = "area" | "gravidade" | "assunto" | "motivo" | "secretaria" | "tipo" | "documentos";
const VISOES: { chave: VisaoPend; rotulo: string; param?: ChaveFiltro }[] = [
  { chave: "area", rotulo: "Área", param: "a" },
  { chave: "gravidade", rotulo: "Gravidade", param: "g" },
  { chave: "assunto", rotulo: "Assunto", param: "r" },
  { chave: "motivo", rotulo: "Motivo", param: "m" },
  { chave: "secretaria", rotulo: "Secretaria", param: "s" },
  { chave: "tipo", rotulo: "Tipo", param: "t" },
  { chave: "documentos", rotulo: "Documentos faltando" },
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
  /** Só documentos: emendas que ainda não têm o documento. */
  emendas?: { emendaId: string; numero: number; secretaria: string }[];
};

const doGrupo = (g: Grupo, cor: string): Item => ({ chave: g.chave, rotulo: g.rotulo, n: g.total, valor: g.valor, cor, alta: g.alta, media: g.media, baixa: g.baixa });

type Base = { linhas: LinhaPendencia[]; docs: LinhaDocFaltando[]; filtros: FiltrosPainel; definir: (m: Record<string, string>) => void };

/** Faixa de indicadores das pendências (as quatro contas do recorte atual). */
export function FaixaPendencias({ linhas, docs, emendas, filtros: f }: { linhas: LinhaPendencia[]; docs: LinhaDocFaltando[]; emendas: EmendaPainel[]; filtros: FiltrosPainel }) {
  const filtradas = filtrarPendencias(linhas, f);
  const ind = indicadores(filtradas, linhas, emendas, f);
  const faltando = documentosFaltando(docs, f);
  const totalDocs = faltando.reduce((s, g) => s + g.emendas.length, 0);
  const emendasSemDoc = new Set(faltando.flatMap((g) => g.emendas.map((e) => e.emendaId))).size;
  const alta = ind.altas;
  const media = filtradas.filter((l) => l.gravidade === "media").length;
  const baixa = filtradas.length - alta - media;
  const celula = "min-w-0 px-4 py-3";
  const numero = "whitespace-nowrap text-xl font-semibold leading-tight tabular-nums text-cataguases-marinho";
  return (
    <>
      {/* proporção de gravidade da seleção atual, como um fio no topo da caixa */}
      <div className="flex h-1 flex-none overflow-hidden bg-slate-100" aria-hidden>
        <span className="emd-preenche" style={{ width: `${filtradas.length ? (alta / filtradas.length) * 100 : 0}%`, backgroundColor: COR.alta }} />
        <span className="emd-preenche" style={{ width: `${filtradas.length ? (media / filtradas.length) * 100 : 0}%`, backgroundColor: COR.media }} />
        <span className="emd-preenche" style={{ width: `${filtradas.length ? (baixa / filtradas.length) * 100 : 0}%`, backgroundColor: COR.baixa }} />
      </div>
      <dl className="grid flex-none grid-cols-2 divide-slate-200 border-b border-slate-200 max-lg:[&>div:nth-child(n+3)]:border-t max-lg:[&>div:nth-child(even)]:border-l max-lg:[&>div]:border-slate-200 lg:grid-cols-4 lg:divide-x">
        <CaixaInfo
          as="div"
          className={celula}
          conteudo={
            <>
              <CaixaTitulo rotulo="Pendências abertas" valor={String(ind.pendencias)} />
              <CaixaLinhas linhas={[{ rotulo: "Alta", valor: String(alta), cor: COR.alta }, { rotulo: "Média", valor: String(media), cor: COR.media }, { rotulo: "Baixa", valor: String(baixa), cor: COR.baixa }]} />
              <CaixaNota>Pendências justificadas ficam fora da contagem até os dados mudarem.</CaixaNota>
            </>
          }
        >
          <dt className="text-xs font-medium text-slate-600">Pendências abertas</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className={numero}>{ind.pendencias}</span>
            <span className="text-xs tabular-nums" style={{ color: alta > 0 ? COR.alta : undefined }}>{alta} {alta === 1 ? "alta" : "altas"}</span>
          </dd>
        </CaixaInfo>
        <CaixaInfo
          as="div"
          className={celula}
          conteudo={
            <>
              <CaixaTitulo rotulo="Emendas afetadas" valor={`${ind.emendasAfetadas} de ${ind.emendasNoRecorte}`} lado={ind.emendasNoRecorte ? pct(ind.emendasAfetadas / ind.emendasNoRecorte, 0) : "0%"} ladoApoio="do recorte" />
              <CaixaLinhas linhas={[{ rotulo: "Com pendência", valor: String(ind.emendasAfetadas), cor: COR.alta }, { rotulo: "Sem pendência", valor: String(Math.max(0, ind.emendasNoRecorte - ind.emendasAfetadas)) }]} />
              <CaixaNota>Cada emenda conta uma vez, mesmo com várias pendências.</CaixaNota>
            </>
          }
        >
          <dt className="text-xs font-medium text-slate-600">Emendas afetadas</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className={numero}>{ind.emendasAfetadas}</span>
            <span className="text-xs tabular-nums text-slate-600">de {ind.emendasNoRecorte} ({ind.emendasNoRecorte ? pct(ind.emendasAfetadas / ind.emendasNoRecorte, 0) : "0%"})</span>
          </dd>
        </CaixaInfo>
        <CaixaInfo
          as="div"
          className={celula}
          conteudo={
            <>
              <CaixaTitulo rotulo="Valor das emendas afetadas" valor={brl(ind.valorAfetado)} lado={ind.valorNoRecorte ? pct(ind.valorAfetado / ind.valorNoRecorte, 0) : "0%"} ladoApoio="do recorte" />
              <CaixaLinhas linhas={[{ rotulo: "Valor no recorte", valor: brl(ind.valorNoRecorte) }]} />
            </>
          }
        >
          <dt className="text-xs font-medium text-slate-600">Valor afetado</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className={numero}>{brlCurto(ind.valorAfetado)}</span>
            <span className="text-xs tabular-nums text-slate-600">de {brlCurto(ind.valorNoRecorte)}</span>
          </dd>
        </CaixaInfo>
        <CaixaInfo
          as="div"
          className={celula}
          conteudo={
            <>
              <CaixaTitulo rotulo="Documentos faltando" valor={String(totalDocs)} ladoApoio={`em ${emendasSemDoc} emendas`} />
              <CaixaLinhas linhas={faltando.length ? faltando.slice(0, 6).map((g) => ({ rotulo: g.rotulo, valor: String(g.emendas.length) })) : [{ rotulo: "Nenhum documento faltando", valor: "0" }]} />
              <CaixaNota>Exigidos por lei e ainda não ligados no Drive.</CaixaNota>
            </>
          }
        >
          <dt className="text-xs font-medium text-slate-600">Documentos faltando</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className={numero}>{totalDocs}</span>
            <span className="text-xs tabular-nums text-slate-600">em {emendasSemDoc} emendas</span>
          </dd>
        </CaixaInfo>
      </dl>
    </>
  );
}

/**
 * Um gráfico de pendências que também é filtro (como `GraficoFiltro`, da lista de Emendas): escolhe-se a dimensão e clicar numa
 * fatia ou linha filtra a lista. Cada gráfico ignora o próprio filtro e respeita os do outro, então os dois se combinam.
 */
export function GraficoPendencias({ linhas, docs, filtros: f, definir, visaoInicial, className }: Base & { visaoInicial: VisaoPend; className?: string }) {
  const [visao, setVisao] = React.useState<VisaoPend>(visaoInicial);
  const [medida, setMedida] = React.useState<"n" | "valor">("n");
  const [sobreChave, setSobreChave] = React.useState<string | null>(null);
  const [abertos, setAbertos] = React.useState<Set<string>>(new Set());
  const id = React.useId();

  const sem = (...c: ChaveFiltro[]) => filtrarPendencias(linhas, f, c);
  const faltando = documentosFaltando(docs, f);

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
      case "motivo":
        return porMotivo(sem("m"), !f.r).map((g, i) => doGrupo(g, i < PALETA.length ? PALETA[i] : CINZA));
      case "secretaria":
        return porSecretaria(sem("s")).map((g, i) => doGrupo(g, i < PALETA.length ? PALETA[i] : CINZA));
      case "documentos":
        return faltando.map((g, i) => ({ chave: g.doc, rotulo: g.rotulo, n: g.emendas.length, valor: g.valor, cor: PALETA[i % PALETA.length], alta: 0, media: 0, baixa: 0, emendas: g.emendas }));
    }
    // `sem` e `faltando` derivam de linhas/docs/filtros, que já estão nas dependências
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao, linhas, docs, f.t, f.g, f.s, f.r, f.a, f.m, f.j, f.q]);

  const def = VISOES.find((v) => v.chave === visao)!;
  const param = def.param;
  const selecionada = param ? f[param] : "";
  const valorDe = (i: Item) => (medida === "n" ? i.n : i.valor);
  const total = itens.reduce((s, i) => s + valorDe(i), 0);
  const maximo = Math.max(1, ...itens.map(valorDe));
  const escolher = (chave: string) => {
    if (!param) return;
    // trocar de área ou de assunto zera o que estava abaixo dele (o motivo escolhido pode nem existir no assunto novo)
    definir({ [param]: chave, ...(param === "a" ? { r: "", m: "" } : param === "r" ? { m: "" } : {}) });
  };

  // Pizza: as 8 maiores fatias e um "demais" agregado (não clicável) para não virar confete.
  const ordenadas = [...itens].filter((i) => valorDe(i) > 0);
  const fatias = ordenadas.slice(0, 8).map((i) => ({ chave: i.chave, rotulo: i.rotulo, v: valorDe(i), cor: i.cor, clicavel: !!param }));
  const resto = ordenadas.slice(8).reduce((s, i) => s + valorDe(i), 0);
  if (resto > 0) fatias.push({ chave: "__demais", rotulo: "Demais", v: resto, cor: CINZA, clicavel: false });
  if (selecionada && !fatias.some((x) => x.chave === selecionada)) {
    const i = itens.find((x) => x.chave === selecionada);
    if (i && valorDe(i) > 0) fatias.splice(fatias.length - 1, 0, { chave: i.chave, rotulo: i.rotulo, v: valorDe(i), cor: i.cor, clicavel: true });
  }
  const unidade = visao === "documentos" ? "emendas" : "pendências";

  return (
    <section aria-label={`Gráfico por ${def.rotulo.toLowerCase()}`} style={{ flex: `${Math.max(5, itens.length) + 2} 1 0%` }} className={cn("emd-grafico flex min-h-[13rem] flex-col", className)}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 pb-1.5 pt-2.5">
        <label className="relative">
          <span className="sr-only">Dimensão do gráfico</span>
          <select value={visao} onChange={(e) => setVisao(e.target.value as VisaoPend)} className="h-9 cursor-pointer appearance-none rounded-xl border border-slate-300 bg-white/80 py-0 pl-3 pr-8 text-sm font-semibold text-cataguases-marinho outline-none transition-shadow focus:border-[color:var(--modulo)] focus:ring-2 focus:ring-[color:var(--modulo)]/25">
            {VISOES.map((v) => (
              <option key={v.chave} value={v.chave}>{v.rotulo}</option>
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
        <div role="group" aria-label="Medida" className="ml-auto inline-flex rounded-lg bg-slate-100 p-0.5 text-xs print:hidden">
          {([["n", visao === "documentos" ? "Emendas" : "Pendências"], ["valor", "R$"]] as const).map(([m, rotulo]) => (
            <button key={m} type="button" aria-pressed={medida === m} onClick={() => setMedida(m)} className={cn("h-7 rounded-md px-2.5 font-medium transition-colors", medida === m ? "bg-white text-cataguases-marinho shadow-sm" : "text-slate-600 hover:text-cataguases-marinho")}>
              {rotulo}
            </button>
          ))}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(9.5rem,34%)_minmax(0,1fr)]">
        <div className="flex min-h-0 items-center justify-center py-1 pl-2 pr-1">
          <Pizza fatias={fatias} destaque={sobreChave} selecionada={selecionada} aoEscolher={escolher} dinheiro={medida === "valor"} className="aspect-square h-full max-h-[14.5rem] min-h-[9rem] w-auto max-w-full" rotuloTotal={medida === "valor" ? "em emendas" : unidade} />
        </div>
        <ul id={id} className="emd-foco flex min-h-0 flex-col overflow-y-auto overscroll-contain py-0.5 pr-1 [&>li:first-child]:mt-auto [&>li:last-child]:mb-auto" aria-label={`Por ${def.rotulo.toLowerCase()}`}>
          {itens.length === 0 && <li className="p-6 text-center text-sm text-slate-600">Nada a mostrar com esses filtros.</li>}
          {itens.map((i) => {
            const v = valorDe(i);
            const ativo = selecionada === i.chave;
            const aberto = abertos.has(i.chave);
            const clicavel = !!param || !!i.emendas;
            const detalhe = `${i.n} ${unidade}${param ? ` (${i.alta} altas, ${i.media} médias, ${i.baixa} baixas)` : ""}, ${brlCurto(i.valor)}`;
            return (
              <CaixaInfo
                key={i.chave}
                as="li"
                style={aberto ? undefined : { flex: "1 0 2.25rem", maxHeight: "2.75rem" }}
                className={cn(!aberto && "flex", aberto && "flex-none")}
                desativada={aberto}
                conteudo={
                  <>
                    <CaixaTitulo rotulo={def.rotulo} valor={i.rotulo} lado={String(v)} ladoApoio={total ? `${pct(v / total, 0)} do gráfico` : undefined} />
                    <CaixaLinhas
                      linhas={[
                        { rotulo: unidade === "emendas" ? "Emendas" : "Pendências", valor: String(i.n), forte: true },
                        ...(param ? [{ rotulo: "Alta", valor: String(i.alta), cor: COR.alta }, { rotulo: "Média", valor: String(i.media), cor: COR.media }, { rotulo: "Baixa", valor: String(i.baixa), cor: COR.baixa }] : []),
                        { rotulo: "Valor das emendas", valor: brl(i.valor) },
                      ]}
                    />
                    <CaixaNota>{param ? "Clique para filtrar a lista por este item." : "Clique para ver quais emendas."}</CaixaNota>
                  </>
                }
              >
                <div className="flex w-full flex-col">
                  <button
                    type="button"
                    disabled={!clicavel}
                    aria-pressed={param ? ativo : undefined}
                    aria-expanded={i.emendas ? aberto : undefined}
                    aria-label={`${i.rotulo}: ${detalhe}`}
                    onMouseEnter={() => setSobreChave(i.chave)}
                    onMouseLeave={() => setSobreChave(null)}
                    onFocus={() => setSobreChave(i.chave)}
                    onBlur={() => setSobreChave(null)}
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
                    className={cn("grid h-full min-h-9 w-full grid-cols-[0.625rem_minmax(4.5rem,1fr)_minmax(1.5rem,3.5rem)_auto_2.25rem] items-center gap-x-2 rounded-lg px-2.5 py-0.5 text-left transition-colors", ativo ? "bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)]" : "hover:bg-slate-50")}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.cor }} aria-hidden />
                    <span className="truncate text-[0.8125rem] leading-tight text-cataguases-marinho">{i.rotulo}</span>
                    <span className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                      {param && medida === "n" ? (
                        (["alta", "media", "baixa"] as const).map((g) => <span key={g} className="emd-preenche" style={{ width: `${(i[g] / maximo) * 100}%`, backgroundColor: COR[g] }} />)
                      ) : (
                        <span className="emd-preenche" style={{ width: `${(v / maximo) * 100}%`, backgroundColor: i.cor }} />
                      )}
                    </span>
                    <span className="whitespace-nowrap text-right text-[0.8125rem] font-semibold tabular-nums text-cataguases-marinho">{medida === "valor" ? brlCurto(v) : v}</span>
                    <span className="text-right text-xs tabular-nums text-slate-600">{total ? pct(v / total, 0) : "0%"}</span>
                  </button>
                  {i.emendas && aberto && (
                    <p className="flex flex-wrap gap-1.5 px-2.5 pb-2 pl-7 print:hidden">
                      {i.emendas.map((e) => (
                        <Link key={e.emendaId} href={`/emendas/${e.emendaId}?aba=documentacao`} title={e.secretaria} className="inline-flex h-7 items-center rounded-full border border-slate-300 bg-white px-2.5 font-mono text-xs text-cataguases-marinho hover:bg-slate-50">
                          {e.numero}
                        </Link>
                      ))}
                    </p>
                  )}
                </div>
              </CaixaInfo>
            );
          })}
          {visao === "motivo" && <li className="px-2.5 pb-1 pt-2 text-xs text-slate-600 print:hidden">Causa específica de cada assunto. Uma pendência pode ter mais de um motivo e conta em cada um.</li>}
          {visao === "documentos" && itens.length > 0 && <li className="px-2.5 pb-1 pt-2 text-xs text-slate-600 print:hidden">Exigidos por lei e ainda não ligados no Drive. Clique para ver quais emendas.</li>}
        </ul>
      </div>
    </section>
  );
}
