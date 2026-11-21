"use client";

import * as React from "react";

import { useCatalogo } from "@/components/emendas/catalogo-etapas";
import { FiltrosAtivos, type FiltroAtivo } from "@/components/emendas/filtros-ativos";
import { useNovoDesign } from "@/components/emendas/design-emendas";
import { AnelAndamento } from "@/components/emendas/anel-andamento";
import { CINZA, PALETA, Pizza } from "@/components/emendas/pizza";
import { CATEGORIAS, INFO_CATEGORIA } from "@/lib/emendas/categorias";
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

export type Visao = "etapa" | "vereador" | "secretaria" | "financeiro" | "categoria" | "saude" | "pendencia" | "situacao" | "remanejada";
/** Toda dimensão de filtro da lista é uma aba: não há mais uma caixa de seletores repetindo o que o gráfico faz. */
export const VISOES: { chave: Visao; rotulo: string; param: ChaveLista }[] = [
  { chave: "etapa", rotulo: "Etapa", param: "etapa" },
  { chave: "vereador", rotulo: "Vereador", param: "v" },
  { chave: "secretaria", rotulo: "Secretaria", param: "s" },
  { chave: "financeiro", rotulo: "Situação financeira", param: "fin" },
  { chave: "categoria", rotulo: "Beneficiário", param: "cat" },
  { chave: "saude", rotulo: "Saúde", param: "sd" },
  { chave: "pendencia", rotulo: "Pendência", param: "pe" },
  { chave: "situacao", rotulo: "Situação", param: "situacao" },
  { chave: "remanejada", rotulo: "Remanejamento", param: "rem" },
];

export const COR_FINANCEIRA: Record<string, string> = { paga: "#563A9E", paga_parcial: "#9479DD", empenhada_sem_pagamento: "#C4B5F0", sem_empenho: "#94A3B8" };
const ZERO = { n: 0, valor: 0, empenhado: 0, pago: 0, comPendencia: 0 };
const NOME_SITUACAO: Record<string, string> = { normal: "Normal", impedida: "Impedida", cancelada: "Cancelada" };
const COR_SITUACAO: Record<string, string> = { normal: "#5C7A1F", impedida: "#B45309", cancelada: "#94A3B8" };

export type Medida = "n" | "valor" | "pago";
export type Item = GrupoLista & { cor: string };

/** Chips dos filtros que estão valendo (o tipo de execução já aparece nas abas da tela; a busca, na própria barra). */
export function chipsDosFiltros(f: FiltrosLista, emendas: EmendaResumo[], catalogo: ReturnType<typeof useCatalogo>): FiltroAtivo[] {
  const nomeDe = (campo: "vereador_id" | "secretaria_id", nome: (e: EmendaResumo) => string, id: string) => {
    const e = emendas.find((x) => x[campo] === id);
    return e ? nome(e) : id;
  };
  const chips = [
    f.v && { chave: "v", rotulo: `Vereador: ${nomeDe("vereador_id", (e) => `${numeroVereador(e.vereador_numero)} · ${e.vereador_nome}`, f.v)}` },
    f.s && { chave: "s", rotulo: `Secretaria: ${nomeDe("secretaria_id", (e) => e.secretaria_nome, f.s)}` },
    f.etapa && { chave: "etapa", rotulo: `Etapa: ${infoEtapa(f.etapa, catalogo).nome}` },
    f.fin && { chave: "fin", rotulo: `Financeiro: ${CLASSES_FINANCEIRAS.find(([k]) => k === f.fin)?.[1] ?? "Paga, sem data de pagamento"}` },
    f.cat && { chave: "cat", rotulo: `Beneficiário: ${INFO_CATEGORIA[f.cat as keyof typeof INFO_CATEGORIA]?.nome ?? f.cat}` },
    f.sd && { chave: "sd", rotulo: f.sd === "1" ? "Só Saúde" : "Fora da Saúde" },
    f.pe && { chave: "pe", rotulo: `Pendência: ${ASSUNTO_DA_REGRA[f.pe]?.nome ?? f.pe}` },
    f.p && { chave: "p", rotulo: "Só com pendência" },
    f.situacao && { chave: "situacao", rotulo: `Situação: ${NOME_SITUACAO[f.situacao] ?? f.situacao}` },
    f.rem && { chave: "rem", rotulo: f.rem === "1" ? "Remanejadas" : "Não remanejadas" },
    f.numeros.length > 0 && { chave: "numeros", rotulo: `Só as emendas do alerta (${f.numeros.length})` },
  ].filter(Boolean) as FiltroAtivo[];
  return chips;
}

/** Grupos de uma dimensão (Etapa, Vereador…) já filtrados pelos OUTROS filtros, com a cor de cada um. Serve a todo gráfico de filtro. */
export function itensDaVisao(visao: Visao, medida: Medida, emendas: EmendaResumo[], resumos: Record<string, ResumoLinha>, f: FiltrosLista, catalogo: ReturnType<typeof useCatalogo>): Item[] {
  const def = VISOES.find((v) => v.chave === visao)!;
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
        return colorir(ordenarPor(por((e) => (resumos[e.id]?.regras ?? []).map((r) => ({ chave: r, rotulo: ASSUNTO_DA_REGRA[r]?.nome ?? r })))));
      case "situacao": {
        const gs = por((e) => [{ chave: e.situacao, rotulo: NOME_SITUACAO[e.situacao] ?? e.situacao }]);
        return Object.keys(NOME_SITUACAO).map((k) => ({ ...achar(gs, k, NOME_SITUACAO[k]), cor: COR_SITUACAO[k] }));
      }
      case "remanejada": {
        const gs = por((e) => [{ chave: e.remanejada ? "1" : "0", rotulo: e.remanejada ? "Remanejadas" : "Não remanejadas" }]);
        return [
          { ...achar(gs, "1", "Remanejadas"), cor: "#6B4FBB" },
          { ...achar(gs, "0", "Não remanejadas"), cor: CINZA },
        ];
      }
    }
}

/**
 * Dashboard da lista de Emendas, numa caixa só: barra enxuta (busca e ordem), filtros ativos em chips, indicadores,
 * abas por dimensão e, abaixo, a pizza ao lado do ranking. Clicar numa fatia, linha ou aba aplica o filtro na lista;
 * cada visão ignora o próprio filtro para sempre mostrar todas as opções.
 */
export function PainelLista({
  emendas,
  resumos,
  filtros,
  definir,
  barra,
  aoLimparTudo,
  compacto = false,
}: {
  emendas: EmendaResumo[];
  resumos: Record<string, ResumoLinha>;
  filtros: FiltrosLista;
  definir: (m: Record<string, string>) => void;
  /** Busca e ordem, desenhadas pela lista para dividir o mesmo estado. */
  barra: React.ReactNode;
  aoLimparTudo: () => void;
  /** Dentro da área de trabalho (painel estreito ao lado da lista): sem barra de busca nem chips (a lista os mostra), indicadores em 2 colunas. */
  compacto?: boolean;
}) {
  const f = filtros;
  const catalogo = useCatalogo();
  const novo = useNovoDesign();
  const [visao, setVisao] = React.useState<Visao>("etapa");
  const [medida, setMedida] = React.useState<Medida>("n");
  /** Linha do ranking sob o cursor: realça a fatia correspondente da pizza. */
  const [sobreChave, setSobreChave] = React.useState<string | null>(null);

  const filtradas = filtrarEmendasLista(emendas, resumos, f);
  const tot = somar(filtradas, resumos);
  const todas = somar(emendas, resumos);
  const faixa = faixaFinanceira(filtradas);
  const faixaTotal = faixa.pago + faixa.aPagar + faixa.semEmpenho;

  const def = VISOES.find((v) => v.chave === visao)!;
  const selecionada = String(f[def.param as keyof FiltrosLista] ?? "");
  const numerosDoAlerta = f.numeros.join(",");

  const itens: Item[] = React.useMemo(
    () => itensDaVisao(visao, medida, emendas, resumos, f, catalogo),
    // `f` entra pelos campos que ele tem
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visao, medida, emendas, resumos, catalogo, f.v, f.s, f.etapa, f.t, f.p, f.situacao, f.fin, f.sd, f.cat, f.rem, f.pe, f.q, numerosDoAlerta]
  );

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

  const chips = chipsDosFiltros(f, emendas, catalogo);
  const nomeDe = (campo: "vereador_id" | "secretaria_id", nome: (e: EmendaResumo) => string, id: string) => {
    const e = emendas.find((x) => x[campo] === id);
    return e ? nome(e) : id;
  };

  /** O que está escolhido numa aba (nome curto e cor), para a aba dizer sozinha que há filtro nela. */
  const filtroDaAba = (param: ChaveLista): { rotulo: string; cor: string } | null => {
    const valor = String(f[param as keyof FiltrosLista] ?? "");
    if (!valor) return null;
    switch (param) {
      case "v":
        return { rotulo: nomeDe("vereador_id", (e) => `${numeroVereador(e.vereador_numero)} · ${e.vereador_nome}`, valor), cor: "var(--modulo)" };
      case "s":
        return { rotulo: nomeDe("secretaria_id", (e) => e.secretaria_nome, valor), cor: "var(--modulo)" };
      case "etapa": {
        const et = infoEtapa(valor, catalogo);
        return { rotulo: et.nome, cor: et.cor === "#CBD5E1" ? CINZA : et.cor };
      }
      case "fin":
        return { rotulo: CLASSES_FINANCEIRAS.find(([k]) => k === valor)?.[1] ?? "Paga, sem data", cor: COR_FINANCEIRA[valor] ?? CINZA };
      case "cat": {
        const c = INFO_CATEGORIA[valor as keyof typeof INFO_CATEGORIA];
        return { rotulo: c?.nome ?? valor, cor: c?.cor ?? CINZA };
      }
      case "sd":
        return { rotulo: valor === "1" ? "Saúde" : "Fora da Saúde", cor: valor === "1" ? "#0E7490" : CINZA };
      case "pe":
        return { rotulo: ASSUNTO_DA_REGRA[valor]?.nome ?? valor, cor: "var(--modulo)" };
      case "situacao":
        return { rotulo: NOME_SITUACAO[valor] ?? valor, cor: COR_SITUACAO[valor] ?? CINZA };
      case "rem":
        return { rotulo: valor === "1" ? "Remanejadas" : "Não remanejadas", cor: valor === "1" ? "#6B4FBB" : CINZA };
      default:
        return null;
    }
  };

  // De onde vem o valor pago: totalmente pagas + pagas em parte (as demais classes não têm pagamento).
  const pagoPorClasse = { paga: 0, paga_parcial: 0 };
  for (const e of filtradas) {
    const c = classeFinanceira(e);
    if (c === "paga" || c === "paga_parcial") pagoPorClasse[c] += e.pago;
  }

  // Andamento médio: fases concluídas ÷ fases aplicáveis de cada emenda, em média simples (cada emenda pesa igual).
  const comFases = filtradas.filter((e) => (resumos[e.id]?.total ?? 0) > 0);
  const fasesFeitas = comFases.reduce((s, e) => s + resumos[e.id].concluidas / resumos[e.id].total, 0);
  const andamentoMedio = comFases.length ? Math.round((fasesFeitas / comFases.length) * 100) : 0;
  const completas = comFases.filter((e) => resumos[e.id].concluidas === resumos[e.id].total).length;

  const celula = "min-w-0 px-5 py-3.5";
  const numero = "whitespace-nowrap text-xl font-semibold leading-tight tabular-nums text-cataguases-marinho sm:text-2xl";
  const parte = (v: number) => (faixaTotal ? `${(v / faixaTotal) * 100}%` : "0%");

  return (
    <section aria-label="Visão geral das emendas" className={compacto ? "h-full overflow-y-auto overscroll-contain" : "rounded-xl border border-slate-200 bg-white"}>
      {/* quanto do valor indicado já foi pago, só empenhado e ainda sem empenho, como um fio no topo da caixa */}
      <div
        className="flex h-1 overflow-hidden rounded-t-xl bg-slate-100"
        role="img"
        aria-label={`Do valor indicado: ${brlCurto(faixa.pago)} pagos, ${brlCurto(faixa.aPagar)} empenhados a pagar, ${brlCurto(faixa.semEmpenho)} sem empenho`}
      >
        <span className="emd-preenche" style={{ width: parte(faixa.pago), backgroundColor: COR_FINANCEIRA.paga }} />
        <span className="emd-preenche" style={{ width: parte(faixa.aPagar), backgroundColor: COR_FINANCEIRA.paga_parcial }} />
        <span className="emd-preenche" style={{ width: parte(faixa.semEmpenho), backgroundColor: COR_FINANCEIRA.sem_empenho }} />
      </div>

      {!compacto && <div className="border-b border-slate-200 px-4 py-3 print:hidden">{barra}</div>}
      {!compacto && <FiltrosAtivos filtros={chips} aoRemover={(k) => definir({ [k]: "" })} aoLimparTudo={aoLimparTudo} />}

      {compacto ? (
        <div className="border-b border-slate-200">
          <dl className="grid grid-cols-4 divide-x divide-slate-200">
            {(
              [
                ["Emendas", String(tot.n), `de ${todas.n}`],
                ["Indicado", brlCurto(tot.valor), todas.valor ? `${pct(tot.valor / todas.valor, 0)} do exercício` : ""],
                ["Empenhado", brlCurto(tot.empenhado), tot.valor ? `${pct(tot.empenhado / tot.valor, 0)} do indicado` : ""],
                ["Pago", brlCurto(tot.pago), tot.valor ? `${pct(tot.pago / tot.valor, 0)} do indicado` : ""],
              ] as const
            ).map(([rotulo, valor, apoio]) => (
              <div key={rotulo} className="min-w-0 px-3.5 py-3">
                <dt className="text-xs font-medium text-slate-600">{rotulo}</dt>
                <dd>
                  <span className="block truncate text-lg font-semibold leading-tight tabular-nums text-cataguases-marinho">{valor}</span>
                  <span className="block truncate text-xs tabular-nums text-slate-500">{apoio}</span>
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-slate-200 px-3.5 py-2.5 text-xs text-slate-600">
            <button
              type="button"
              aria-pressed={f.p === "1"}
              onClick={() => definir({ p: f.p === "1" ? "" : "1" })}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 font-medium tabular-nums text-[color:var(--modulo-tinta)] ${f.p === "1" ? "bg-[color-mix(in_srgb,var(--modulo)_16%,transparent)]" : "hover:bg-[color-mix(in_srgb,var(--modulo)_10%,transparent)]"}`}
              title={f.p === "1" ? "Mostrar todas" : "Mostrar só as que têm pendência"}
            >
              {tot.comPendencia} com pendência
            </button>
            {novo && (
              <span className="inline-flex items-center gap-2">
                <AnelAndamento concluidas={andamentoMedio} total={100} tamanho={34} espessura={4} />
                <span className="leading-tight">Andamento médio<br />das fases cumpridas</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-600">
            <span className="font-medium">Do valor indicado:</span>
            {([["paga", "pago", faixa.pago], ["paga_parcial", "a pagar", faixa.aPagar], ["sem_empenho", "sem empenho", faixa.semEmpenho]] as const).map(([k, nome, v]) => (
              <span key={k} className="inline-flex items-center gap-1.5 tabular-nums">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_FINANCEIRA[k] }} aria-hidden />
                {nome} {faixaTotal ? pct(v / faixaTotal, 0) : "0%"}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <>
      <dl className={`grid grid-cols-2 divide-slate-200 border-b border-slate-200 max-lg:[&>div:nth-child(n+3)]:border-t max-lg:[&>div:nth-child(even)]:border-l max-lg:[&>div]:border-slate-200 ${compacto ? "" : novo ? "lg:grid-cols-5" : "lg:grid-cols-4"} ${compacto ? "" : "lg:divide-x"}`}>
        <div className={celula}>
          <dt className="text-xs font-medium text-slate-600">Emendas</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className={numero}>{tot.n}</span>
            <span className="text-xs tabular-nums text-slate-600">de {todas.n}</span>
            <button
              type="button"
              aria-pressed={f.p === "1"}
              onClick={() => definir({ p: f.p === "1" ? "" : "1" })}
              title={f.p === "1" ? "Mostrar todas" : "Mostrar só as que têm pendência"}
              className={`min-h-7 rounded-md px-1.5 text-xs font-medium tabular-nums underline-offset-2 hover:underline ${f.p === "1" ? "bg-[color-mix(in_srgb,var(--modulo)_14%,transparent)]" : ""} text-[color:var(--modulo-tinta)]`}
            >
              {tot.comPendencia} com pendência
            </button>
          </dd>
        </div>
        <div className={celula}>
          <dt className="text-xs font-medium text-slate-600">Valor indicado (soma das emendas)</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className={numero}>{brlCurto(tot.valor)}</span>
            <span className="text-xs tabular-nums text-slate-600">{todas.valor ? pct(tot.valor / todas.valor, 0) : "0%"} do exercício</span>
          </dd>
        </div>
        <div className={celula}>
          <dt className="text-xs font-medium text-slate-600">Empenhado (reservado para pagar)</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className={numero}>{brlCurto(tot.empenhado)}</span>
            <span className="text-xs tabular-nums text-slate-600">{tot.valor ? pct(tot.empenhado / tot.valor, 0) : "0%"} do indicado</span>
          </dd>
        </div>
        <div className={celula}>
          <dt className="text-xs font-medium text-slate-600">Pago (tudo o que já saiu)</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className={numero}>{brlCurto(tot.pago)}</span>
            <span className="text-xs tabular-nums text-slate-600">{tot.valor ? pct(tot.pago / tot.valor, 0) : "0%"} do indicado</span>
            {tot.pago > 0 && (
              <span className="basis-full text-xs leading-snug text-slate-600">
                {pagoPorClasse.paga > 0 && <>{brlCurto(pagoPorClasse.paga)} de emendas totalmente pagas</>}
                {pagoPorClasse.paga > 0 && pagoPorClasse.paga_parcial > 0 && " + "}
                {pagoPorClasse.paga_parcial > 0 && <>{brlCurto(pagoPorClasse.paga_parcial)} de emendas pagas em parte</>}
              </span>
            )}
          </dd>
        </div>
        {novo && (
        <div className={`${celula} ${compacto ? "col-span-2 border-t border-slate-200" : ""}`}>
          <dt className="text-xs font-medium text-slate-600">Andamento médio</dt>
          <dd className="flex items-center gap-3">
            <AnelAndamento concluidas={andamentoMedio} total={100} tamanho={48} />
            <span className="text-xs leading-snug text-slate-600">
              <span className="block">das fases cumpridas</span>
              <span className="block tabular-nums">{completas} completas</span>
            </span>
          </dd>
        </div>
        )}
      </dl>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 px-5 py-2 text-xs text-slate-600">
        <span className="font-medium">Do valor indicado:</span>
        {([["paga", "pago", faixa.pago], ["paga_parcial", "empenhado, falta pagar", faixa.aPagar], ["sem_empenho", "ainda sem empenho", faixa.semEmpenho]] as const).map(([k, nome, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5 tabular-nums">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_FINANCEIRA[k] }} aria-hidden />
            {nome} {brlCurto(v)} ({faixaTotal ? pct(v / faixaTotal, 0) : "0%"})
          </span>
        ))}
      </p>
        </>
      )}

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
            const sel = filtroDaAba(v.param);
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
                className={`relative inline-flex min-h-11 items-center gap-1.5 px-2.5 text-sm transition-colors motion-reduce:transition-none sm:min-h-10 sm:px-3 ${
                  ativa ? "font-semibold text-cataguases-marinho" : "font-medium text-slate-600 hover:text-cataguases-marinho"
                } ${sel ? "bg-[color-mix(in_srgb,var(--modulo)_9%,transparent)]" : ""}`}
              >
                {v.rotulo}
                {sel && (
                  <span
                    className="inline-flex max-w-[10rem] items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--modulo)_16%,transparent)] py-0.5 pl-1.5 pr-2 text-xs font-semibold text-[color:var(--modulo-tinta)] ring-1 ring-inset ring-[color:var(--modulo-tinta)]/40"
                    title={`Filtro ativo nesta aba: ${sel.rotulo}`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: sel.cor }} aria-hidden />
                    <span className="truncate">{sel.rotulo}</span>
                    <span className="sr-only"> (filtro ativo)</span>
                  </span>
                )}
                {ativa && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ backgroundColor: "var(--modulo)" }} aria-hidden />}
              </button>
            );
          })}
        </div>
        <div role="group" aria-label="Medida" className="my-1 inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {([["n", visao === "pendencia" ? "Pendências" : "Emendas"], ["valor", "Valor indicado"], ["pago", "Valor pago"]] as const).map(([m, rotulo]) => (
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

      <div id="painel-lista-corpo" role="tabpanel" aria-labelledby={`aba-lista-${visao}`} className={compacto ? "grid grid-cols-[9.5rem_1fr]" : "grid lg:grid-cols-[17.5rem_1fr]"}>
        <div className={`flex items-center justify-center ${compacto ? "border-r border-slate-200 p-3" : "p-5 max-lg:border-b max-lg:border-slate-200 lg:border-r lg:border-slate-200"}`}>
          <Pizza
            fatias={fatias}
            selecionada={selecionada}
            aoEscolher={escolher}
            dinheiro={dinheiro}
            destaque={sobreChave}
            className={compacto ? "h-[8.25rem] w-[8.25rem]" : undefined}
            rotuloTotal={medida === "valor" ? "indicados" : medida === "pago" ? "pagos" : visao === "pendencia" ? "pendências" : "emendas"}
          />
        </div>

        <div className="min-w-0">
        <p className="px-6 pb-1 pt-3 text-xs leading-snug text-slate-600">
          {medida === "n" && (visao === "pendencia" ? "Quantas pendências há em cada assunto." : "Quantas emendas há em cada grupo.")}
          {medida === "valor" && "Valor indicado: o valor total de cada emenda, esteja ou não pago."}
          {medida === "pago" && "Valor pago: quanto já foi pago nas emendas de cada grupo."}
          {visao === "financeiro" && " Totalmente paga = pago igual ao valor da emenda; paga em parte = pagou algo, mas menos que o valor; empenhada, sem pagamento = reservada, nada pago."}
        </p>
        <ul className={`emd-foco py-1 ${compacto ? "" : "max-h-72 overflow-y-auto overscroll-contain lg:max-h-[16rem]"}`} aria-label={`Por ${def.rotulo.toLowerCase()}`}>
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
                  onMouseEnter={() => setSobreChave(i.chave)}
                  onMouseLeave={() => setSobreChave(null)}
                  onFocus={() => setSobreChave(i.chave)}
                  onBlur={() => setSobreChave(null)}
                  className={`grid min-h-11 w-full grid-cols-[0.625rem_minmax(0,1fr)_auto_2.25rem] items-center gap-x-3 px-6 py-1 text-left transition-colors motion-reduce:transition-none sm:min-h-10 sm:grid-cols-[0.625rem_minmax(9rem,16rem)_minmax(0,1fr)_auto_2.5rem] ${
                    ativo ? "bg-violet-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.cor }} aria-hidden />
                  <span className="text-sm leading-snug text-cataguases-marinho">{i.rotulo}</span>
                  <span className="hidden h-2 overflow-hidden rounded-full bg-slate-100 sm:flex" aria-hidden>
                    <span className="emd-preenche" style={{ width: `${(v / maximo) * 100}%`, backgroundColor: i.cor }} />
                  </span>
                  <span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-cataguases-marinho">{fmt(v)}</span>
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
      </div>
    </section>
  );
}
