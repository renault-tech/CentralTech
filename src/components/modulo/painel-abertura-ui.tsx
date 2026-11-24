"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";

import { CaixaInfo, CaixaLinhas, CaixaNota, CaixaTitulo } from "@/components/modulo/caixa-info";
import { brlCurto, brlCompleto } from "@/lib/moeda";
import { cn } from "@/lib/utils";

/**
 * Peças dos painéis de abertura dos módulos (Frotas, Imóveis…), no mesmo desenho do painel das Emendas: cabeçalho de saudação,
 * cartão escuro de destaque, lista "precisa da sua atenção", lista de etapas com barras, anel, gráfico mensal em colunas.
 * Regra de ouro: nada de espaço vazio. Os cartões de uma mesma linha esticam até a altura do maior e o conteúdo que sobra
 * (linhas de lista, barras) cresce para preencher, em vez de deixar um buraco embaixo.
 */

export const CARTAO = "emd-entra rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
export const ROTULO = "text-[0.75rem] font-semibold uppercase tracking-[0.09em] text-slate-600";
export const LINK_TITULO = "text-[0.8125rem] font-medium normal-case tracking-normal text-[color:var(--modulo-tinta)] underline-offset-2 hover:underline";
export const COR_GRAVIDADE = { alta: "#B91C1C", media: "#D97706", info: "#2563EB" } as const;
export type Gravidade = keyof typeof COR_GRAVIDADE;

export function Titulo({ children, ver }: { children: React.ReactNode; ver?: { href: string; rotulo: string } }) {
  return (
    <h2 className={cn(ROTULO, "flex items-center justify-between gap-3")}>
      <span>{children}</span>
      {ver && (
        <Link href={ver.href} className={LINK_TITULO}>
          {ver.rotulo}
        </Link>
      )}
    </h2>
  );
}

export function CabecalhoPainel({ saudacao, apoio, acao }: { saudacao: string; apoio: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div>
        <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.025em] text-cataguases-marinho text-balance">{saudacao}</h1>
        <p className="mt-0.5 text-[0.875rem] text-slate-600">{apoio}</p>
      </div>
      {acao && <div className="flex flex-wrap items-center gap-2">{acao}</div>}
    </header>
  );
}

export function Marca({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="inline-block h-2 w-2 rounded-[3px]" style={{ backgroundColor: cor }} aria-hidden />
      {children}
    </span>
  );
}

/** Anel de percentual (SVG). */
export function Anel({ fracao, cor, rotulo, texto }: { fracao: number; cor: string; rotulo: string; texto?: string }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <svg viewBox="0 0 92 92" className="h-[5.75rem] w-[5.75rem] flex-none" role="img" aria-label={`${Math.round(f * 100)}% ${rotulo}`}>
      <circle cx="46" cy="46" r={r} fill="none" strokeWidth="9" className="stroke-slate-200" />
      <circle cx="46" cy="46" r={r} fill="none" stroke={cor} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(c * f).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 46 46)" className="emd-fatia" />
      <text x="46" y={texto ? 50 : 52} textAnchor="middle" fontSize="19" fontWeight="600" className="fill-current text-cataguases-marinho">
        {texto ?? `${Math.round(f * 100)}%`}
      </text>
      <text x="46" y="63" textAnchor="middle" fontSize="8.5" className="fill-slate-500">
        {rotulo}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Cartão escuro de destaque
// ---------------------------------------------------------------------------------------------------------------------

export type SegmentoHero = { chave: string; valor: number; cor: string; caixa: React.ReactNode };
export type CartaoLegenda = { chave: string; nome: string; valor: string; apoio: string; cor: string; href: string; alerta?: boolean };
export type ChipHero = { nome: string; quantidade: number; cor: string; href: string };

export function Hero({
  rotulo,
  apoio,
  grande,
  pequeno,
  sub,
  destaque,
  segmentos,
  legenda,
  chips,
  insight,
  rodape,
  tour,
  rotuloBarra,
}: {
  rotulo: string;
  apoio: string;
  grande: string;
  pequeno: string;
  sub: React.ReactNode;
  destaque: { valor: string; rotulo: string };
  segmentos: SegmentoHero[];
  legenda: CartaoLegenda[];
  chips: ChipHero[];
  insight?: React.ReactNode;
  rodape: React.ReactNode;
  tour?: string;
  rotuloBarra: string;
}) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0);
  return (
    <section
      aria-label={rotulo}
      data-tour={tour}
      className="emd-entra relative flex flex-col overflow-hidden rounded-2xl p-5 text-[#EAF0F9] sm:p-6"
      style={{ background: "radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--modulo) 55%, transparent), transparent 55%), linear-gradient(135deg, #0C1D33, #12294A)", ["--i" as string]: 0 }}
    >
      <h2 className="flex items-center justify-between gap-3 text-[0.75rem] font-semibold uppercase tracking-[0.09em] text-[#AEBBD0]">
        <span>{rotulo}</span>
        <span className="font-medium normal-case tracking-normal">{apoio}</span>
      </h2>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <p className="text-[clamp(2.1rem,4.4vw,3.25rem)] font-semibold leading-none tracking-[-0.035em] tabular-nums">
            {grande}
            <span className="ml-2 text-[0.42em] font-medium tracking-normal text-[#AEBBD0]">{pequeno}</span>
          </p>
          <p className="mt-2 text-[0.84375rem] text-[#AEBBD0]">{sub}</p>
        </div>
        <div className="flex-none sm:max-w-[11rem] sm:text-right">
          <p className="text-[1.875rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">{destaque.valor}</p>
          <p className="mt-1 text-[0.78125rem] leading-snug text-[#AEBBD0]">{destaque.rotulo}</p>
        </div>
      </div>

      <div className="mt-5 flex h-4 gap-0.5 overflow-hidden rounded-lg bg-white/10" role="img" aria-label={rotuloBarra}>
        {segmentos.map((s) => (
          <CaixaInfo key={s.chave} as="span" style={{ width: total ? `${(s.valor / total) * 100}%` : 0 }} className="block h-full" conteudo={s.caixa}>
            <span className="emd-preenche block h-full" style={{ backgroundColor: s.cor }} />
          </CaixaInfo>
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {legenda.map((l) => (
          <li key={l.chave}>
            <Link href={l.href} className="block h-full rounded-xl bg-white/[0.07] px-3 py-2.5 transition-colors hover:bg-white/[0.13]">
              <span className="flex items-center gap-1.5 text-[0.75rem] text-[#AEBBD0]">
                <i className="inline-block h-2 w-2 flex-none rounded-[3px]" style={{ backgroundColor: l.cor }} aria-hidden />
                {l.nome}
              </span>
              <span className="mt-0.5 block text-[1.25rem] font-semibold leading-tight tracking-[-0.02em] tabular-nums">{l.valor}</span>
              <span className={cn("text-[0.75rem] leading-snug", l.alerta ? "font-semibold text-[#F58A8A]" : "text-[#AEBBD0]")}>{l.apoio}</span>
            </Link>
          </li>
        ))}
      </ul>

      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Resumo por situação">
        {chips.map((x) => (
          <li key={x.nome}>
            <Link href={x.href} className="inline-flex items-center gap-2 rounded-full border border-white/15 py-1 pl-1.5 pr-3 text-[0.8125rem] transition-colors hover:bg-white/10">
              <b className="grid h-[1.375rem] min-w-6 place-items-center rounded-full bg-white/15 px-1.5 text-[0.75rem] tabular-nums" style={{ color: x.cor }}>
                {x.quantidade}
              </b>
              {x.nome}
            </Link>
          </li>
        ))}
      </ul>

      {insight && (
        <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-white/[0.07] px-3.5 py-2.5 text-[0.84375rem] leading-snug text-[#D6DEEB]">
          <ArrowRight className="mt-0.5 h-4 w-4 flex-none text-[#E9A63B]" aria-hidden />
          <span>{insight}</span>
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-x-5 gap-y-1.5 border-t border-white/15 pt-4 text-[0.75rem] text-[#AEBBD0]">{rodape}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Precisa da sua atenção
// ---------------------------------------------------------------------------------------------------------------------

export type ItemAtencaoUi = { chave: string; titulo: string; detalhe: string; quantidade: number; gravidade: Gravidade; href: string };

export function ListaAtencao({ itens, ver, tour, vazio = "Nada pedindo atenção agora. Bom sinal." }: { itens: ItemAtencaoUi[]; ver: { href: string; rotulo: string }; tour?: string; vazio?: string }) {
  return (
    <section aria-label="O que precisa da sua atenção" data-tour={tour} className="emd-entra flex flex-col rounded-2xl border border-slate-200 bg-white" style={{ ["--i" as string]: 1 }}>
      <div className="px-5 pb-1 pt-4">
        <Titulo ver={ver}>Precisa da sua atenção</Titulo>
      </div>
      {itens.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-5 py-10 text-center text-sm text-slate-600">{vazio}</p>
      ) : (
        <ul className="flex flex-1 flex-col px-2 pb-2 pt-1">
          {itens.map((i) => (
            <li key={i.chave} className="flex min-h-[3.25rem] flex-1">
              <Link href={i.href} className="grid w-full grid-cols-[0.5rem_minmax(0,1fr)_auto_0.875rem] items-center gap-x-3 rounded-xl px-3 py-2 transition-colors hover:bg-slate-100">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COR_GRAVIDADE[i.gravidade] }} aria-hidden />
                <span className="min-w-0 text-[0.84375rem] font-medium leading-snug text-cataguases-marinho">
                  {i.titulo}
                  {i.detalhe && <small className="block text-[0.75rem] font-normal text-slate-600">{i.detalhe}</small>}
                </span>
                <span className="text-[1.125rem] font-semibold tracking-tight tabular-nums" style={{ color: COR_GRAVIDADE[i.gravidade] }}>
                  {i.quantidade}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-slate-200 px-5 py-2.5 text-[0.78125rem] text-slate-600">Só aparece o que tem algo envolvido.</p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Etapas com barras
// ---------------------------------------------------------------------------------------------------------------------

export type LinhaEtapaUi = {
  chave: string;
  nome: string;
  sub?: string;
  quantidade: number;
  /** Texto para a caixa (valor em dinheiro, por exemplo). */
  valor?: string;
  cor: string;
  alerta?: boolean;
  nota?: string;
  href: string;
  /** Texto da unidade na caixa ("orçamentos", "NFs"). */
  unidade: string;
};

/** Lista numerada de etapas, cada uma com barra proporcional à maior e quantidade à direita. As linhas esticam para ocupar a altura. */
export function ListaEtapas({ itens, numerada = true }: { itens: LinhaEtapaUi[]; numerada?: boolean }) {
  const maior = Math.max(1, ...itens.map((i) => i.quantidade));
  return (
    <ol className="mt-3 flex flex-1 flex-col gap-1">
      {itens.map((i, k) => (
        <li key={i.chave} className="flex flex-1">
          <CaixaInfo
            as="div"
            className="flex w-full"
            conteudo={
              <>
                <CaixaTitulo rotulo={`${i.nome} · ${i.sub ?? ""}`.replace(/ · $/, "")} valor={`${i.quantidade} ${i.unidade}`} />
                {i.valor && <CaixaLinhas linhas={[{ rotulo: "Valor", valor: i.valor, forte: true, cor: i.cor }]} />}
                {i.nota && <CaixaNota>{i.nota}</CaixaNota>}
              </>
            }
          >
            <Link href={i.href} className="grid min-h-[2.75rem] w-full grid-cols-[1.375rem_minmax(0,8.5rem)_minmax(0,1fr)_2.25rem] items-center gap-2.5 rounded-xl px-1.5 py-1 transition-colors hover:bg-slate-100 max-sm:grid-cols-[1.375rem_minmax(0,1fr)_2.25rem]">
              {numerada ? (
                <span className={cn("grid h-[1.375rem] w-[1.375rem] place-items-center rounded-full text-[0.6875rem] font-semibold", i.alerta ? "bg-amber-100 text-amber-800" : "bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)] text-[color:var(--modulo-tinta)]")}>{k + 1}</span>
              ) : (
                <span className="grid h-[1.375rem] w-[1.375rem] place-items-center" aria-hidden>
                  <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.cor }} />
                </span>
              )}
              <span className="min-w-0 text-[0.8125rem] leading-tight text-cataguases-marinho">
                {i.nome}
                {i.sub && <small className="block truncate text-[0.71875rem] text-slate-600">{i.sub}</small>}
              </span>
              <span className="h-[1.375rem] overflow-hidden rounded-lg bg-slate-100 max-sm:hidden" aria-hidden>
                <span className="emd-preenche block h-full rounded-lg" style={{ width: `${i.quantidade ? Math.max(4, (i.quantidade / maior) * 100) : 0}%`, backgroundColor: i.cor }} />
              </span>
              <span className={cn("text-right text-[0.9375rem] font-semibold tabular-nums", i.alerta ? "text-amber-700" : "text-cataguases-marinho")}>{i.quantidade}</span>
            </Link>
          </CaixaInfo>
        </li>
      ))}
    </ol>
  );
}

export function NotaAlerta({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 text-[0.78125rem] leading-snug text-slate-600">
      <span aria-hidden className="text-amber-600">
        ▲
      </span>
      <span>{children}</span>
    </p>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Gráfico mensal em colunas (HTML puro: preenche a altura do cartão sem distorcer texto)
// ---------------------------------------------------------------------------------------------------------------------

export type MesColuna = { chave: string; rotulo: string; rotuloCompleto: string; valores: number[] };

export function GraficoMeses({ meses, series, atual }: { meses: MesColuna[]; series: { nome: string; cor: string }[]; atual?: string }) {
  const totais = meses.map((m) => m.valores.reduce((a, b) => a + b, 0));
  const maximo = Math.max(1, ...totais);
  const passo = passoLimpo(maximo);
  const topo = Math.max(passo, Math.ceil(maximo / passo) * passo);
  const marcas = [topo, topo / 2, 0];
  return (
    <div className="mt-2 flex min-h-[13.5rem] flex-1 gap-2" role="img" aria-label={`Gasto mensal: ${meses.map((m, i) => `${m.rotuloCompleto} ${brlCompleto(totais[i])}`).join("; ")}`}>
      <div className="flex w-12 flex-none flex-col justify-between pb-6 text-right text-[0.6875rem] tabular-nums text-slate-500" aria-hidden>
        {marcas.map((v) => (
          <span key={v} className="-my-1.5 leading-none">
            {v === 0 ? "0" : brlCurto(v).replace("R$ ", "")}
          </span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-x-0 bottom-6 top-0 flex flex-col justify-between" aria-hidden>
          {marcas.map((v, i) => (
            <span key={v} className={cn("block w-full border-t border-slate-200", i < marcas.length - 1 && "border-dashed")} />
          ))}
        </div>
        <ul className="absolute inset-x-0 bottom-6 top-0 flex items-end gap-1.5">
          {meses.map((m, i) => (
            <li key={m.chave} className="flex h-full min-w-0 flex-1">
              <CaixaInfo
                as="div"
                className="flex h-full w-full items-end"
                conteudo={
                  <>
                    <CaixaTitulo rotulo={m.rotuloCompleto} valor={brlCompleto(totais[i])} />
                    <CaixaLinhas linhas={series.map((s, k) => ({ rotulo: s.nome, valor: brlCompleto(m.valores[k] ?? 0), cor: s.cor }))} />
                  </>
                }
              >
                <div className="emd-sobe flex w-full flex-col-reverse overflow-hidden rounded-t-[5px]" style={{ height: `${(totais[i] / topo) * 100}%`, opacity: atual && m.chave !== atual ? 0.86 : 1 }}>
                  {series.map((s, k) => (
                    <span key={s.nome} className="block w-full" style={{ height: totais[i] ? `${((m.valores[k] ?? 0) / totais[i]) * 100}%` : 0, backgroundColor: s.cor }} />
                  ))}
                </div>
              </CaixaInfo>
            </li>
          ))}
        </ul>
        <ul className="absolute inset-x-0 bottom-0 flex h-6 items-end gap-1.5" aria-hidden>
          {meses.map((m) => (
            <li key={m.chave} className={cn("min-w-0 flex-1 truncate text-center text-[0.6875rem]", atual === m.chave ? "font-semibold text-cataguases-marinho" : "text-slate-500")}>
              <span className="sm:hidden">{m.rotulo.slice(0, 1)}</span>
              <span className="max-sm:hidden">{m.rotulo}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Passo "redondo" (1, 2, 5 × 10ⁿ) para o eixo, de modo que o topo fique perto do maior valor. */
function passoLimpo(maximo: number): number {
  const bruto = maximo / 2;
  const exp = Math.pow(10, Math.floor(Math.log10(bruto)));
  const f = bruto / exp;
  const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return m * exp;
}

export function LegendaSeries({ series }: { series: { nome: string; cor: string }[] }) {
  return (
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-slate-600">
      {series.map((s) => (
        <Marca key={s.nome} cor={s.cor}>
          {s.nome}
        </Marca>
      ))}
    </p>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Linha com barra horizontal (custo × FIPE, secretarias, contas fora do padrão)
// ---------------------------------------------------------------------------------------------------------------------

export type LinhaBarraUi = {
  chave: string;
  titulo: string;
  sub?: string;
  href: string;
  /** Largura da barra, 0–100. */
  largura: number;
  cor: string;
  /** Marcas verticais (0–100) na trilha, como os limites de atenção e crítico. */
  marcas?: number[];
  direita: string;
  corDireita?: string;
  caixa: React.ReactNode;
  /** Barra empilhada no lugar da simples (aluguel + luz + água). */
  partes?: { largura: number; cor: string }[];
};

export function ListaBarras({ itens, grade = "minmax(0,1.25fr) minmax(0,1fr) 3.25rem" }: { itens: LinhaBarraUi[]; grade?: string }) {
  return (
    <ul className="mt-3 flex flex-1 flex-col gap-px" style={{ ["--grade" as string]: grade }}>
      {itens.map((l) => (
        <li key={l.chave} className="flex flex-1">
          <CaixaInfo as="div" className="flex w-full" conteudo={l.caixa}>
            <Link href={l.href} className="grid min-h-[2.75rem] w-full grid-cols-[var(--grade)] items-center gap-x-3 rounded-xl px-2 py-1 transition-colors hover:bg-slate-100 max-sm:grid-cols-[minmax(0,1fr)_4.25rem]">
              <span className="min-w-0 text-[0.8125rem] leading-tight text-cataguases-marinho">
                <span className="block truncate">{l.titulo}</span>
                {l.sub && <small className="block truncate text-[0.71875rem] text-slate-600">{l.sub}</small>}
              </span>
              <span className="relative flex h-2.5 overflow-visible rounded-full bg-slate-100 max-sm:hidden" aria-hidden>
                {l.partes ? (
                  <span className="flex h-full w-full overflow-hidden rounded-full">
                    {l.partes.map((p, i) => (
                      <i key={i} className="emd-preenche block h-full" style={{ width: `${p.largura}%`, backgroundColor: p.cor }} />
                    ))}
                  </span>
                ) : (
                  <i className="emd-preenche block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, l.largura))}%`, backgroundColor: l.cor }} />
                )}
                {l.marcas?.map((m) => (
                  <s key={m} className="absolute -bottom-[3px] -top-[3px] w-0.5 bg-slate-800/40 no-underline" style={{ left: `${m}%` }} />
                ))}
              </span>
              <span className="text-right text-[0.78125rem] font-semibold tabular-nums" style={l.corDireita ? { color: l.corDireita } : undefined}>
                {l.direita}
              </span>
            </Link>
          </CaixaInfo>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Linha do tempo / últimos movimentos
// ---------------------------------------------------------------------------------------------------------------------

export type MovimentoUi = { chave: string; icone: React.ReactNode; cor: string; texto: string; detalhe: string; quando: string; href: string };

export function ListaMovimentos({ itens, vazio }: { itens: MovimentoUi[]; vazio: string }) {
  if (itens.length === 0) return <p className="mt-4 flex-1 text-sm text-slate-600">{vazio}</p>;
  return (
    <ul className="mt-2 grid flex-1 grid-rows-[repeat(var(--linhas),minmax(0,1fr))] gap-x-8 lg:grid-flow-col" style={{ ["--linhas" as string]: Math.ceil(itens.length / 2) }}>
      {itens.map((a) => (
        <li key={a.chave} className="flex border-b border-slate-100 last:border-0">
          <Link href={a.href} className="grid w-full grid-cols-[1.875rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-slate-50">
            <span className="grid h-[1.875rem] w-[1.875rem] place-items-center rounded-full text-white" style={{ backgroundColor: a.cor }}>
              {a.icone}
            </span>
            <span className="min-w-0 text-[0.8125rem] text-cataguases-marinho">
              <b className="font-medium">{a.texto}</b>
              <small className="block truncate text-[0.75rem] text-slate-600">{a.detalhe}</small>
            </span>
            <span className="whitespace-nowrap text-[0.75rem] text-slate-600">{a.quando}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
