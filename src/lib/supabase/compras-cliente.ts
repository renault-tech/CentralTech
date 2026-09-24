import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { envPublico } from "@/lib/env";

/**
 * Cliente autenticado (mesma sessão/cookies do Hub) apontando para o
 * schema `public` do MESMO projeto Supabase do Compras — não é um projeto
 * separado, só schema diferente. Usado para chamar
 * `admin_criar_usuario`/`admin_atualizar_usuario`, que agora aceitam
 * `hub.eh_admin_hub()` como via de permissão alternativa (o `auth.uid()`
 * desta sessão é o mesmo em qualquer um dos 3 apps). Sem tipos genéricos do
 * Compras aqui de propósito — evita importar o `Database` de outro repo;
 * as chamadas usam nomes de RPC/coluna como string solta.
 */
export const criarClienteCompras = cache(async () => {
  const env = envPublico();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "public" },
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
