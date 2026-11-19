import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { clienteFixo } from "@/lib/emendas/cache-dados";

import { envPublico } from "@/lib/env";
import type { DatabaseEmendas } from "@/types/emendas";

/**
 * Mesmo padrão de `requerimentos-cliente.ts`, para o schema `emendas` — a
 * MESMA sessão do Hub (cookies), só o schema muda. Toda a segurança do
 * módulo está na RLS de lá (`emendas.pode_ver_secretaria` etc.), então as
 * telas usam este cliente e nunca a service_role.
 */
const comCookies = cache(async () => {
  const env = envPublico();
  const cookieStore = await cookies();

  return createServerClient<DatabaseEmendas, "emendas">(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "emendas" },
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
 * Dentro das leituras em cache (`lerComCache`) não há cookies: o cliente usa o token da própria pessoa, sem renovar sessão.
 * Fora delas, o de sempre (cookies da requisição).
 */
export async function criarClienteEmendas() {
  const fixo = clienteFixo.getStore();
  if (!fixo) return comCookies();
  const env = envPublico();
  return createClient<DatabaseEmendas, "emendas">(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "emendas" },
    global: { headers: { Authorization: `Bearer ${fixo.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
