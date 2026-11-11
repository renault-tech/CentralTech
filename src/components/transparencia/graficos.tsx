"use client";

import * as React from "react";

import type { Grupo, Partes, PontoMes } from "@/lib/emendas/portal-agregados";
import { brl, brlCurto, pct } from "@/lib/emendas/regras";

import { LinhaDica, useDica } from "./dica";

/** As três partes do valor indicado, sempre com a mesma cor e a mesma ordem em todo o portal. */
export const SERIES = [
  { chave: "pago", nome: "Pago", cor: "var(--s-pago)", classe: "portal-seg-pago", explica: "Dinheiro que já saiu do caixa para o beneficiário ou o fornecedor." },
  { chave: "aPagar", nome: "Empenhado, a pagar", cor: "var(--s-apagar)", classe: "portal-seg-apagar", explica: "Valor já reservado (empenhado), que será pago após a entrega ou a prestação." },
  { chave: "aEmpenhar", nome: "Ainda não empenhado", cor: "var(--s-aempenhar)", classe: "portal-seg-aempenhar", explica: "Parte da emenda ainda em preparação (documentos, plano de trabalho, compra)." },
] as const;

/** Número que conta até o valor (respeita "reduzir movimento"). */
export function useContagem(alvo: number, duracao = 1100): number {
  const [v, setV] = React.useState(alvo);
  const anterior = React.useRef(0);
  React.useEffect(() => {
    const de = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? alvo : anterior.current;
    const inicio = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - inicio) / duracao);
      const e = 1 - Math.pow(1 - k, 4);
      setV(de + (alvo - de) * e);
      if (k < 1) raf = requestAnimationFrame(passo);
      else anterior.current = alvo;
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duracao]);
  return v;
}

function conteudoPartes(titulo: string, p: Partes, extra?: React.ReactNode) {
  return (
    <div>
      <p className="mb-1 font-semibold text-[var(--p-tinta)]">{titulo}</p>
      <LinhaDica rotulo="Valor indicado" valor={brl(p.total)} forte />
      {SERIES.map((s) => (
        <LinhaDica key={s.chave} cor={s.cor} rotulo={s.nome} valor={`${brl(p[s.chave])} · ${pct(p[s.chave] / (p.total || 1))}`} />
      ))}
      {extra}
    </div>
  );
}

/** Barra empilhada pago | a pagar | a empenhar. Cada parte tem a própria dica. */
export function BarraExecucao({ p, altura = 10, titulo, rotuloAria }: { p: Partes; altura?: number; titulo: string; rotuloAria?: string }) {
  const dica = useDica();
  const total = p.total || 1;
  return (
    <div
      className="portal-barra"
      style={{ height: altura }}
      role="img"
      aria-label={rotuloAria ?? `${titulo}: pago ${pct(p.pago / total)}, empenhado a pagar ${pct(p.aPagar / total)}, ainda não empenhado ${pct(p.aEmpenhar / total)}`}
    >
      {SERIES.map((s) =>
        p[s.chave] > 0.004 ? (
          <span key={s.chave} className={s.classe} style={{ flexGrow: p[s.chave] / total, flexBasis: 0 }} {...dica(conteudoPartes(titulo, p, <p className="mt-1.5 text-xs text-[var(--p-tinta-3)]">{s.nome}: {s.explica}</p>))} />
        ) : null
      )}
      {p.total <= 0 && <span className="portal-seg-aempenhar" style={{ flexGrow: 1 }} />}
    </div>
  );
}

export function Legenda({ claro }: { claro?: boolean }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] ${claro ? "text-white/80" : "text-[var(--p-tinta-2)]"}`}>
      {SERIES.map((s) => (
        <li key={s.chave} className="flex items-center gap-2">
          <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-[3px] ${s.classe}`} />
          {s.nome}
        </li>
      ))}
    </ul>
  );
}

/**
 * Lista de barras horizontais (vereadores, secretarias): cada linha é um botão que filtra o painel
 * inteiro. A barra mostra a execução; a largura total é proporcional ao maior grupo.
 */
export function BarrasPorGrupo({
  grupos,
  selecionado,
  aoEscolher,
  rotulo,
  limite = 15,
  escalaIgual,
}: {
  grupos: Grupo[];
  selecionado: string;
  aoEscolher: (chave: string) => void;
  rotulo: string;
  limite?: number;
  /** Mesma largura para todos (ex.: vereadores, que têm a mesma cota). */
  escalaIgual?: boolean;
}) {
  const dica = useDica();
  const [aberto, setAberto] = React.useState(false);
  const maior = Math.max(...grupos.map((g) => g.total), 1);
  const visiveis = aberto ? grupos : grupos.slice(0, limite);
  return (
    <div>
      <ul className="flex flex-col gap-0.5" aria-label={rotulo}>
        {visiveis.map((g) => {
          const largura = escalaIgual ? 100 : Math.max(8, (g.total / maior) * 100);
          const sel = selecionado === g.chave;
          return (
            <li key={g.chave}>
              <button
                type="button"
                className="portal-linha-grafico grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-3 py-2.5 text-left"
                data-selecionado={sel ? "1" : "0"}
                data-apagado={selecionado && !sel ? "1" : "0"}
                aria-pressed={sel}
                onClick={() => aoEscolher(sel ? "" : g.chave)}
                {...dica(
                  conteudoPartes(
                    g.nome,
                    g,
                    <p className="mt-1.5 text-xs text-[var(--p-tinta-3)]">
                      {g.quantidade} emenda{g.quantidade === 1 ? "" : "s"} · clique para {sel ? "tirar o filtro" : "filtrar o painel"}
                    </p>
                  )
                )}
              >
                <span className="truncate text-[14px] font-medium text-[var(--p-tinta)]">
                  {g.nome}
                  {g.detalhe && <span className="ml-1.5 text-[12px] font-normal text-[var(--p-tinta-3)]">{g.detalhe}</span>}
                </span>
                <span className="text-right text-[13px] tabular-nums text-[var(--p-tinta-2)]">
                  <span className="font-semibold text-[var(--p-tinta)]">{pct(g.pago / (g.total || 1), 0)}</span> pago · {brlCurto(g.total)}
                </span>
                <span className="col-span-2 block" style={{ width: `${largura}%` }}>
                  <BarraExecucao p={g} altura={8} titulo={g.nome} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {grupos.length > limite && (
        <button type="button" onClick={() => setAberto((x) => !x)} className="portal-botao-sec mt-3">
          {aberto ? "Mostrar menos" : `Ver todos (${grupos.length})`}
        </button>
      )}
    </div>
  );
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Curva acumulada dos pagamentos no ano, com mira vertical que segue o mouse. */
export function CurvaPagamentos({ pontos, total, ano, mesAtual }: { pontos: PontoMes[]; total: number; ano: number; mesAtual: number }) {
  const [foco, setFoco] = React.useState<number | null>(null);
  const ref = React.useRef<SVGSVGElement>(null);
  const L = 720;
  const A = 240;
  const m = { e: 8, d: 8, t: 16, b: 28 };
  const ate = Math.max(1, Math.min(12, mesAtual));
  const usados = pontos.slice(0, ate);
  const max = Math.max(total, ...usados.map((p) => p.acumulado), 1);
  const x = (i: number) => m.e + (i / 11) * (L - m.e - m.d);
  const y = (v: number) => m.t + (1 - v / max) * (A - m.t - m.b);
  const caminho = usados.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.acumulado).toFixed(1)}`).join(" ");
  const area = `${caminho} L${x(usados.length - 1).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`;
  const guias = [0.25, 0.5, 0.75, 1].map((k) => k * max);

  const mover = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const rel = ((clientX - r.left) / r.width) * L;
    const i = Math.round(((rel - m.e) / (L - m.e - m.d)) * 11);
    setFoco(Math.max(0, Math.min(usados.length - 1, i)));
  };
  const p = foco !== null ? usados[foco] : null;

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${L} ${A}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Pagamentos acumulados em ${ano}: ${brl(usados.at(-1)?.acumulado ?? 0)} até ${MESES_LONGOS[usados.length - 1]}, de ${brl(total)} indicados.`}
        onPointerMove={(e) => mover(e.clientX)}
        onPointerDown={(e) => mover(e.clientX)}
        onPointerLeave={() => setFoco(null)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setFoco((f) => Math.min(usados.length - 1, (f ?? -1) + 1));
          if (e.key === "ArrowLeft") setFoco((f) => Math.max(0, (f ?? usados.length) - 1));
          if (e.key === "Escape") setFoco(null);
        }}
        onBlur={() => setFoco(null)}
      >
        <defs>
          <linearGradient id="portal-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--s-pago)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--s-pago)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {guias.map((g) => (
          <g key={g}>
            <line x1={m.e} x2={L - m.d} y1={y(g)} y2={y(g)} stroke="var(--p-linha)" strokeDasharray={g === max ? undefined : "2 4"} />
          </g>
        ))}
        {total > 0 && (
          <>
            <line x1={m.e} x2={L - m.d} y1={y(total)} y2={y(total)} stroke="var(--p-tinta-3)" strokeOpacity="0.5" />
            <text x={L - m.d} y={y(total) - 6} textAnchor="end" fontSize="11" fill="var(--p-tinta-3)">
              Total indicado · {brlCurto(total)}
            </text>
          </>
        )}
        <line x1={m.e} x2={L - m.d} y1={y(0)} y2={y(0)} stroke="var(--p-linha-forte)" />
        <path d={area} fill="url(#portal-area)" />
        <path d={caminho} fill="none" stroke="var(--s-pago)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        {MESES.map((nome, i) => (
          <text key={nome} x={x(i)} y={A - 8} textAnchor={i === 0 ? "start" : i === 11 ? "end" : "middle"} fontSize="11" fill={i < ate ? "var(--p-tinta-3)" : "var(--p-linha-forte)"}>
            {nome}
          </text>
        ))}
        {usados.length > 0 && <circle cx={x(usados.length - 1)} cy={y(usados.at(-1)!.acumulado)} r="5" fill="var(--s-pago)" stroke="var(--p-superficie)" strokeWidth="2" />}
        {p && foco !== null && (
          <g>
            <line x1={x(foco)} x2={x(foco)} y1={m.t} y2={y(0)} stroke="var(--p-tinta-3)" strokeOpacity="0.55" />
            <circle cx={x(foco)} cy={y(p.acumulado)} r="6" fill="var(--s-pago)" stroke="var(--p-superficie)" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {p && foco !== null && (
        <div
          className="portal-dica pointer-events-none"
          style={{ position: "absolute", top: 0, left: `clamp(0px, calc(${(x(foco) / L) * 100}% - 110px), calc(100% - 230px))`, width: 220 }}
          aria-live="polite"
        >
          <p className="mb-1 font-semibold capitalize text-[var(--p-tinta)]">
            {MESES_LONGOS[foco]} de {ano}
          </p>
          <LinhaDica cor="var(--s-pago)" rotulo="Acumulado" valor={brl(p.acumulado)} forte />
          <LinhaDica rotulo="Pago no mês" valor={brl(p.pago)} />
          <LinhaDica rotulo="Pagamentos" valor={String(p.quantidade)} />
          <LinhaDica rotulo="Do total indicado" valor={pct(p.acumulado / (total || 1))} />
        </div>
      )}
    </div>
  );
}

/** Anel de progresso (porcentagem paga). */
export function Anel({ valor, tamanho = 148, espessura = 12, rotulo }: { valor: number; tamanho?: number; espessura?: number; rotulo: string }) {
  const r = (tamanho - espessura) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, valor));
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} role="img" aria-label={rotulo} className="shrink-0">
      <defs>
        <linearGradient id="portal-anel" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#c8bbff" />
          <stop offset="100%" stopColor="#f6d79c" />
        </linearGradient>
      </defs>
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={espessura} />
      <circle
        cx={tamanho / 2}
        cy={tamanho / 2}
        r={r}
        fill="none"
        stroke="url(#portal-anel)"
        strokeWidth={espessura}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
        style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)" }}
      />
    </svg>
  );
}
