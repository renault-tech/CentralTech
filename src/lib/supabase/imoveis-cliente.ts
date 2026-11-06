import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { envPublico } from "@/lib/env";
import type { DatabaseImoveis } from "@/types/imoveis";

/**
 * Mesmo padrão de `frotas-cliente.ts`, para o schema `imoveis` — a MESMA
 * sessão do Hub (cookies), só o schema muda. Toda a segurança do módulo está
 * na RLS de lá (`imoveis.pode_ver()` / `imoveis.eh_gestor()`), então as telas
 * usam este cliente e nunca a service_role.
 */
export const criarClienteImoveis = cache(async () => {
  const env = envPublico();
  const cookieStore = await cookies();

  return createServerClient<DatabaseImoveis, "imoveis">(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "imoveis" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de um Server Component.
        }
      },
    },
  });
});
