"use client";

import * as React from "react";
import { X } from "lucide-react";

import { AnelAndamento } from "@/components/emendas/anel-andamento";
import { useCatalogo } from "@/components/emendas/catalogo-etapas";
import { COR_FINANCEIRA, itensDaVisao, VISOES, type Medida, type Visao } from "@/components/emendas/painel-lista";
import { Pizza, CINZA } from "@/components/emendas/pizza";
import { faixaFinanceira, filtrarEmendasLista, somar, type FiltrosLista, type GrupoLista } from "@/lib/emendas/painel-lista";
import { brlCurto, pct } from "@/lib/emendas/regras";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { cn } from "@/lib/utils";
import type { EmendaResumo } from "@/types/emendas";

type Base = { emendas: EmendaResumo[]; resumos: Record<string, ResumoLinha>; filtros: FiltrosLista; definir: (m: Record<string, string>) => void };

/**
 * Faixa de indicadores de uma linha só (emendas, indicado, empenhado, pago, andamento médio) com a barra de
 * execução do valor indicado (pago / a pagar / sem empenho) na base. Ocupa ~4 rem, para sobrar altura aos gráficos.
 */
export function FaixaIndicadores({ emendas, resumos, filtros: f, definir }: Base) {
  const filtradas = filtrarEmendasLista(emendas, resumos, f);
  const tot = somar(filtradas, resumos);
  const todas = somar(emendas, resumos);
  const faixa = faixaFinanceira(filtradas);
  const faixaTotal = faixa.pago + faixa.aPagar + faixa.semEmpenho;
  const comFases = filtradas.filter((e) => (resumos[e.id]?.total ?? 0) > 0);
  const andamentoMedio = comFases.length ? Math.round((comFases.reduce((s, e) => s + resumos[e.id].concluidas / resumos[e.id].total, 0) / comFases.length) * 100) : 0;
  const parte = (v: number) => (faixaTotal ? `${(v / faixaTotal) * 100}%` : "0%");
  const celulas: [string, string, React.ReactNode][] = [
    ["Indicado", brlCurto(tot.valor), todas.valor ? `${pct(tot.valor / todas.valor, 0)} do exercício` : ""],
    ["Empenhado", brlCurto(tot.empenhado), tot.valor ? `${pct(tot.empenhado / tot.valor, 0)} do indicado` : ""],
    ["Pago", brlCurto(tot.pago), tot.valor ? `${pct(tot.pago / tot.valor, 0)} do indicado` : ""],
  ];
  return (
    <div className="border-b border-slate-200">
      <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] items-stretch divide-x divide-slate-200">
        <div className="min-w-0 px-3 py-2">
          <p className="text-xs font-medium text-slate-600">Emendas</p>
          <p className="truncate text-base font-semibold leading-tight tabular-nums text-cataguases-marinho">
            {tot.n} <span className="text-xs font-normal text-slate-500">de {todas.n}</span>
          </p>
          <button
            type="button"
            aria-pressed={f.p === "1"}
            onClick={() => definir({ p: f.p === "1" ? "" : "1" })}
            title={f.p === "1" ? "Mostrar todas" : "Mostrar só as que têm pendência"}
            className={cn("-ml-1 max-w-full truncate rounded-md px-1 text-xs font-medium tabular-nums text-[color:var(--modulo-tinta)] hover:bg-[color-mix(in_srgb,var(--modulo)_10%,transparent)]", f.p === "1" && "bg-[color-mix(in_srgb,var(--modulo)_16%,transparent)]")}
          >
            {tot.comPendencia} c/ pendência
          </button>
        </div>
        {celulas.map(([rotulo, valor, apoio]) => (
          <div key={rotulo} className="min-w-0 px-3 py-2">
            <p className="text-xs font-medium text-slate-600">{rotulo}</p>
            <p className="truncate text-base font-semibold leading-tight tabular-nums text-cataguases-marinho">{valor}</p>
            <p className="truncate text-xs tabular-nums text-slate-500">{apoio}</p>
          </div>
        ))}
        <div className="flex items-center px-2.5" title="Andamento médio: média das fases cumpridas em cada emenda">
          <AnelAndamento concluidas={andamentoMedio} total={100} tamanho={44} espessura={4.5} />
        </div>
      </div>
      <div
        className="flex h-1.5 overflow-hidden bg-slate-100"
        role="img"
        aria-label={`Do valor indicado: ${brlCurto(faixa.pago)} pagos, ${brlCurto(faixa.aPagar)} empenhados a pagar, ${brlCurto(faixa.semEmpenho)} sem empenho`}
        title={`Pago ${brlCurto(faixa.pago)} · a pagar ${brlCurto(faixa.aPagar)} · sem empenho ${brlCurto(faixa.semEmpenho)}`}
      >
        <span className="emd-preenche" style={{ width: parte(faixa.pago), backgroundColor: COR_FINANCEIRA.paga }} />
        <span className="emd-preenche" style={{ width: parte(faixa.aPagar), backgroundColor: COR_FINANCEIRA.paga_parcial }} />
        <span className="emd-preenche" style={{ width: parte(faixa.semEmpenho), backgroundColor: COR_FINANCEIRA.sem_empenho }} />
      </div>
    </div>
  );
}

const MEDIDAS: [Medida, string, string][] = [
  ["n", "Qtd", "Quantidade de emendas"],
  ["valor", "R$ indicado", "Valor indicado"],
  ["pago", "R$ pago", "Valor pago"],
];

/**
 * Um gráfico que também é filtro: escolhe-se a dimensão (etapa, vereador, secretaria…) e clicar numa fatia ou linha filtra
 * a lista. Cada gráfico mostra todas as suas opções (ignora o próprio filtro) mas respeita os filtros dos outros, então
 * dois gráficos lado a lado se combinam: filtre por vereador num e veja a distribuição por etapa no outro.
 */
export function GraficoFiltro({ emendas, resumos, filtros: f, definir, visaoInicial, className }: Base & { visaoInicial: Visao; className?: string }) {
  const catalogo = useCatalogo();
  const [visao, setVisao] = React.useState<Visao>(visaoInicial);
  const [medida, setMedida] = React.useState<Medida>("n");
  const [sobre, setSobre] = React.useState<string | null>(null);
  const def = VISOES.find((v) => v.chave === visao)!;
  const selecionada = String(f[def.param as keyof FiltrosLista] ?? "");
  const numeros = f.numeros.join(",");

  const itens = React.useMemo(
    () => itensDaVisao(visao, medida, emendas, resumos, f, catalogo),
    // `f` entra pelos campos que ele tem
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visao, medida, emendas, resumos, catalogo, f.v, f.s, f.etapa, f.t, f.p, f.situacao, f.fin, f.sd, f.cat, f.rem, f.pe, f.q, numeros]
  );

  const valorDe = (i: GrupoLista) => i[medida];
  const total = itens.reduce((s, i) => s + valorDe(i), 0);
  const maximo = Math.max(1, ...itens.map(valorDe));
  const dinheiro = medida !== "n";
  const fmt = (v: number) => (dinheiro ? brlCurto(v) : String(v));
  const escolher = (chave: string) => definir({ [def.param]: chave });

  const ordenadas = [...itens].filter((i) => valorDe(i) > 0).sort((a, b) => valorDe(b) - valorDe(a));
  const fatias = ordenadas.slice(0, 8).map((i) => ({ chave: i.chave, rotulo: i.rotulo, v: valorDe(i), cor: i.cor, clicavel: true }));
  const resto = ordenadas.slice(8).reduce((s, i) => s + valorDe(i), 0);
  if (resto > 0) fatias.push({ chave: "__demais", rotulo: "Demais", v: resto, cor: CINZA, clicavel: false });
  if (selecionada && !fatias.some((x) => x.chave === selecionada)) {
    const i = itens.find((x) => x.chave === selecionada);
    if (i && valorDe(i) > 0) fatias.splice(fatias.length - 1, 0, { chave: i.chave, rotulo: i.rotulo, v: valorDe(i), cor: i.cor, clicavel: true });
  }

  const id = React.useId();
  return (
    <section aria-label={`Gráfico por ${def.rotulo.toLowerCase()}`} className={cn("flex min-h-0 flex-col", className)}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 pb-1.5 pt-2.5">
        <label className="relative">
          <span className="sr-only">Dimensão do gráfico</span>
          <select
            value={visao}
            onChange={(e) => setVisao(e.target.value as Visao)}
            className="h-9 cursor-pointer appearance-none rounded-xl border border-slate-300 bg-white/80 py-0 pl-3 pr-8 text-sm font-semibold text-cataguases-marinho outline-none transition-shadow focus:border-[color:var(--modulo)] focus:ring-2 focus:ring-[color:var(--modulo)]/25"
          >
            {VISOES.map((v) => (
              <option key={v.chave} value={v.chave}>
                {v.rotulo}
              </option>
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
        <div role="group" aria-label="Medida" className="ml-auto inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {MEDIDAS.map(([m, rotulo, titulo]) => (
            <button key={m} type="button" title={titulo} aria-pressed={medida === m} onClick={() => setMedida(m)} className={cn("h-7 rounded-md px-2.5 font-medium transition-colors", medida === m ? "bg-white text-cataguases-marinho shadow-sm" : "text-slate-600 hover:text-cataguases-marinho")}>
              {rotulo}
            </button>
          ))}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[11rem_minmax(0,1fr)]">
        <div className="flex items-center justify-center pl-2 pr-1">
          <Pizza fatias={fatias} destaque={sobre} selecionada={selecionada} aoEscolher={escolher} dinheiro={dinheiro} className="h-[10.25rem] w-[10.25rem]" rotuloTotal={medida === "valor" ? "indicados" : medida === "pago" ? "pagos" : visao === "pendencia" ? "pendências" : "emendas"} />
        </div>
        <ul id={id} className="emd-foco min-h-0 overflow-y-auto overscroll-contain py-0.5 pr-1" aria-label={`Por ${def.rotulo.toLowerCase()}`}>
          {itens.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Nada a mostrar com esses filtros.</li>}
          {itens.map((i) => {
            const v = valorDe(i);
            const ativo = selecionada === i.chave;
            const detalhe = `${i.n} emendas, ${brlCurto(i.valor)} indicados, ${brlCurto(i.pago)} pagos${i.comPendencia ? `, ${i.comPendencia} com pendência` : ""}`;
            return (
              <li key={i.chave}>
                <button
                  type="button"
                  aria-pressed={ativo}
                  aria-label={`${i.rotulo}: ${detalhe}`}
                  title={detalhe}
                  onClick={() => escolher(ativo ? "" : i.chave)}
                  onMouseEnter={() => setSobre(i.chave)}
                  onMouseLeave={() => setSobre(null)}
                  onFocus={() => setSobre(i.chave)}
                  onBlur={() => setSobre(null)}
                  className={cn("grid min-h-9 w-full grid-cols-[0.625rem_minmax(4.5rem,1fr)_minmax(1.5rem,3.5rem)_auto_2.25rem] items-center gap-x-2 rounded-lg px-2.5 py-0.5 text-left transition-colors", ativo ? "bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)]" : "hover:bg-slate-50")}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.cor }} aria-hidden />
                  <span className="truncate text-[0.8125rem] leading-tight text-cataguases-marinho">{i.rotulo}</span>
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <span className="emd-preenche" style={{ width: `${(v / maximo) * 100}%`, backgroundColor: i.cor }} />
                  </span>
                  <span className="whitespace-nowrap text-right text-[0.8125rem] font-semibold tabular-nums text-cataguases-marinho">{fmt(v)}</span>
                  <span className="text-right text-xs tabular-nums text-slate-500">{total ? pct(v / total, 0) : "0%"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
