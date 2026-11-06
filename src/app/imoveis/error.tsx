"use client";

import { useEffect } from "react";

export default function ErroImoveis({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[imoveis] erro de tela", error.digest ?? error.message);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold text-cataguases-marinho">Não foi possível abrir esta tela</h1>
      <p className="text-sm text-slate-600">
        Tente de novo; se continuar, avise o administrador{error.digest ? ` informando o código ${error.digest}` : ""}. Se o problema for logo ao entrar no módulo,
        confira se o schema “imoveis” está exposto na API do Supabase.
      </p>
      <button type="button" onClick={reset} className="inline-flex h-10 items-center rounded-lg bg-[#0B5566] px-4 text-sm font-medium text-white hover:bg-[#094656]">
        Tentar de novo
      </button>
    </div>
  );
}
