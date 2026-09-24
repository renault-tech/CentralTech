"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { alternarBloqueioLoginDireto } from "@/lib/actions/login-direto";
import type { Modulo } from "@/types/database";

export function InterruptorBloqueio({
  modulo,
  bloqueadoInicial,
}: {
  modulo: Modulo;
  bloqueadoInicial: boolean;
}) {
  const router = useRouter();
  const [bloqueado, setBloqueado] = React.useState(bloqueadoInicial);
  const [pendente, setPendente] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function alternar() {
    const novo = !bloqueado;
    if (novo && !window.confirm("Bloquear o login direto deste app agora, sem esperar mais adoção?")) {
      return;
    }
    setPendente(true);
    setErro(null);
    const resultado = await alternarBloqueioLoginDireto(modulo, novo);
    setPendente(false);
    if (!resultado.sucesso) {
      setErro(resultado.erro);
      return;
    }
    setBloqueado(novo);
    router.refresh();
  }

  return (
    <div className="mt-3">
      <label className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span>Bloquear login direto</span>
        <button
          type="button"
          role="switch"
          aria-checked={bloqueado}
          disabled={pendente}
          onClick={alternar}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            bloqueado ? "bg-semaforo-vermelho" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              bloqueado ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </label>
      {erro && <p className="mt-1 text-[11px] text-red-700">{erro}</p>}
    </div>
  );
}
