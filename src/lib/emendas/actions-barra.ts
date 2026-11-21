"use server";

import { cookies } from "next/headers";

import { COOKIE_BARRA } from "@/lib/emendas/barra-cookie";

/** Lembra se a barra lateral do módulo Emendas está recolhida (preferência visual, por navegador). */
export async function definirBarraRecolhida(recolhida: boolean): Promise<void> {
  (await cookies()).set(COOKIE_BARRA, recolhida ? "1" : "0", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
