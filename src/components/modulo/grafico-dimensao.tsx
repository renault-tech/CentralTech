"use client";

import * as React from "react";
import { X } from "lucide-react";

import { CaixaInfo, CaixaLinhas, CaixaNota, CaixaTitulo } from "@/components/modulo/caixa-info";
import { CINZA, PALETA, Pizza } from "@/components/modulo/pizza";
import { agruparPorDimensao, filtrarItens, opcaoEscolhida, type Dimensao, type GrupoDimensao, type LerParametro, type Medida } from "@/lib/modulo/area-trabalho";
import { brlCompleto, brlCurto, pctDe } from "@/lib/moeda";
import { cn } from "@/lib/utils";

export type PropsGrafico<T> = {
  itens: T[];
  dims: Dimensao<T>[];
  medidas: Medida<T>[];
  ler: LerParametro;
  definir: (mudancas: Record<string, string>) => void;
  busca: { texto: (item: T) => string; q: string };
  dimInicial: string;
  /** "emendas", "manutenções"… (centro da pizza e caixa de informações). */
  unidades: { singular: string; plural: string };
  className?: string;
};

/**
 * Um gráfico que também é filtro (pizza + ranking): escolhe-se a dimensão e clicar numa fatia ou linha filtra a lista. Cada gráfico
 * mostra todas as opções da sua dimensão (ignora o próprio filtro) mas respeita os filtros dos outros, então dois gráficos lado a
 * lado se combinam. A altura acompanha a quantidade de linhas: poucas opções não deixam espaço em branco.
 */
export function GraficoDimensao<T>({ itens, dims, medidas, ler, definir, busca, dimInicial, unidades, className }: PropsGrafico<T>) {
  const [chaveDim, setChaveDim] = React.useState(dimInicial);
  const [medidaChave, setMedidaChave] = React.useState("n");
  const [sobre, setSobre] = React.useState<string | null>(null);
  const dim = dims.find((d) => d.chave === chaveDim) ?? dims[0];
  const medida = medidas.find((m) => m.chave === medidaChave);
  const contar: Medida<T> = { chave: "n", rotulo: "Qtd", titulo: `Quantidade de ${unidades.plural}`, valor: () => 1, dinheiro: false };
  const opcoesMedida = [contar, ...medidas];
  const ativa = medida ?? contar;
  const selecionada = opcaoEscolhida(dim, ler);

  const base = filtrarItens(itens, dims, ler, busca, [dim.param]);
  const grupos = agruparPorDimensao(base, dim, ativa);
  const valorDe = (g: GrupoDimensao<T>) => g.soma;
  const total = grupos.reduce((s, g) => s + valorDe(g), 0);
  const maximo = Math.max(1, ...grupos.map(valorDe));
  const dinheiro = ativa.dinheiro;
  const fmt = (v: number) => (dinheiro ? brlCurto(v) : String(v));
  const corDe = (g: GrupoDimensao<T>, i: number) => g.cor ?? PALETA[i % PALETA.length];
  const escolher = (chave: string) => definir({ [dim.param]: chave });

  const ordenadas = grupos.map((g, i) => ({ g, cor: corDe(g, i) })).filter((x) => valorDe(x.g) > 0).sort((a, b) => valorDe(b.g) - valorDe(a.g));
  const fatias = ordenadas.slice(0, 8).map(({ g, cor }) => ({ chave: g.chave, rotulo: g.rotulo, v: valorDe(g), cor, clicavel: true }));
  const resto = ordenadas.slice(8).reduce((s, x) => s + valorDe(x.g), 0);
  if (resto > 0) fatias.push({ chave: "__demais", rotulo: "Demais", v: resto, cor: CINZA, clicavel: false });
  if (selecionada && !fatias.some((x) => x.chave === selecionada)) {
    const x = ordenadas.find((o) => o.g.chave === selecionada);
    if (x) fatias.splice(Math.max(0, fatias.length - 1), 0, { chave: x.g.chave, rotulo: x.g.rotulo, v: valorDe(x.g), cor: x.cor, clicavel: true });
  }

  const id = React.useId();
  return (
    <section aria-label={`Gráfico por ${dim.rotulo.toLowerCase()}`} style={{ flex: `${Math.max(5, grupos.length) + 2} 1 0%` }} className={cn("emd-grafico flex min-h-0 flex-col overflow-hidden", className)}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 pb-1.5 pt-2.5">
        <label className="relative">
          <span className="sr-only">Dimensão do gráfico</span>
          <select
            value={dim.chave}
            onChange={(e) => setChaveDim(e.target.value)}
            className="h-9 cursor-pointer appearance-none rounded-[0.75rem] border border-slate-300 bg-white py-0 pl-3 pr-8 text-sm font-semibold text-cataguases-marinho outline-none transition-shadow focus:border-[color:var(--modulo)] focus:ring-2 focus:ring-[color:var(--modulo)]/25"
          >
            {dims.map((d) => (
              <option key={d.chave} value={d.chave}>
                {d.rotulo}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.625rem] text-slate-500">
            ▾
          </span>
        </label>
        {selecionada && (
          <button type="button" onClick={() => escolher("")} title="Tirar o filtro deste gráfico" className="inline-flex h-7 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--modulo)_14%,transparent)] pl-2.5 pr-1.5 text-xs font-semibold text-[color:var(--modulo-tinta)] hover:bg-[color-mix(in_srgb,var(--modulo)_22%,transparent)]">
            filtrando
            <X className="h-3 w-3" aria-hidden />
            <span className="sr-only">Tirar o filtro deste gráfico</span>
          </button>
        )}
        {opcoesMedida.length > 1 && (
          <div role="group" aria-label="Medida" className="ml-auto inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
            {opcoesMedida.map((m) => (
              <button key={m.chave} type="button" title={m.titulo} aria-pressed={ativa.chave === m.chave} onClick={() => setMedidaChave(m.chave)} className={cn("h-7 rounded-md px-2.5 font-medium transition-colors", ativa.chave === m.chave ? "bg-white text-cataguases-marinho shadow-sm" : "text-slate-600 hover:text-cataguases-marinho")}>
                {m.rotulo}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(9.5rem,34%)_minmax(0,1fr)]">
        <div className="flex min-h-0 items-center justify-center py-1 pl-2 pr-1">
          <Pizza fatias={fatias} destaque={sobre} selecionada={selecionada} aoEscolher={escolher} dinheiro={dinheiro} className="aspect-square h-full max-h-[14.5rem] min-h-[4.5rem] w-auto max-w-full" rotuloTotal={dinheiro ? ativa.rotulo.toLowerCase() : unidades.plural} />
        </div>
        <ul id={id} className="emd-foco flex min-h-0 flex-col overflow-y-auto overscroll-contain py-0.5 pr-1 [&>li:first-child]:mt-auto [&>li:last-child]:mb-auto" aria-label={`Por ${dim.rotulo.toLowerCase()}`}>
          {grupos.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Nada a mostrar com esses filtros.</li>}
          {grupos.map((g, i) => {
            const v = valorDe(g);
            const ativo = selecionada === g.chave;
            const cor = corDe(g, i);
            const somas = medidas.filter((m) => m.dinheiro).map((m) => ({ m, v: g.itens.reduce((s, it) => s + m.valor(it), 0) }));
            return (
              <CaixaInfo
                key={g.chave}
                as="li"
                style={{ flex: "1 0 2.25rem", maxHeight: "2.75rem" }}
                className="flex"
                conteudo={
                  <>
                    <CaixaTitulo rotulo={dim.rotulo} valor={g.rotulo} lado={String(g.n)} ladoApoio={total && !dinheiro ? `${pctDe(v / total, 0)} do gráfico` : g.n === 1 ? unidades.singular : unidades.plural} />
                    {somas.length > 0 && <CaixaLinhas linhas={somas.map((s) => ({ rotulo: s.m.titulo, valor: brlCompleto(s.v) }))} />}
                    <CaixaNota>Clique para filtrar a lista por este item.</CaixaNota>
                  </>
                }
              >
                <button
                  type="button"
                  aria-pressed={ativo}
                  aria-label={`${g.rotulo}: ${g.n} ${g.n === 1 ? unidades.singular : unidades.plural}`}
                  onClick={() => escolher(ativo ? "" : g.chave)}
                  onMouseEnter={() => setSobre(g.chave)}
                  onMouseLeave={() => setSobre(null)}
                  onFocus={() => setSobre(g.chave)}
                  onBlur={() => setSobre(null)}
                  className={cn("grid h-full min-h-9 w-full grid-cols-[0.625rem_minmax(4.5rem,1fr)_minmax(1.5rem,3.5rem)_auto_2.25rem] items-center gap-x-2 rounded-lg px-2.5 py-0.5 text-left transition-colors", ativo ? "bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)]" : "hover:bg-slate-50")}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
                  <span className="truncate text-[0.8125rem] leading-tight text-cataguases-marinho">{g.rotulo}</span>
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <span className="emd-preenche" style={{ width: `${(v / maximo) * 100}%`, backgroundColor: cor }} />
                  </span>
                  <span className="whitespace-nowrap text-right text-[0.8125rem] font-semibold tabular-nums text-cataguases-marinho">{fmt(v)}</span>
                  <span className="text-right text-xs tabular-nums text-slate-500">{total ? pctDe(v / total, 0) : "0%"}</span>
                </button>
              </CaixaInfo>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
