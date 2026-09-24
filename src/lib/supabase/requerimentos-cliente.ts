import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { envPublico } from "@/lib/env";

/**
 * Mesmo padrão de `compras-cliente.ts`, para o schema `requerimentos` do
 * mesmo projeto Supabase compartilhado.
 */
export const criarClienteRequerimentos = cache(async () => {
  const env = envPublico();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "requerimentos" },
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
