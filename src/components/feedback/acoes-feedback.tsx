"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { atualizarStatusFeedback, responderFeedback } from "@/lib/actions/feedback";
import { ROTULO_STATUS } from "@/lib/feedback/apps";
import type { StatusFeedback } from "@/types/database";

const ORDEM: StatusFeedback[] = ["novo", "lido", "resolvido", "nao_possivel"];

/** Muda o status — o banco (RLS) valida de novo quem pode. */
export function AcoesFeedback({
  id,
  status,
  resposta,
}: {
  id: string;
  status: StatusFeedback;
  resposta?: string | null;
}) {
  const router = useRouter();
  const [pendente, setPendente] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [texto, setTexto] = React.useState(resposta ?? "");
  const [aberta, setAberta] = React.useState(false);

  async function responder(s?: StatusFeedback) {
    setPendente(true);
    setErro(null);
    const r = await responderFeedback({ id, status: s, resposta: texto });
    setPendente(false);
    if (r.sucesso) {
      setAberta(false);
      router.refresh();
    } else setErro(r.erro);
  }

  async function mudarPara(s: StatusFeedback) {
    setPendente(true);
    setErro(null);
    const r = await atualizarStatusFeedback({ id, status: s });
    setPendente(false);
    if (r.sucesso) router.refresh();
    else setErro(r.erro);
  }

  return (
    <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-1.5">
      {ORDEM.filter((s) => s !== status).map((s) => (
        <Button key={s} size="sm" variant="outline" disabled={pendente} onClick={() => mudarPara(s)} className="h-7 px-2 text-xs">
          {s === "novo" ? "Reabrir" : `Marcar: ${ROTULO_STATUS[s]}`}
        </Button>
      ))}
      <Button size="sm" variant="outline" disabled={pendente} onClick={() => setAberta((v) => !v)} className="h-7 px-2 text-xs">
        {resposta ? "Editar resposta" : "Responder"}
      </Button>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
    {aberta && (
      <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
        <label htmlFor={`resp-${id}`} className="text-xs text-slate-500">
          Resposta ao usuário (ele recebe no sino e vê em “Meus envios”)
        </label>
        <textarea
          id={`resp-${id}`}
          rows={3}
          maxLength={2000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Diga o que foi feito, ou como está agora…"
          className="w-full resize-none rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" disabled={pendente || texto.trim().length < 3} onClick={() => responder()} className="h-7 px-2 text-xs">
            Enviar resposta
          </Button>
          <Button size="sm" variant="outline" disabled={pendente || texto.trim().length < 3} onClick={() => responder("resolvido")} className="h-7 px-2 text-xs">
            Enviar e marcar resolvido
          </Button>
          <Button size="sm" variant="outline" disabled={pendente || texto.trim().length < 3} onClick={() => responder("nao_possivel")} className="h-7 px-2 text-xs">
            Enviar e marcar não possível
          </Button>
        </div>
      </div>
    )}
    </div>
  );
}
