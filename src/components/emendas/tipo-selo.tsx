import { TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import type { Gravidade } from "@/lib/emendas/pendencias";
import { NOME_GRAVIDADE } from "@/lib/emendas/pendencias";
import type { TipoExecucao } from "@/types/emendas";

/** Marca discreta do tipo de execução: bolinha na cor do tipo + nome curto. */
export function TipoSelo({ tipo }: { tipo: TipoExecucao }) {
  const t = TIPOS_EXECUCAO[tipo];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600" title={t.nome}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.cor }} aria-hidden />
      {t.curto}
    </span>
  );
}

const COR_GRAVIDADE: Record<Gravidade, string> = { alta: "#B91C1C", media: "#B45309", baixa: "#64748B" };

/** Contagem de pendências abertas, na cor da maior gravidade. */
export function SeloPendencias({ quantidade, gravidade }: { quantidade: number; gravidade: Gravidade | null }) {
  if (!quantidade || !gravidade) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[11px] font-medium tabular-nums"
      style={{ borderColor: COR_GRAVIDADE[gravidade], color: COR_GRAVIDADE[gravidade] }}
      title={`${quantidade} pendência${quantidade === 1 ? "" : "s"} · maior gravidade: ${NOME_GRAVIDADE[gravidade]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COR_GRAVIDADE[gravidade] }} aria-hidden />
      {quantidade}
    </span>
  );
}
