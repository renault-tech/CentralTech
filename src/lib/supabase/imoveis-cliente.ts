import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { clienteFixoModulo } from "@/lib/modulo/cache-dados";

import { envPublico } from "@/lib/env";
import type { DatabaseImoveis } from "@/types/imoveis";

/**
 * Mesmo padrão de `frotas-cliente.ts`, para o schema `imoveis` — a MESMA
 * sessão do Hub (cookies), só o schema muda. Toda a segurança do módulo está
 * na RLS de lá (`imoveis.pode_ver()` / `imoveis.eh_gestor()`), então as telas
 * usam este cliente e nunca a service_role.
 */
const comCookies = cache(async () => {
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

/**
 * Dentro das leituras em cache (`lerComCacheModulo`) não há cookies: o cliente usa o token da própria pessoa, sem renovar sessão.
 * Fora delas, o de sempre (cookies da requisição).
 */
export async function criarClienteImoveis() {
  const fixo = clienteFixoModulo.getStore();
  if (!fixo) return comCookies();
  const env = envPublico();
  return createClient<DatabaseImoveis, "imoveis">(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "imoveis" },
    global: { headers: { Authorization: `Bearer ${fixo.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
