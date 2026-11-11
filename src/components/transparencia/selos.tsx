import { AlertTriangle, CheckCircle2, CircleDashed, CircleDot, Clock3 } from "lucide-react";

import { SITUACOES_PUBLICAS, type SituacaoPublica } from "@/lib/emendas/portal-agregados";

/** Estado com ícone + texto (nunca só a cor). */
export const ICONE_SITUACAO: Record<SituacaoPublica, typeof CheckCircle2> = {
  paga: CheckCircle2,
  parcial: CircleDot,
  empenhada: Clock3,
  aguardando: CircleDashed,
  impedida: AlertTriangle,
};
export const COR_SITUACAO: Record<SituacaoPublica, string> = {
  paga: "var(--e-paga)",
  parcial: "var(--e-parcial)",
  empenhada: "var(--e-empenhada)",
  aguardando: "var(--e-aguardando)",
  impedida: "var(--e-impedida)",
};

export function SeloSituacao({ s, pequeno }: { s: SituacaoPublica; pequeno?: boolean }) {
  const Icone = ICONE_SITUACAO[s];
  const nome = SITUACOES_PUBLICAS.find((x) => x.chave === s)!.nome;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pequeno ? "px-2 py-0.5 text-[12px]" : "px-2.5 py-1 text-[13px]"}`}
      style={{ color: COR_SITUACAO[s], background: `color-mix(in srgb, ${COR_SITUACAO[s]} 12%, transparent)` }}
    >
      <Icone className={pequeno ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
      {nome}
    </span>
  );
}
