import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { envPublico } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * React.cache: uma única instância por requisição.
 */
export const criarClienteServidor = cache(async () => {
  const env = envPublico();
  const cookieStore = await cookies();

  return createServerClient<Database, "hub">(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // Mesmo projeto Supabase do App-Compras — este app expõe só o
      // schema `hub` (não `public` nem `requerimentos`).
      db: { schema: "hub" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado a partir de um Server Component: o middleware
            // cuidará da renovação da sessão.
          }
        },
      },
    }
  );
});
