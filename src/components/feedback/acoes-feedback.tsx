"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { atualizarStatusFeedback } from "@/lib/actions/feedback";
import { ROTULO_STATUS } from "@/lib/feedback/apps";
import type { StatusFeedback } from "@/types/database";

const ORDEM: StatusFeedback[] = ["novo", "lido", "resolvido", "nao_possivel"];

/** Muda o status — o banco (RLS) valida de novo quem pode. */
export function AcoesFeedback({ id, status }: { id: string; status: StatusFeedback }) {
  const router = useRouter();
  const [pendente, setPendente] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function mudarPara(s: StatusFeedback) {
    setPendente(true);
    setErro(null);
    const r = await atualizarStatusFeedback({ id, status: s });
    setPendente(false);
    if (r.sucesso) router.refresh();
    else setErro(r.erro);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ORDEM.filter((s) => s !== status).map((s) => (
        <Button key={s} size="sm" variant="outline" disabled={pendente} onClick={() => mudarPara(s)} className="h-7 px-2 text-xs">
          {s === "novo" ? "Reabrir" : `Marcar: ${ROTULO_STATUS[s]}`}
        </Button>
      ))}
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
