import { brl } from "@/lib/imoveis/regras";

/**
 * Gráficos em SVG puro (servidor): sem biblioteca, cores por tokens/variáveis para claro e escuro.
 * Texto dos eixos usa `fill-slate-500` (a escala `slate` muda no modo escuro).
 */

export type Serie = { rotulo: string; cor: string; valores: (number | null)[] };

const fmtCurto = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(Math.round(v)));

export function GraficoLinhas({ rotulos, series, altura = 220, formato = fmtCurto }: { rotulos: string[]; series: Serie[]; altura?: number; formato?: (v: number) => string }) {
  const W = 680;
  const H = altura;
  const pl = 52;
  const pr = 14;
  const pt = 14;
  const pb = 26;
  const max = Math.max(1, ...series.flatMap((s) => s.valores.filter((v): v is number => v !== null))) * 1.1;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const x = (i: number) => pl + ((W - pl - pr) * i) / Math.max(1, rotulos.length - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Gráfico de linhas: ${series.map((s) => s.rotulo).join(", ")}`}>
      {[0, 1, 2, 3, 4].map((k) => {
        const v = (max * k) / 4;
        return (
          <g key={k}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} className="stroke-slate-200" />
            <text x={pl - 8} y={y(v) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
              {formato(v)}
            </text>
          </g>
        );
      })}
      {rotulos.map((r, i) => (
        <text key={`${r}-${i}`} x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[11px]">
          {r}
        </text>
      ))}
      {series.map((s) => {
        // Mês sem lançamento (null) é lacuna: a linha é interrompida em vez de cair a zero.
        const trechos: number[][] = [];
        s.valores.forEach((v, i) => {
          if (v === null) return;
          if (i > 0 && s.valores[i - 1] !== null) trechos[trechos.length - 1].push(i);
          else trechos.push([i]);
        });
        return (
          <g key={s.rotulo}>
            {trechos.map((idx) => {
              const d = idx.map((i, k) => `${k ? "L" : "M"}${x(i)},${y(s.valores[i] as number)}`).join("");
              return (
                <g key={idx[0]}>
                  {idx.length > 1 && <path d={`${d}L${x(idx[idx.length - 1])},${y(0)}L${x(idx[0])},${y(0)}Z`} fill={s.cor} opacity={0.08} />}
                  <path d={d} fill="none" stroke={s.cor} strokeWidth={2.4} strokeLinejoin="round" />
                  <circle cx={x(idx[idx.length - 1])} cy={y(s.valores[idx[idx.length - 1]] as number)} r={idx.length === 1 ? 3.5 : 4.5} fill={s.cor} className="stroke-white" strokeWidth={2} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** Colunas mensais com a linha tracejada da média e a última coluna destacada se `alerta`. */
export function GraficoColunas({ rotulos, valores, cor, media, alerta = false, altura = 180 }: { rotulos: string[]; valores: number[]; cor: string; media?: number | null; alerta?: boolean; altura?: number }) {
  const W = 680;
  const H = altura;
  const pl = 52;
  const pr = 10;
  const pt = 14;
  const pb = 26;
  const max = Math.max(1, ...valores, media ?? 0) * 1.12;
  const passo = (W - pl - pr) / Math.max(1, valores.length);
  const larg = passo * 0.62;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Consumo mensal">
      {[0, 1, 2, 3].map((k) => {
        const v = (max * k) / 3;
        return (
          <g key={k}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} className="stroke-slate-200" />
            <text x={pl - 8} y={y(v) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
              {fmtCurto(v)}
            </text>
          </g>
        );
      })}
      {valores.map((v, i) => {
        const xi = pl + passo * i + (passo - larg) / 2;
        const ultima = i === valores.length - 1;
        return (
          <g key={`${rotulos[i]}-${i}`}>
            <rect x={xi} y={y(v)} width={larg} height={Math.max(0, H - pb - y(v))} rx={3} fill={ultima && alerta ? "#B42318" : cor} opacity={ultima ? 1 : 0.78} />
            <text x={xi + larg / 2} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {rotulos[i]}
            </text>
          </g>
        );
      })}
      {media ? (
        <g>
          <line x1={pl} x2={W - pr} y1={y(media)} y2={y(media)} className="stroke-slate-400" strokeDasharray="4 4" />
          <text x={W - pr} y={y(media) - 4} textAnchor="end" className="fill-slate-500 text-[11px]">
            média
          </text>
        </g>
      ) : null}
    </svg>
  );
}

export function LegendaSeries({ series }: { series: Serie[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
      {series.map((s) => (
        <span key={s.rotulo} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-[3px] w-3 rounded" style={{ background: s.cor }} />
          {s.rotulo}
        </span>
      ))}
    </div>
  );
}

export { brl };
