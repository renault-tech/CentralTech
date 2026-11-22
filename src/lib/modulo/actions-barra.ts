"use server";

import { cookies } from "next/headers";

import { COOKIES_BARRA, type ModuloComBarra } from "@/lib/modulo/barra-cookie";

/** Lembra se a barra lateral de um módulo está recolhida (preferência visual, por navegador). */
export async function definirBarraRecolhida(modulo: ModuloComBarra, recolhida: boolean): Promise<void> {
  const nome = COOKIES_BARRA[modulo];
  if (!nome) return;
  (await cookies()).set(nome, recolhida ? "1" : "0", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
