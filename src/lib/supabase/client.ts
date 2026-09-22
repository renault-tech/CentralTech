import { createBrowserClient } from "@supabase/ssr";

import { envPublico } from "@/lib/env";
import type { Database } from "@/types/database";

/** Cliente Supabase para uso em Client Components (navegador). */
export function criarClienteNavegador() {
  const env = envPublico();
  return createBrowserClient<Database, "hub">(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Mesmo projeto Supabase do App-Compras/Requerimentos — este app expõe só
    // o schema `hub` (não `public` nem `requerimentos`).
    { db: { schema: "hub" } }
  );
}
