import { cookies } from "next/headers";
import { COOKIE_DESIGN } from "@/lib/emendas/design-cookie";

import { obterContextoEmendas } from "@/lib/emendas/dados";

/**
 * PROVISÓRIO — alternância entre o visual original do módulo Emendas e o novo, só para avaliação.
 * Quem pode alternar: administrador da Central. Para todos os outros vale sempre o visual original.
 * A escolha é um cookie por navegador (`emendas_design` = "novo" | "original"); sem cookie, o admin vê o novo.
 * Para encerrar a avaliação: remover este arquivo, `design-emendas.tsx` e os ramos `novo`/original (buscar `useNovoDesign` e `usarNovoDesign`).
 */
export { COOKIE_DESIGN } from "@/lib/emendas/design-cookie";

export async function podeAlternarDesign(): Promise<boolean> {
  const ctx = await obterContextoEmendas();
  return "usuario" in ctx && !!ctx.usuario?.admin_hub;
}

export async function usarNovoDesign(): Promise<boolean> {
  if (!(await podeAlternarDesign())) return false;
  return (await cookies()).get(COOKIE_DESIGN)?.value !== "original";
}
