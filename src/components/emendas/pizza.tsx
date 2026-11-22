"use client";

import * as React from "react";

import { brlCurto, pct } from "@/lib/emendas/regras";

/** Cores das fatias quando a dimensão não tem cor própria (área, assunto, secretaria, documento). */
export const PALETA = ["#6B4FBB", "#0E7490", "#C2410C", "#5C7A1F", "#BE185D", "#1D4ED8", "#A16207", "#0F766E"];
export const CINZA = "#94A3B8";

/** Pizza (anel) em SVG puro: cada fatia é um botão que filtra a lista; no centro, o total ou a fatia sob o cursor. */
export function Pizza({
  fatias,
  selecionada,
  aoEscolher,
  dinheiro,
  rotuloTotal,
  destaque = null,
  className = "h-[12.25rem] w-[12.25rem]",
}: {
  fatias: { chave: string; rotulo: string; v: number; cor: string; clicavel: boolean }[];
  selecionada: string;
  aoEscolher: (chave: string) => void;
  dinheiro: boolean;
  rotuloTotal: string;
  /** Fatia a realçar vinda de fora (a linha do ranking sob o cursor). */
  destaque?: string | null;
  /** Tamanho do anel (classes de largura e altura). */
  className?: string;
}) {
  const [sobreLocal, setSobre] = React.useState<string | null>(null);
  const sobre = sobreLocal ?? destaque;
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
    <svg viewBox="0 0 100 100" className={`${className} shrink-0 text-cataguases-marinho`} role="group" aria-label="Gráfico de pizza">
      {total === 0 ? (
        <circle cx="50" cy="50" r={R} fill="none" stroke={CINZA} strokeOpacity="0.35" strokeWidth="15" />
      ) : (
        arcos.map((a, idx) => {
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
              className={`emd-fatia outline-none transition-[stroke-width,opacity,filter] duration-200 motion-reduce:transition-none ${a.clicavel ? "cursor-pointer" : ""}`}
              style={{ animationDelay: `${idx * 70}ms` }}
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
