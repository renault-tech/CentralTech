import "server-only";

import { createClient } from "@supabase/supabase-js";

import { envNumeraAdmin } from "@/lib/env";

/**
 * Cliente service_role do projeto Supabase SEPARADO do Numera — ignora RLS
 * e acessa a Admin API do Auth de lá. Só usado na aprovação de solicitações
 * de acesso que incluem o módulo Numera (criar/reaproveitar a conta de
 * verdade no projeto do Numera, já que não há SSO real entre os projetos).
 * Lança se `NUMERA_SUPABASE_SERVICE_ROLE_KEY` não estiver configurada (ver
 * "Passo manual" no changelog) — quem chama deve tratar essa falha sem
 * derrubar a aprovação dos outros módulos da mesma solicitação.
 */
export function criarClienteNumeraAdmin() {
  const env = envNumeraAdmin();
  return createClient(env.NUMERA_SUPABASE_URL, env.NUMERA_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
