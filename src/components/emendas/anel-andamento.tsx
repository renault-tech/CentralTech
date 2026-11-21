import { cn } from "@/lib/utils";

/**
 * Percentual de andamento de uma emenda: fases concluídas ÷ fases aplicáveis do tipo (a mesma conta de `progresso()`).
 * Anel em SVG puro que "enche" uma vez ao aparecer; o número fica no centro, com algarismos alinhados.
 * A cor muda com o avanço (cinza → âmbar → violeta → verde ao concluir) e nunca é o único sinal: o número está lá.
 */
export function corDoAndamento(p: number): string {
  if (p >= 100) return "#059669";
  if (p >= 60) return "#6B4FBB";
  if (p > 0) return "#D97706";
  return "#94A3B8";
}

export function AnelAndamento({
  concluidas,
  total,
  tamanho = 44,
  espessura = 4.5,
  className,
}: {
  concluidas: number;
  total: number;
  tamanho?: number;
  espessura?: number;
  className?: string;
}) {
  const p = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  const raio = (tamanho - espessura) / 2;
  const circ = 2 * Math.PI * raio;
  const resto = circ * (1 - p / 100);
  const cor = corDoAndamento(p);
  return (
    <span
      className={cn("relative inline-flex flex-none items-center justify-center", className)}
      style={{ width: tamanho, height: tamanho }}
      role="img"
      aria-label={`${p}% de andamento: ${concluidas} de ${total} fases concluídas`}
    >
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden className="-rotate-90">
        <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none" stroke="currentColor" strokeWidth={espessura} className="text-slate-200" />
        {p > 0 && (
          <circle
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={raio}
            fill="none"
            stroke={cor}
            strokeWidth={espessura}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={resto}
            className="emd-anel-arco"
            style={{ ["--anel-total" as string]: circ, ["--anel-resto" as string]: resto }}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums tracking-tight text-cataguases-marinho" style={{ fontSize: tamanho * 0.28 }} aria-hidden>
        {p}
        <span className="font-medium text-slate-500" style={{ fontSize: tamanho * 0.2 }}>%</span>
      </span>
    </span>
  );
}

/** Percentual como número (para ordenar e para os indicadores). */
export function percentualAndamento(r?: { concluidas: number; total: number }): number | null {
  if (!r || r.total <= 0) return null;
  return Math.round((r.concluidas / r.total) * 100);
}
