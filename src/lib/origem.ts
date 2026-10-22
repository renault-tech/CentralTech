import "server-only";

import { headers } from "next/headers";

/**
 * Origem (protocolo + host) da requisição atual, para montar links de retorno
 * (e-mails de recuperação e de primeiro acesso). Mora fora de `lib/actions/`
 * porque arquivos "use server" transformam TODO export em endpoint chamável
 * pelo navegador — esta função é só um utilitário de servidor.
 */
export async function origemDaRequisicao(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
