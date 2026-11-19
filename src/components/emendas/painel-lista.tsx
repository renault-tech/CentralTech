"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { useCatalogo } from "@/components/emendas/catalogo-etapas";
import { CINZA, PALETA, Pizza } from "@/components/emendas/pizza";
import { CATEGORIAS, INFO_CATEGORIA } from "@/lib/emendas/categorias";
import { ORDEM_TIPOS, TIPOS_EXECUCAO, tipoDaEmenda } from "@/lib/emendas/fases";
import {
  agruparLista,
  CLASSES_FINANCEIRAS,
  classeFinanceira,
  faixaFinanceira,
  filtrarEmendasLista,
  somar,
  type ChaveLista,
  type FiltrosLista,
  type GrupoLista,
} from "@/lib/emendas/painel-lista";
import { ASSUNTO_DA_REGRA } from "@/lib/emendas/pendencias";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { brlCurto, etapasEmOrdem, infoEtapa, numeroVereador, pct } from "@/lib/emendas/regras";
import type { EmendaResumo } from "@/types/emendas";

type Visao = "etapa" | "tipo" | "vereador" | "secretaria" | "financeiro" | "categoria" | "saude" | "pendencia";
const VISOES: { chave: Visao; rotulo: string; param: ChaveLista }[] = [
  { chave: "etapa", rotulo: "Etapa", param: "etapa" },
  { chave: "tipo", rotulo: "Tipo", param: "t" },
  { chave: "vereador", rotulo: "Vereador", param: "v" },
  { chave: "secretaria", rotulo: "Secretaria", param: "s" },
  { chave: "financeiro", rotulo: "Situação financeira", param: "fin" },
  { chave: "categoria", rotulo: "Beneficiário", param: "cat" },
  { chave: "saude", rotulo: "Saúde", param: "sd" },
  { chave: "pendencia", rotulo: "Pendência", param: "pe" },
];

const COR_FINANCEIRA: Record<string, string> = { paga: "#563A9E", paga_parcial: "#9479DD", empenhada_sem_pagamento: "#C4B5F0", sem_empenho: "#94A3B8" };
const ZERO = { n: 0, valor: 0, empenhado: 0, pago: 0, comPendencia: 0 };

type Medida = "n" | "valor" | "pago";
type Item = GrupoLista & { cor: string };

/**
 * Dashboard da lista de Emendas, na mesma caixa dos filtros: indicadores, abas por dimensão e, abaixo, a pizza
 * ao lado do ranking. Responde a TODOS os filtros da lista (e escolher uma fatia ou linha aplica o mesmo filtro).
 * Cada visão ignora o próprio filtro para sempre mostrar todas as opções.
 */
export function PainelLista({
  emendas,
  resumos,
  filtros,
  definir,
  controles,
}: {
  emendas: EmendaResumo[];
  resumos: Record<string, ResumoLinha>;
  filtros: FiltrosLista;
  definir: (m: Record<string, string>) => void;
  /** Linha de filtros e busca, desenhada pela lista para dividir o mesmo estado. */
  controles: React.ReactNode;
}) {
  const f = filtros;
  const catalogo = useCatalogo();
  const [visao, setVisao] = React.useState<Visao>("etapa");
  const [medida, setMedida] = React.useState<Medida>("n");
  const [filtrosAbertos, setFiltrosAbertos] = React.useState(false);
  // quantos filtros estão valendo (o exercício e a ordem não contam: não restringem a lista)
  const ativos = [f.v, f.s, f.etapa, f.t, f.p, f.situacao, f.fin, f.sd, f.cat, f.rem, f.pe, f.q].filter(Boolean).length + (f.numeros.length ? 1 : 0);

  const filtradas = filtrarEmendasLista(emendas, resumos, f);
  const tot = somar(filtradas, resumos);
  const todas = somar(emendas, resumos);
  const faixa = faixaFinanceira(filtradas);
  const faixaTotal = faixa.pago + faixa.aPagar + faixa.semEmpenho;

  const def = VISOES.find((v) => v.chave === visao)!;
  const selecionada = String(f[def.param as keyof FiltrosLista] ?? "");
  const numerosDoAlerta = f.numeros.join(",");

  const itens: Item[] = React.useMemo(() => {
    const base = filtrarEmendasLista(emendas, resumos, f, [def.param]);
    const por = (chaves: (e: EmendaResumo) => { chave: string; rotulo: string }[]) => agruparLista(base, resumos, chaves);
    const achar = (gs: GrupoLista[], chave: string, rotulo: string): GrupoLista => gs.find((g) => g.chave === chave) ?? { ...ZERO, chave, rotulo };
    const ordenarPor = (gs: GrupoLista[]) => gs.sort((a, b) => b[medida] - a[medida] || a.rotulo.localeCompare(b.rotulo));
    const colorir = (gs: GrupoLista[]): Item[] => gs.map((g, i) => ({ ...g, cor: i < PALETA.length ? PALETA[i] : CINZA }));

    switch (visao) {
      case "etapa": {
        const gs = por((e) => [{ chave: e.etapa, rotulo: infoEtapa(e.etapa, catalogo).nome }]);
        const emOrdem = etapasEmOrdem(catalogo, new Set(emendas.map((e) => e.etapa)))
          .filter((et) => gs.some((g) => g.chave === et.chave))
          .map((et) => ({ ...achar(gs, et.chave, et.nome), cor: et.cor === "#CBD5E1" ? CINZA : et.cor }));
        // etapa que não está em nenhum fluxo do catálogo (dado antigo) entra no fim: a soma sempre fecha com a lista
        const fora = gs.filter((g) => !emOrdem.some((x) => x.chave === g.chave)).map((g) => ({ ...g, cor: CINZA }));
        return [...emOrdem, ...fora];
      }
      case "tipo": {
        const gs = por((e) => [{ chave: tipoDaEmenda(e), rotulo: TIPOS_EXECUCAO[tipoDaEmenda(e)].nome }]);
        return ORDEM_TIPOS.map((t) => ({ ...achar(gs, t, TIPOS_EXECUCAO[t].nome), cor: TIPOS_EXECUCAO[t].cor }));
      }
      case "vereador":
        return colorir(ordenarPor(por((e) => [{ chave: e.vereador_id, rotulo: `${numeroVereador(e.vereador_numero)} · ${e.vereador_nome}` }])));
      case "secretaria":
        return colorir(ordenarPor(por((e) => [{ chave: e.secretaria_id, rotulo: e.secretaria_nome }])));
      case "financeiro": {
        const gs = por((e) => {
          const c = classeFinanceira(e);
          return [{ chave: c, rotulo: CLASSES_FINANCEIRAS.find(([k]) => k === c)![1] }];
        });
        return CLASSES_FINANCEIRAS.map(([k, nome]) => ({ ...achar(gs, k, nome), cor: COR_FINANCEIRA[k] }));
      }
      case "categoria": {
        const gs = por((e) => {
          const c = e.beneficiario_categoria;
          return [{ chave: c ?? "sem_categoria", rotulo: (c && INFO_CATEGORIA[c]?.nome) || "Sem categoria" }];
        });
        return CATEGORIAS.filter((c) => gs.some((g) => g.chave === c)).map((c) => ({ ...achar(gs, c, INFO_CATEGORIA[c].nome), cor: INFO_CATEGORIA[c].cor }));
      }
      case "saude": {
        const gs = por((e) => [{ chave: e.saude ? "1" : "0", rotulo: e.saude ? "Saúde" : "Fora da Saúde" }]);
        return [
          { ...achar(gs, "1", "Saúde"), cor: "#0E7490" },
          { ...achar(gs, "0", "Fora da Saúde"), cor: CINZA },
        ];
      }
      case "pendencia":
        // uma emenda com duas pendências conta em cada assunto: a soma passa do número de emendas
        return colorir(
          ordenarPor(por((e) => (resumos[e.id]?.regras ?? []).map((r) => ({ chave: r, rotulo: ASSUNTO_DA_REGRA[r]?.nome ?? r }))))
        );
    }
    // `f` entra pelos campos que ele tem; `def.param` já sai de `visao`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao, medida, emendas, resumos, catalogo, f.v, f.s, f.etapa, f.t, f.p, f.situacao, f.fin, f.sd, f.cat, f.rem, f.pe, f.q, numerosDoAlerta]);

  const valorDe = (i: GrupoLista) => i[medida];
  const total = itens.reduce((s, i) => s + valorDe(i), 0);
  const maximo = Math.max(1, ...itens.map(valorDe));
  const dinheiro = medida !== "n";
  const fmt = (v: number) => (dinheiro ? brlCurto(v) : String(v));
  const escolher = (chave: string) => definir({ [def.param]: chave });

  // Pizza: as 8 maiores fatias e um "demais" agregado (não clicável) para não virar confete.
  const ordenadas = [...itens].filter((i) => valorDe(i) > 0).sort((a, b) => valorDe(b) - valorDe(a));
  const fatias = ordenadas.slice(0, 8).map((i) => ({ chave: i.chave, rotulo: i.rotulo, v: valorDe(i), cor: i.cor, clicavel: true }));
  const resto = ordenadas.slice(8).reduce((s, i) => s + valorDe(i), 0);
  if (resto > 0) fatias.push({ chave: "__demais", rotulo: "Demais", v: resto, cor: CINZA, clicavel: false });
  if (selecionada && !fatias.some((x) => x.chave === selecionada)) {
    const i = itens.find((x) => x.chave === selecionada);
    if (i && valorDe(i) > 0) fatias.splice(fatias.length - 1, 0, { chave: i.chave, rotulo: i.rotulo, v: valorDe(i), cor: i.cor, clicavel: true });
  }

  const celula = "min-w-0 px-5 py-3.5";
  const numero = "whitespace-nowrap text-xl font-semibold leading-tight tabular-nums text-cataguases-marinho sm:text-2xl";
  const parte = (v: number) => (faixaTotal ? `${(v / faixaTotal) * 100}%` : "0%");

  return (
    <section aria-label="Visão geral das emendas" className="rounded-xl border border-slate-200 bg-white">
      {/* quanto do valor indicado já foi pago, só empenhado e ainda sem empenho, como um fio no topo da caixa */}
      <div
        className="flex h-1 overflow-hidden rounded-t-xl bg-slate-100"
        role="img"
        aria-label={`Do valor indicado: ${brlCurto(faixa.pago)} pagos, ${brlCurto(faixa.aPagar)} empenhados a pagar, ${brlCurto(faixa.semEmpenho)} sem empenho`}
      >
        <span style={{ width: parte(faixa.pago), backgroundColor: COR_FINANCEIRA.paga }} />
        <span style={{ width: parte(faixa.aPagar), backgroundColor: COR_FINANCEIRA.paga_parcial }} />
        <span style={{ width: parte(faixa.semEmpenho), backgroundColor: COR_FINANCEIRA.sem_empenho }} />
      </div>

      <div className="border-b border-slate-200 px-4 py-3.5">
        {/* no celular os filtros ficam recolhidos para os números aparecerem primeiro; do tablet para cima ficam sempre à mostra */}
        <button
          type="button"
          aria-expanded={filtrosAbertos}
          aria-controls="filtros-lista"
          onClick={() => setFiltrosAbertos((a) => !a)}
          className="flex min-h-11 w-full items-center justify-between rounded-lg text-sm font-medium text-cataguases-marinho sm:hidden"
        >
          <span>
            Filtros{ativos > 0 && <span className="ml-2 rounded-full bg-[color:var(--modulo-texto)] px-2 py-px text-xs font-medium text-white">{ativos}</span>}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${filtrosAbertos ? "rotate-180" : ""}`} aria-hidden />
        </button>
        <div id="filtros-lista" className={`${filtrosAbertos ? "mt-2 block" : "hidden"} sm:mt-0 sm:block`}>
          {controles}
        </div>
      </div>

      <dl className="grid grid-cols-2 divide-slate-200 border-b border-slate-200 max-lg:[&>div:nth-child(n+3)]:border-t max-lg:[&>div:nth-child(even)]:border-l max-lg:[&>div]:border-slate-200 lg:grid-cols-4 lg:divide-x">
        <div className={celula}>
          <dt className="text-xs font-medium text-slate-600">Emendas</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className={numero}>{tot.n}</span>
            <span className="text-xs tabular-nums text-slate-600">
              de {todas.n} · {tot.comPendencia} com pendência
            </span>
          </dd>
        </div>
        <div className={celula}>
          <dt className="text-xs font-medium text-slate-600">Valor indicado</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className={numero}>{brlCurto(tot.valor)}</span>
            <span className="text-xs tabular-nums text-slate-600">{todas.valor ? pct(tot.valor / todas.valor, 0) : "0%"} do exercício</span>
          </dd>
        </div>
        <div className={celula}>
          <dt className="text-xs font-medium text-slate-600">Empenhado</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className={numero}>{brlCurto(tot.empenhado)}</span>
            <span className="text-xs tabular-nums text-slate-600">{tot.valor ? pct(tot.empenhado / tot.valor, 0) : "0%"} do indicado</span>
          </dd>
        </div>
        <div className={celula}>
          <dt className="text-xs font-medium text-slate-600">Pago</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className={numero}>{brlCurto(tot.pago)}</span>
            <span className="text-xs tabular-nums text-slate-600">{tot.valor ? pct(tot.pago / tot.valor, 0) : "0%"} do indicado</span>
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-slate-200 px-2">
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
            document.getElementById(`aba-lista-${VISOES[novo].chave}`)?.focus();
          }}
        >
          {VISOES.map((v) => {
            const ativa = v.chave === visao;
            const filtrada = !!f[v.param as keyof FiltrosLista];
            return (
              <button
                key={v.chave}
                type="button"
                role="tab"
                id={`aba-lista-${v.chave}`}
                aria-selected={ativa}
                aria-controls="painel-lista-corpo"
                tabIndex={ativa ? 0 : -1}
                onClick={() => setVisao(v.chave)}
                className={`relative inline-flex min-h-11 items-center gap-1.5 px-2.5 text-[13px] font-medium transition-colors motion-reduce:transition-none sm:min-h-10 sm:px-3 ${
                  ativa ? "text-cataguases-marinho" : "text-slate-600 hover:text-cataguases-marinho"
                }`}
              >
                {v.rotulo}
                {filtrada && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--modulo)" }} title="Filtro ativo" />}
                {ativa && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ backgroundColor: "var(--modulo)" }} aria-hidden />}
              </button>
            );
          })}
        </div>
        <div role="group" aria-label="Medida" className="my-1 inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {([["n", visao === "pendencia" ? "Pendências" : "Emendas"], ["valor", "Valor"], ["pago", "Pago"]] as const).map(([m, rotulo]) => (
            <button
              key={m}
              type="button"
              aria-pressed={medida === m}
              onClick={() => setMedida(m)}
              className={`min-h-11 rounded-md px-3 font-medium transition-colors motion-reduce:transition-none sm:min-h-8 sm:px-2.5 ${medida === m ? "bg-white text-cataguases-marinho shadow-sm" : "text-slate-600"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div id="painel-lista-corpo" role="tabpanel" aria-labelledby={`aba-lista-${visao}`} className="grid lg:grid-cols-[280px_1fr]">
        <div className="flex items-center justify-center p-5 max-lg:border-b max-lg:border-slate-200 lg:border-r lg:border-slate-200">
          <Pizza
            fatias={fatias}
            selecionada={selecionada}
            aoEscolher={escolher}
            dinheiro={dinheiro}
            rotuloTotal={medida === "valor" ? "indicados" : medida === "pago" ? "pagos" : visao === "pendencia" ? "pendências" : "emendas"}
          />
        </div>

        <ul className="max-h-60 overflow-y-auto overscroll-contain py-2 lg:max-h-[236px]" aria-label={`Por ${def.rotulo.toLowerCase()}`}>
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
                  className={`grid min-h-11 w-full grid-cols-[10px_minmax(0,1fr)_auto_36px] items-center gap-x-3 px-6 py-1 text-left transition-colors motion-reduce:transition-none sm:min-h-9 sm:grid-cols-[10px_minmax(0,14rem)_minmax(0,1fr)_auto_40px] ${
                    ativo ? "bg-violet-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.cor }} aria-hidden />
                  <span className="truncate text-[13px] text-cataguases-marinho">{i.rotulo}</span>
                  <span className="hidden h-2 overflow-hidden rounded-full bg-slate-100 sm:flex" aria-hidden>
                    <span style={{ width: `${(v / maximo) * 100}%`, backgroundColor: i.cor }} />
                  </span>
                  <span className="whitespace-nowrap text-right text-[13px] font-semibold tabular-nums text-cataguases-marinho">{fmt(v)}</span>
                  <span className="text-right text-xs tabular-nums text-slate-600">{total ? pct(v / total, 0) : "0%"}</span>
                </button>
              </li>
            );
          })}
          {visao === "pendencia" && itens.length > 0 && (
            <li className="px-6 pb-1 pt-2 text-xs text-slate-600">Uma emenda com mais de uma pendência conta em cada assunto. Para o detalhe, abra a aba Pendências.</li>
          )}
        </ul>
      </div>
    </section>
  );
}
