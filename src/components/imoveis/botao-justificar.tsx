"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { CLASSE_BOTAO, CLASSE_BOTAO_COMPACTO, Mensagem } from "@/components/imoveis/ui";
import { justificarPendencia, removerJustificativa } from "@/lib/imoveis/actions";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";

/** Justifica uma pendência (deixa de contar enquanto o dado não mudar) ou remove a justificativa. */
export function BotaoJustificar({ imovelId, chave, assinatura, justificada }: { imovelId: string; chave: string; assinatura: string; justificada?: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = React.useState(false);
  const [texto, setTexto] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await justificarPendencia({ imovelId, chave, assinatura, justificativa: texto });
      if (!r.sucesso) return setErro(r.erro);
      setAberto(false);
      setTexto("");
      router.refresh();
    });
  }

  if (justificada) {
    return (
      <button
        type="button"
        className={CLASSE_BOTAO_COMPACTO}
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            await removerJustificativa(imovelId, chave);
            router.refresh();
          })
        }
      >
        Reabrir
      </button>
    );
  }
  if (!aberto)
    return (
      <button type="button" className={CLASSE_BOTAO_COMPACTO} onClick={() => setAberto(true)}>
        Justificar
      </button>
    );
  return (
    <form onSubmit={salvar} className="flex w-full flex-col gap-2 sm:w-80">
      <label htmlFor={`j-${imovelId}-${chave}`} className="sr-only">Justificativa</label>
      <textarea id={`j-${imovelId}-${chave}`} rows={2} required autoFocus className={ESTILO_CAMPO_PADRAO} placeholder="Por que isto está certo?" value={texto} onChange={(e) => setTexto(e.target.value)} />
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      <div className="flex gap-2">
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>{pendente ? "Salvando…" : "Justificar"}</button>
        <button type="button" className={CLASSE_BOTAO_COMPACTO} onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </form>
  );
}
