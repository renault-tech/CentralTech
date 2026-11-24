import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { clienteFixoHub } from "@/lib/supabase/cliente-fixo-hub";

import { envPublico } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * React.cache: uma única instância por requisição.
 */
const comCookies = cache(async () => {
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

/**
 * Dentro das leituras em cache do cabeçalho (`lerComCacheHub`) não há cookies: o cliente usa o token da própria pessoa,
 * sem renovar sessão (a RLS continua valendo). Fora delas, o de sempre.
 */
export async function criarClienteServidor() {
  const fixo = clienteFixoHub.getStore();
  if (!fixo) return comCookies();
  const env = envPublico();
  return createClient<Database, "hub">(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "hub" },
    global: { headers: { Authorization: `Bearer ${fixo.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
