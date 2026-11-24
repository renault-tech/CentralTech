import { consolidarFases, indiceDaProxima, type MacroEtapa } from "@/lib/emendas/fases-resumo";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { cn } from "@/lib/utils";

export const COR_FEITA = "#10B981";
const COR_FALTA = "rgb(203 213 225)";

/** Cor de cada segmento: feita = verde, a próxima = cor do módulo, o resto = cinza claro (nunca só a cor: há texto ao lado). */
export function corDoSegmento(m: MacroEtapa, ehProxima: boolean): string {
  if (m.estado === "feita") return COR_FEITA;
  return ehProxima ? "var(--modulo, #6B4FBB)" : COR_FALTA;
}

export function macrosDoResumo(resumo?: ResumoLinha): MacroEtapa[] {
  return resumo?.fases ? consolidarFases(resumo.fases) : [];
}

/**
 * Barra de fases da lista: até seis segmentos (macro-etapas) e a frase "próximo: …". Substitui o anel de %, que repetia o mesmo
 * número para todas as emendas ainda na primeira etapa. O percentual e o detalhe ficam na caixa que abre ao passar o mouse.
 */
export function BarraFases({ macros, cancelada, className }: { macros: MacroEtapa[]; cancelada?: boolean; className?: string }) {
  if (macros.length === 0) return null;
  const i = indiceDaProxima(macros);
  const feitas = macros.filter((m) => m.estado === "feita").length;
  const texto = cancelada ? "cancelada" : i < 0 ? "etapas concluídas" : `próximo: ${macros[i].nome.toLowerCase()}`;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)} role="img" aria-label={`${feitas} de ${macros.length} etapas concluídas; ${texto}`}>
      <span className="flex flex-none gap-[3px]" aria-hidden>
        {macros.map((m, k) => (
          <span key={m.chave} className="block h-1.5 w-5 rounded-full" style={{ background: cancelada ? COR_FALTA : corDoSegmento(m, k === i) }} />
        ))}
      </span>
      <span className="truncate text-xs text-slate-600" aria-hidden>{texto}</span>
    </span>
  );
}
