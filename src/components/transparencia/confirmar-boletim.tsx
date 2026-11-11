"use client";

import * as React from "react";
import Link from "next/link";

import { cancelarBoletim, confirmarBoletim } from "@/lib/emendas/actions-boletim";

export function ConfirmarBoletim({ acao, token }: { acao: "confirmar" | "cancelar"; token: string }) {
  const [resultado, setResultado] = React.useState<{ ok: boolean; mensagem: string } | null>(null);
  const [pendente, iniciar] = React.useTransition();
  const confirmar = acao === "confirmar";
  return (
    <div className="portal-raiz flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--p-linha)] bg-[var(--p-superficie)] p-8 text-center shadow-[var(--p-sombra)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-acento-texto)]">Transparência · Cataguases</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--p-tinta)]">{confirmar ? "Confirmar o boletim" : "Cancelar o boletim"}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--p-tinta-2)]">
          {resultado?.mensagem ??
            (confirmar
              ? "Toque no botão para passar a receber, por e-mail, as atualizações das emendas impositivas."
              : "Toque no botão para não receber mais as atualizações por e-mail.")}
        </p>
        {!resultado?.ok && (
          <button
            type="button"
            disabled={pendente || !token}
            onClick={() => iniciar(async () => setResultado(await (confirmar ? confirmarBoletim(token) : cancelarBoletim(token))))}
            className="portal-botao mt-6 w-full"
          >
            {pendente ? "Um instante…" : confirmar ? "Confirmar o recebimento" : "Cancelar o recebimento"}
          </button>
        )}
        <Link href="/transparencia/emendas" className="mt-5 inline-block text-sm font-medium text-[var(--p-acento-texto)] hover:underline">
          Ir para o portal das emendas
        </Link>
      </div>
    </div>
  );
}
