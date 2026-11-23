"use client";

import * as React from "react";
import { X } from "lucide-react";

import { AnelAndamento } from "@/components/emendas/anel-andamento";
import { CaixaInfo, CaixaLinhas, CaixaNota, CaixaTitulo } from "@/components/modulo/caixa-info";
import { useCatalogo } from "@/components/emendas/catalogo-etapas";
import { COR_FINANCEIRA, itensDaVisao, VISOES, type Medida, type Visao } from "@/components/emendas/painel-lista";
import { Pizza, CINZA } from "@/components/modulo/pizza";
import { faixaFinanceira, filtrarEmendasLista, somar, type FiltrosLista, type GrupoLista } from "@/lib/emendas/painel-lista";
import { COR_DINHEIRO } from "@/lib/emendas/cores-financeiras";
import { ORDEM_TIPOS, TIPOS_EXECUCAO, tipoDaEmenda } from "@/lib/emendas/fases";
import { brl, brlCurto, pct } from "@/lib/emendas/regras";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { cn } from "@/lib/utils";
import type { EmendaResumo } from "@/types/emendas";

type Base = { emendas: EmendaResumo[]; resumos: Record<string, ResumoLinha>; filtros: FiltrosLista; definir: (m: Record<string, string>) => void };

/**
 * Faixa de indicadores de uma linha só (emendas, indicado, empenhado, pago, andamento médio) com a barra de
 * execução do valor indicado (pago / a pagar / sem empenho) na base. Ocupa ~4 rem, para sobrar altura aos gráficos.
 * Cada indicador abre uma caixa de informações (depois de uma pausa) com a composição do número.
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
  const pc = (v: number, base: number) => (base > 0 ? pct(v / base, 0) : "—");

  const porTipo = ORDEM_TIPOS.map((t) => {
    const g = filtradas.filter((e) => tipoDaEmenda(e) === t);
    return { t, n: g.length, valor: g.reduce((s, e) => s + e.valor, 0) };
  });
  const saude = filtradas.filter((e) => e.saude);
  const saudeValor = saude.reduce((s, e) => s + e.valor, 0);
  const comEmpenho = filtradas.filter((e) => e.empenhado > 0).length;
  const pagasInteiras = filtradas.filter((e) => e.empenhado > 0 && e.pago >= e.empenhado - 0.005).length;
  const pagasEmParte = filtradas.filter((e) => e.pago > 0 && e.pago < e.empenhado - 0.005).length;
  const concluidas = comFases.filter((e) => resumos[e.id].concluidas >= resumos[e.id].total).length;
  const semAvanco = comFases.filter((e) => resumos[e.id].concluidas === 0).length;

  const infos: Record<string, React.ReactNode> = {
    Indicado: (
      <>
        <CaixaTitulo rotulo="Valor indicado" valor={brl(tot.valor)} lado={todas.valor ? pct(tot.valor / todas.valor, 0) : undefined} ladoApoio="do exercício" />
        <CaixaLinhas linhas={[...porTipo.map((x) => ({ rotulo: TIPOS_EXECUCAO[x.t].nome, valor: brlCurto(x.valor), apoio: pc(x.valor, tot.valor), cor: TIPOS_EXECUCAO[x.t].cor })), { rotulo: "Na Saúde", valor: brlCurto(saudeValor), apoio: pc(saudeValor, tot.valor), forte: true }]} />
        <CaixaNota>Soma do valor das emendas do recorte atual (filtros e abas aplicados).</CaixaNota>
      </>
    ),
    Empenhado: (
      <>
        <CaixaTitulo rotulo="Empenhado" valor={brl(tot.empenhado)} lado={pc(tot.empenhado, tot.valor)} ladoApoio="do indicado" />
        <CaixaLinhas linhas={[{ rotulo: "Falta empenhar", valor: brl(Math.max(0, tot.valor - tot.empenhado)), cor: COR_DINHEIRO.semEmpenhar }, { rotulo: "Emendas com empenho", valor: String(comEmpenho), apoio: `de ${tot.n}` }]} />
        <CaixaNota>Empenho lançado no IPM e registrado na aba Financeiro de cada emenda.</CaixaNota>
      </>
    ),
    Pago: (
      <>
        <CaixaTitulo rotulo="Pago" valor={brl(tot.pago)} lado={pc(tot.pago, tot.valor)} ladoApoio="do indicado" />
        <CaixaLinhas
          linhas={[
            { rotulo: "Do empenhado", valor: pc(tot.pago, tot.empenhado) },
            { rotulo: "Empenhado a pagar", valor: brl(Math.max(0, tot.empenhado - tot.pago)), cor: COR_DINHEIRO.aPagar },
            { rotulo: "Pagas por inteiro", valor: String(pagasInteiras), cor: COR_DINHEIRO.pago },
            { rotulo: "Pagas em parte", valor: String(pagasEmParte), cor: COR_DINHEIRO.aPagar },
          ]}
        />
        <CaixaNota>O pagamento fecha com o valor empenhado, não com o valor da emenda.</CaixaNota>
      </>
    ),
  };
  const celulas: [string, string, React.ReactNode][] = [
    ["Indicado", brlCurto(tot.valor), todas.valor ? `${pct(tot.valor / todas.valor, 0)} do exercício` : ""],
    ["Empenhado", brlCurto(tot.empenhado), tot.valor ? `${pct(tot.empenhado / tot.valor, 0)} do indicado` : ""],
    ["Pago", brlCurto(tot.pago), tot.valor ? `${pct(tot.pago / tot.valor, 0)} do indicado` : ""],
  ];
  return (
    <div className="border-b border-slate-200">
      <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] items-stretch divide-x divide-slate-200">
        <CaixaInfo
          as="div"
          className="min-w-0 px-3 py-2"
          conteudo={
            <>
              <CaixaTitulo rotulo="Emendas no recorte" valor={`${tot.n} de ${todas.n}`} />
              <CaixaLinhas linhas={[...porTipo.map((x) => ({ rotulo: TIPOS_EXECUCAO[x.t].nome, valor: String(x.n), cor: TIPOS_EXECUCAO[x.t].cor })), { rotulo: "Na Saúde", valor: String(saude.length) }, { rotulo: "Com pendência", valor: String(tot.comPendencia), forte: true }]} />
            </>
          }
        >
          <p className="text-xs font-medium text-slate-600">Emendas</p>
          <p className="truncate text-base font-semibold leading-tight tabular-nums text-cataguases-marinho">
            {tot.n} <span className="text-xs font-normal text-slate-500">de {todas.n}</span>
          </p>
          <button
            type="button"
            aria-pressed={f.p === "1"}
            onClick={() => definir({ p: f.p === "1" ? "" : "1" })}
            className={cn("-ml-1 max-w-full truncate rounded-md px-1 text-xs font-medium tabular-nums text-[color:var(--modulo-tinta)] hover:bg-[color-mix(in_srgb,var(--modulo)_10%,transparent)]", f.p === "1" && "bg-[color-mix(in_srgb,var(--modulo)_16%,transparent)]")}
          >
            {tot.comPendencia} c/ pendência
          </button>
          <span className="sr-only">{f.p === "1" ? " (clique para mostrar todas)" : " (clique para mostrar só as que têm pendência)"}</span>
        </CaixaInfo>
        {celulas.map(([rotulo, valor, apoio]) => (
          <CaixaInfo key={rotulo} as="div" className="min-w-0 px-3 py-2" conteudo={infos[rotulo]}>
            <p className="text-xs font-medium text-slate-600">{rotulo}</p>
            <p className="truncate text-base font-semibold leading-tight tabular-nums text-cataguases-marinho">{valor}</p>
            <p className="truncate text-xs tabular-nums text-slate-500">{apoio}</p>
          </CaixaInfo>
        ))}
        <CaixaInfo
          as="div"
          className="flex items-center px-2.5"
          conteudo={
            <>
              <CaixaTitulo rotulo="Andamento médio" lado={`${andamentoMedio}%`} ladoApoio="das fases" />
              <CaixaLinhas linhas={[{ rotulo: "Com todas as fases concluídas", valor: String(concluidas), cor: COR_DINHEIRO.pago }, { rotulo: "Sem nenhuma fase concluída", valor: String(semAvanco) }, { rotulo: "Emendas com fluxo calculado", valor: String(comFases.length) }]} />
              <CaixaNota>Média, entre as emendas do recorte, das fases cumpridas sobre as fases do fluxo de cada uma.</CaixaNota>
            </>
          }
        >
          <AnelAndamento concluidas={andamentoMedio} total={100} tamanho={44} espessura={4.5} />
        </CaixaInfo>
      </div>
      <CaixaInfo
        as="div"
        conteudo={
          <>
            <CaixaTitulo rotulo="Execução do valor indicado" valor={brl(faixaTotal)} />
            <CaixaLinhas linhas={[{ rotulo: "Pago", valor: brlCurto(faixa.pago), apoio: pc(faixa.pago, faixaTotal), cor: COR_FINANCEIRA.paga }, { rotulo: "Empenhado a pagar", valor: brlCurto(faixa.aPagar), apoio: pc(faixa.aPagar, faixaTotal), cor: COR_FINANCEIRA.paga_parcial }, { rotulo: "Sem empenho", valor: brlCurto(faixa.semEmpenho), apoio: pc(faixa.semEmpenho, faixaTotal), cor: COR_FINANCEIRA.sem_empenho }]} />
          </>
        }
      >
        <div className="flex h-1.5 overflow-hidden bg-slate-100" role="img" aria-label={`Do valor indicado: ${brlCurto(faixa.pago)} pagos, ${brlCurto(faixa.aPagar)} empenhados a pagar, ${brlCurto(faixa.semEmpenho)} sem empenho`}>
          <span className="emd-preenche" style={{ width: parte(faixa.pago), backgroundColor: COR_FINANCEIRA.paga }} />
          <span className="emd-preenche" style={{ width: parte(faixa.aPagar), backgroundColor: COR_FINANCEIRA.paga_parcial }} />
          <span className="emd-preenche" style={{ width: parte(faixa.semEmpenho), backgroundColor: COR_FINANCEIRA.sem_empenho }} />
        </div>
      </CaixaInfo>
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
    <section
      aria-label={`Gráfico por ${def.rotulo.toLowerCase()}`}
      // A altura acompanha a quantidade de linhas: quem tem poucas opções não sobra em branco e quem tem muitas ganha espaço.
      style={{ flex: `${Math.max(5, itens.length) + 2} 1 0%` }}
      className={cn("emd-grafico flex min-h-0 flex-col overflow-hidden", className)}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 pb-1.5 pt-2.5">
        <label className="relative">
          <span className="sr-only">Dimensão do gráfico</span>
          <select
            value={visao}
            onChange={(e) => setVisao(e.target.value as Visao)}
            className="h-9 cursor-pointer appearance-none rounded-[0.75rem] border border-slate-300 bg-white py-0 pl-3 pr-8 text-sm font-semibold text-cataguases-marinho outline-none transition-shadow focus:border-[color:var(--modulo)] focus:ring-2 focus:ring-[color:var(--modulo)]/25"
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

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(9.5rem,34%)_minmax(0,1fr)]">
        <div className="flex min-h-0 items-center justify-center py-1 pl-2 pr-1">
          <Pizza fatias={fatias} destaque={sobre} selecionada={selecionada} aoEscolher={escolher} dinheiro={dinheiro} className="aspect-square h-full max-h-[14.5rem] min-h-[4.5rem] w-auto max-w-full" rotuloTotal={medida === "valor" ? "indicados" : medida === "pago" ? "pagos" : visao === "pendencia" ? "pendências" : "emendas"} />
        </div>
        <ul id={id} className="emd-foco flex min-h-0 flex-col overflow-y-auto overscroll-contain py-0.5 pr-1 [&>li:first-child]:mt-auto [&>li:last-child]:mb-auto" aria-label={`Por ${def.rotulo.toLowerCase()}`}>
          {itens.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Nada a mostrar com esses filtros.</li>}
          {itens.map((i) => {
            const v = valorDe(i);
            const ativo = selecionada === i.chave;
            const detalhe = `${i.n} emendas, ${brlCurto(i.valor)} indicados, ${brlCurto(i.pago)} pagos${i.comPendencia ? `, ${i.comPendencia} com pendência` : ""}`;
            const conteudo = (
              <>
                <CaixaTitulo rotulo={def.rotulo} valor={i.rotulo} lado={`${i.n}`} ladoApoio={total ? `${pct(v / total, 0)} do gráfico` : undefined} />
                <CaixaLinhas
                  linhas={[
                    { rotulo: "Valor indicado", valor: brl(i.valor), cor: COR_DINHEIRO.indicado },
                    { rotulo: "Empenhado", valor: brl(i.empenhado), apoio: i.valor ? pct(i.empenhado / i.valor, 0) : undefined, cor: COR_DINHEIRO.empenhado },
                    { rotulo: "Pago", valor: brl(i.pago), apoio: i.valor ? pct(i.pago / i.valor, 0) : undefined, cor: COR_DINHEIRO.pago },
                    { rotulo: "Com pendência", valor: String(i.comPendencia), forte: true },
                  ]}
                />
                <CaixaNota>Clique para filtrar a lista por este item.</CaixaNota>
              </>
            );
            return (
              <CaixaInfo key={i.chave} as="li" conteudo={conteudo} style={{ flex: "1 0 2.25rem", maxHeight: "2.75rem" }} className="flex">
                <button
                  type="button"
                  aria-pressed={ativo}
                  aria-label={`${i.rotulo}: ${detalhe}`}
                  onClick={() => escolher(ativo ? "" : i.chave)}
                  onMouseEnter={() => setSobre(i.chave)}
                  onMouseLeave={() => setSobre(null)}
                  onFocus={() => setSobre(i.chave)}
                  onBlur={() => setSobre(null)}
                  className={cn("grid h-full min-h-9 w-full grid-cols-[0.625rem_minmax(4.5rem,1fr)_minmax(1.5rem,3.5rem)_auto_2.25rem] items-center gap-x-2 rounded-lg px-2.5 py-0.5 text-left transition-colors", ativo ? "bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)]" : "hover:bg-slate-50")}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.cor }} aria-hidden />
                  <span className="truncate text-[0.8125rem] leading-tight text-cataguases-marinho">{i.rotulo}</span>
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <span className="emd-preenche" style={{ width: `${(v / maximo) * 100}%`, backgroundColor: i.cor }} />
                  </span>
                  <span className="whitespace-nowrap text-right text-[0.8125rem] font-semibold tabular-nums text-cataguases-marinho">{fmt(v)}</span>
                  <span className="text-right text-xs tabular-nums text-slate-500">{total ? pct(v / total, 0) : "0%"}</span>
                </button>
              </CaixaInfo>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
