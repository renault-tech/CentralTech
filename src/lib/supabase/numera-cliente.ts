import "server-only";

import { createClient } from "@supabase/supabase-js";

import { envNumera } from "@/lib/env";

/**
 * Client apontando para o projeto Supabase do Numera (SEPARADO do projeto
 * deste app) — só leitura de `public.users`, para o importador em
 * Configurações. A RLS de lá já libera geral (`qual: true`), então a anon
 * key basta; não usa `Database` genérico (schema/tipos são do Numera, não
 * deste repo).
 */
export function criarClienteNumera() {
  const env = envNumera();
  return createClient(env.NUMERA_SUPABASE_URL, env.NUMERA_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
