import { createClient } from "@supabase/supabase-js";

import { envPublico } from "@/lib/env";

/**
 * Cliente mínimo apontando para outro schema do MESMO projeto Supabase
 * (Compras usa `public`, Requerimentos usa `requerimentos`, o Hub usa
 * `hub` — sem projeto novo, sem segredo novo), carregando o token de
 * acesso de uma sessão já autenticada para respeitar as policies de
 * "leio meu próprio cadastro" (`auth.uid() = id`) em vez de ler como
 * anônimo. Usado só depois de senha já validada pelo Supabase Auth
 * (`entrar()`), para diagnosticar "autenticou mas sem cadastro no Hub" —
 * a pessoa pode ter conta em outro app do ecossistema e ter chegado no
 * site errado (mesmo projeto Supabase, `auth.users` compartilhado entre
 * Hub/Compras/Requerimentos).
 */
export function criarClienteSchemaComSessao(schema: "public" | "requerimentos", accessToken: string) {
  const env = envPublico();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema },
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
