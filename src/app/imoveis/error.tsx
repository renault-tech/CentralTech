"use client";

import { useEffect } from "react";

import { TelaErro } from "@/components/modulo/estados-tela";

/** Erro numa tela do módulo Imóveis e Consumo: o cabeçalho e o menu continuam; só a área da tela mostra o aviso. */
export default function ErroImoveis({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[erro de tela · imoveis]", error.digest ?? error.message);
  }, [error]);
  // O texto do erro só aparece em desenvolvimento; em produção a pessoa vê apenas o código.
  return (
    <TelaErro
      digest={error.digest}
      detalhe={process.env.NODE_ENV !== "production" ? error.message : undefined}
      aoTentar={reset}
      voltar={{ href: "/imoveis", rotulo: "Voltar ao Painel" }}
      dica="Se o problema aparecer logo ao entrar no módulo, confira se o schema “imoveis” está exposto na API do Supabase."
    />
  );
}
