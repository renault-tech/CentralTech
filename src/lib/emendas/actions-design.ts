"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { COOKIE_DESIGN } from "@/lib/emendas/design-cookie";
import { podeAlternarDesign } from "@/lib/emendas/design";

/** PROVISÓRIO (ver `design.ts`): grava a escolha de visual. Só o administrador; para os outros não faz nada. */
export async function definirDesign(valor: "novo" | "original"): Promise<void> {
  if (valor !== "novo" && valor !== "original") return;
  if (!(await podeAlternarDesign())) return;
  (await cookies()).set(COOKIE_DESIGN, valor, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/emendas", "layout");
}
