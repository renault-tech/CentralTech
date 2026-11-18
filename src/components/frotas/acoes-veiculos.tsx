"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { atualizarValoresFipe } from "@/lib/frotas/actions-importacao";
import { CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/frotas/ui";

/** Atualiza o valor dos veículos já ligados à FIPE (em rodadas curtas repetidas sozinhas, para não estourar o tempo). */
export function AtualizarFipe() {
  const router = useRouter();
  const [pendente, iniciar] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tipo: "ok" | "erro" | "aviso"; texto: string } | null>(null);

  function rodar() {
    setMsg(null);
    iniciar(async () => {
      let atualizados = 0;
      let falhas = 0;
      let motivo: string | null = null;
      // Repete as rodadas até acabar (cada uma é curta, para caber no tempo da função).
      for (let i = 0; i < 40; i += 1) {
        let r: Awaited<ReturnType<typeof atualizarValoresFipe>>;
        try {
          r = await atualizarValoresFipe();
        } catch {
          return setMsg({ tipo: "erro", texto: `${atualizados} atualizados. A consulta foi interrompida (tempo esgotado ou sem conexão); clique de novo para continuar.` });
        }
        if (!r.sucesso) return setMsg({ tipo: "erro", texto: r.erro });
        atualizados += r.atualizados;
        falhas += r.falhas;
        motivo ??= r.motivo;
        if (r.parar || r.restantes === 0 || (r.atualizados === 0 && r.falhas > 0)) break;
      }
      const partes = [`${atualizados} atualizados`];
      if (falhas) partes.push(`${falhas} com falha`);
      const texto = partes.join(" · ") + "." + (motivo ? ` Motivo: ${motivo}` : atualizados === 0 && falhas === 0 ? " Todos os veículos ligados à FIPE já estão com o valor deste mês." : "");
      setMsg({ tipo: falhas ? (atualizados ? "aviso" : "erro") : "ok", texto });
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
