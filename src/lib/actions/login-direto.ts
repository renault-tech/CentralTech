"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { Modulo } from "@/types/database";

export type ResultadoLoginDireto = { sucesso: true } | { sucesso: false; erro: string };

/**
 * Liga/desliga o bloqueio de login direto de um app — só Compras e
 * Requerimentos têm um substituto real (o login pelo Hub, mesma conta);
 * Numera é só leitura na UI (ver `PainelLoginDireto`), mas a RPC em si não
 * distingue módulo, então esta action funciona para qualquer um dos 3 se
 * algum dia isso mudar.
 */
export async function alternarBloqueioLoginDireto(
  modulo: Modulo,
  bloqueado: boolean
): Promise<ResultadoLoginDireto> {
  const hub = await criarClienteServidor();
  const { error } = await hub.rpc("definir_bloqueio_login_direto", {
    p_modulo: modulo,
    p_bloqueado: bloqueado,
  });

  if (error) {
    console.error("[alternarBloqueioLoginDireto] falha:", error);
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/configuracoes");
  return { sucesso: true };
}
