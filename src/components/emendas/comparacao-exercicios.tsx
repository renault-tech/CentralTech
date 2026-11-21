import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarClock, Minus } from "lucide-react";

import { brlCurto, pct } from "@/lib/emendas/regras";
import { compararExercicios, type LinhaComparacao, type TotaisExercicio } from "@/lib/emendas/comparacao";
import { cn } from "@/lib/utils";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatar(l: LinhaComparacao, v: number): string {
  if (l.formato === "moeda") return brlCurto(v);
  if (l.formato === "percentual") return pct(v, 1);
  return v.toLocaleString("pt-BR");
}

/** "+12%", "−3,5 p.p.", "igual", "novo": a seta e o texto dizem o sentido; a cor só diz se é bom (verde) ou ruim (âmbar). */
function Delta({ l }: { l: LinhaComparacao }) {
  const v = l.variacao;
  if (v.sentido === "igual") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        <Minus className="h-3 w-3" aria-hidden /> igual
      </span>
    );
  }
  const alta = v.diferenca > 0;
  const bom = l.bomQuando === "neutro" ? null : (l.bomQuando === "alta") === alta;
  const texto =
    l.formato === "percentual"
      ? `${alta ? "+" : "−"}${Math.abs(v.diferenca * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`
      : v.relativa === null
        ? "novo"
        : `${alta ? "+" : "−"}${Math.abs(v.relativa * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
  const Seta = alta ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        bom === null ? "bg-slate-100 text-slate-700" : bom ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
      )}
    >
      <Seta className="h-3 w-3" aria-hidden />
      {texto}
      <span className="sr-only">{alta ? " a mais" : " a menos"} que o ano anterior</span>
    </span>
  );
}

/** Curva do pago acumulado (% do valor indicado de cada ano). O ano em curso para no mês de hoje. */
function Curvas({ anoAtual, anoAnterior, atual, anterior, mesAtual }: { anoAtual: number; anoAnterior: number; atual: number[]; anterior: number[]; mesAtual: number | null }) {
  const L = 36, R = 8, T = 8, B = 22, W = 420, H = 150;
  const x = (i: number) => L + ((W - L - R) * i) / 11;
  const y = (v: number) => T + (H - T - B) * (1 - v);
  const caminho = (serie: number[], ate: number) => serie.slice(0, ate).map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const nAtual = mesAtual ?? 12;
  const ultimo = atual[nAtual - 1] ?? 0;
  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Pago acumulado em ${anoAtual} comparado a ${anoAnterior}, em percentual do valor indicado de cada ano`}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} className="stroke-slate-200" strokeWidth={1} />
            <text x={L - 6} y={y(g) + 3.5} textAnchor="end" className="fill-slate-500" fontSize={10}>
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        {MESES.map((m, i) => (
          <text key={m} x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-500" fontSize={10}>
            {m}
          </text>
        ))}
        <path d={caminho(anterior, 12)} fill="none" className="stroke-slate-400" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
        <path d={caminho(atual, nAtual)} fill="none" stroke="var(--modulo)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="emd-traco" />
        <circle cx={x(nAtual - 1)} cy={y(ultimo)} r={4} fill="var(--modulo)" stroke="white" strokeWidth={2} />
      </svg>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded" style={{ backgroundColor: "var(--modulo)" }} aria-hidden /> {anoAtual}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-5 border-t-2 border-dashed border-slate-400" aria-hidden /> {anoAnterior}
        </span>
        <span>Pago acumulado, em % do valor indicado de cada ano</span>
      </figcaption>
    </figure>
  );
}

export type DadosComparacao = {
  atual: TotaisExercicio;
  anterior: TotaisExercicio;
  curvaAtual: number[];
  curvaAnterior: number[];
  /** Pago de cada ano até o mesmo dia (MM-DD), para comparar períodos iguais. */
  mesmoPeriodo: { rotuloData: string; atual: number; anterior: number };
  mesAtual: number | null;
};

/**
 * Comparação entre dois exercícios. Pronta para quando houver mais de um ano: sem exercício para comparar mostra um
 * estado de espera explicando o que vai aparecer; com `outros`, a pessoa escolhe o ano contra o qual comparar.
 */
export function ComparacaoExercicios({
  ano,
  dados,
  outros,
  hrefBase,
}: {
  ano: number;
  dados: DadosComparacao | null;
  /** Outros anos cadastrados (para escolher a base da comparação). */
  outros: number[];
  hrefBase: (anoComparar: number) => string;
}) {
  if (!dados) {
    return (
      <section aria-label="Comparação entre exercícios" className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)] text-[color:var(--modulo-tinta)]">
            <CalendarClock className="h-[1.125rem] w-[1.125rem]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[0.9375rem] font-semibold text-cataguases-marinho">Comparação entre exercícios</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-slate-600">
              {ano} é o único exercício cadastrado. Assim que o próximo for aberto em Configurações → Exercício, este quadro compara sozinho valor indicado,
              empenhado, pago, parte na Saúde e a curva de pagamentos mês a mês, no mesmo período de cada ano.
            </p>
          </div>
        </div>
      </section>
    );
  }
  const linhas = compararExercicios(dados.atual, dados.anterior);
  const mp = dados.mesmoPeriodo;
  const dPeriodo: LinhaComparacao = {
    chave: "periodo",
    rotulo: "",
    formato: "moeda",
    atual: mp.atual,
    anterior: mp.anterior,
    bomQuando: "alta",
    variacao: compararExercicios({ ...dados.atual, pago: mp.atual }, { ...dados.anterior, pago: mp.anterior }).find((l) => l.chave === "pago")!.variacao,
  };
  return (
    <section aria-label="Comparação entre exercícios" className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-cataguases-marinho">
            {dados.atual.ano} × {dados.anterior.ano}
          </h2>
          <p className="text-xs text-slate-600">Exercício inteiro; o pago também é comparado até {mp.rotuloData} de cada ano.</p>
        </div>
        {outros.length > 0 && (
          <nav aria-label="Comparar com" className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-slate-600">Comparar com</span>
            {outros.map((a) => (
              <Link
                key={a}
                href={hrefBase(a)}
                aria-current={a === dados.anterior.ano ? "true" : undefined}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium tabular-nums transition-colors duration-200",
                  a === dados.anterior.ano ? "bg-[color:var(--modulo-texto)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                {a}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_minmax(0,26rem)]">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-[0.8125rem]">
            <thead>
              <tr className="text-left text-slate-600">
                <th scope="col" className="py-1.5 pr-3 font-medium">Indicador</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium tabular-nums">{dados.atual.ano}</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium tabular-nums">{dados.anterior.ano}</th>
                <th scope="col" className="py-1.5 pl-3 text-right font-medium">Variação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave} className="border-t border-slate-100">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-cataguases-marinho">{l.rotulo}</th>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-cataguases-marinho">{formatar(l, l.atual)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatar(l, l.anterior)}</td>
                  <td className="py-2 pl-3 text-right"><Delta l={l} /></td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 bg-slate-50/70">
                <th scope="row" className="py-2 pr-3 text-left font-medium text-cataguases-marinho">Pago até {mp.rotuloData}</th>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-cataguases-marinho">{brlCurto(mp.atual)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{brlCurto(mp.anterior)}</td>
                <td className="py-2 pl-3 text-right"><Delta l={dPeriodo} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <Curvas anoAtual={dados.atual.ano} anoAnterior={dados.anterior.ano} atual={dados.curvaAtual} anterior={dados.curvaAnterior} mesAtual={dados.mesAtual} />
      </div>
    </section>
  );
}
