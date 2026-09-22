import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { UsuarioHub } from "@/types/database";

/**
 * Resolve o usuário autenticado (sessão + linha em `hub.usuarios`).
 * `null` quando a pessoa está autenticada no projeto (pode até ter acesso a
 * outro módulo, como Compras) mas não tem acesso liberado a este hub.
 */
export const obterUsuarioAtual = cache(async (): Promise<UsuarioHub | null> => {
  const supabase = await criarClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("[obterUsuarioAtual] falha ao ler o perfil:", error);
    throw new Error("Não foi possível carregar seu perfil. Tente novamente.");
  }

  return usuario ?? null;
});
