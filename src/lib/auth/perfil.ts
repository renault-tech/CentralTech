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

  // O middleware já validou a sessão desta requisição com `getUser()` (ida ao servidor de Auth). Aqui basta ler o
  // id: `getClaims()` confere a assinatura do token localmente e poupa uma segunda ida à rede a cada navegação.
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) {
    return null;
  }

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", userId)
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
