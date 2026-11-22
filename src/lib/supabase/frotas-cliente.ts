import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { clienteFixoModulo } from "@/lib/modulo/cache-dados";

import { envPublico } from "@/lib/env";
import type { DatabaseFrotas } from "@/types/frotas";

/**
 * Mesmo padrão de `emendas-cliente.ts`, para o schema `frotas` — a MESMA
 * sessão do Hub (cookies), só o schema muda. Toda a segurança do módulo está
 * na RLS de lá (`frotas.pode_ver()` / `frotas.eh_gestor()`), então as telas
 * usam este cliente e nunca a service_role.
 */
const comCookies = cache(async () => {
  const env = envPublico();
  const cookieStore = await cookies();

  return createServerClient<DatabaseFrotas, "frotas">(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "frotas" },
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

/**
 * Dentro das leituras em cache (`lerComCacheModulo`) não há cookies: o cliente usa o token da própria pessoa, sem renovar sessão.
 * Fora delas, o de sempre (cookies da requisição).
 */
export async function criarClienteFrotas() {
  const fixo = clienteFixoModulo.getStore();
  if (!fixo) return comCookies();
  const env = envPublico();
  return createClient<DatabaseFrotas, "frotas">(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "frotas" },
    global: { headers: { Authorization: `Bearer ${fixo.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
