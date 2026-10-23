"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Última rede de segurança: um erro de renderização em qualquer tela cai aqui
 * em vez de deixar a página em branco (o CLAUDE.md já registrava a falta).
 */
export default function ErroDaPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[erro de tela]", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold text-cataguases-marinho">Algo deu errado nesta tela</h1>
      <p className="text-sm text-slate-600">
        Não foi possível carregar. Tente de novo; se continuar, avise o administrador
        {error.digest ? ` informando o código ${error.digest}` : ""}.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center rounded-lg bg-cataguases-marinho px-4 text-sm font-medium text-white hover:opacity-90"
        >
          Tentar de novo
        </button>
        <Link href="/" className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm text-cataguases-marinho hover:bg-slate-50">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
