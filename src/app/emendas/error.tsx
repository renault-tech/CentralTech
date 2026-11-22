"use client";

import { useEffect } from "react";

import { TelaErro } from "@/components/modulo/estados-tela";

/** Erro numa tela do módulo Emendas: o cabeçalho e o menu continuam; só a área da tela mostra o aviso. */
export default function ErroEmendas({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[erro de tela · emendas]", error.digest ?? error.message);
  }, [error]);
  // O texto do erro só aparece em desenvolvimento; em produção a pessoa vê apenas o código.
  return <TelaErro digest={error.digest} detalhe={process.env.NODE_ENV !== "production" ? error.message : undefined} aoTentar={reset} voltar={{ href: "/emendas/lista", rotulo: "Voltar para a lista" }} />;
}
