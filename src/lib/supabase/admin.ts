import "server-only";

import { createClient } from "@supabase/supabase-js";

import { envServidor } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente com a chave service_role: ignora RLS e acessa a Admin API do
 * Auth. Uso exclusivo em Server Actions já protegidas por checagem de
 * perfil, nunca no cliente.
 */
export function criarClienteAdmin() {
  const env = envServidor();
  return createClient<Database, "hub">(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: "hub" },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Mesma chave/projeto de `criarClienteAdmin()`, mas SEM schema fixo e sem
 * generics do `Database` (só `hub`) — para checagens de existência
 * cross-schema (`public`/`requerimentos`) na orquestração de aprovação de
 * solicitações de acesso, onde a sessão do admin do Hub não tem
 * necessariamente visibilidade de RLS sobre as tabelas desses apps.
 * Sempre usar `.schema("...")` explicitamente antes de `.from(...)`.
 */
export function criarClienteAdminBruto() {
  const env = envServidor();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
