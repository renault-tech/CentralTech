import { BookOpen } from "lucide-react";

import { BASES } from "@/lib/emendas/base-legal";
import { DicaAjuda } from "@/components/emendas/dica-ajuda";

/** Linha pequena "Base legal: …" (texto fixo) para telas e campos que cumprem uma exigência legal. */
export function BaseLegalLinha({ chave, className = "" }: { chave: keyof typeof BASES; className?: string }) {
  const b = BASES[chave];
  return (
    <p className={`flex items-start gap-1 text-xs text-slate-500 ${className}`}>
      <BookOpen className="mt-0.5 h-3 w-3 flex-none" aria-hidden />
      <span>
        <span className="font-medium">Base legal:</span> {b.citacao}
      </span>
    </p>
  );
}

/** "?" que explica a exigência e cita a lei, para campos onde não cabe uma linha. */
export function BaseLegalDica({ chave }: { chave: keyof typeof BASES }) {
  const b = BASES[chave];
  return (
    <DicaAjuda
      rotulo="Base legal"
      texto={
        <>
          {b.resumo}
          <span className="mt-1.5 block font-medium text-slate-800">Base legal: {b.citacao}</span>
        </>
      }
    />
  );
}
