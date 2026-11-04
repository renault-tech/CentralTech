"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { atualizarValoresFipe } from "@/lib/frotas/actions-importacao";
import { CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/frotas/ui";

/** Atualiza o valor dos veículos já ligados à FIPE (em rodadas de 25, para não estourar o tempo). */
export function AtualizarFipe() {
  const router = useRouter();
  const [pendente, iniciar] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tipo: "ok" | "erro" | "aviso"; texto: string } | null>(null);

  function rodar() {
    setMsg(null);
    iniciar(async () => {
      const r = await atualizarValoresFipe();
      if (!r.sucesso) return setMsg({ tipo: "erro", texto: r.erro });
      const partes = [`${r.atualizados} atualizados`];
      if (r.falhas) partes.push(`${r.falhas} com falha`);
      if (r.restantes) partes.push(`faltam ${r.restantes}: clique de novo para continuar`);
      setMsg({ tipo: r.falhas ? "aviso" : "ok", texto: partes.join(" · ") + "." });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button type="button" onClick={rodar} disabled={pendente} className={CLASSE_BOTAO_SECUNDARIO}>
        {pendente ? "Consultando a FIPE…" : "Atualizar valores da FIPE"}
      </button>
      {msg && <Mensagem tipo={msg.tipo}>{msg.texto}</Mensagem>}
    </div>
  );
}
