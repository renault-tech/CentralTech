"use client";

import { useLinkStatus } from "next/link";

/**
 * Vai DENTRO de um `<Link>`: enquanto a navegação desse link não termina, mostra um ponto pulsando e o CSS (`a:has([data-pendente])`,
 * em `globals.css`) acende o item como se já fosse o ativo. O clique responde no mesmo instante, mesmo quando a tela nova ainda
 * está sendo buscada — antes o menu ficava parado até a página chegar e parecia que o clique não tinha pegado.
 */
export function MarcaPendente() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span data-pendente aria-hidden className="ml-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--modulo)]" />;
}
