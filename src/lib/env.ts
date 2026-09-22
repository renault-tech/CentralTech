import { z } from "zod";

/**
 * Validação das variáveis de ambiente.
 * As públicas (NEXT_PUBLIC_*) vão ao cliente; a service_role é exclusiva do servidor.
 */
const esquemaPublico = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL deve ser uma URL válida" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente ou inválida"),
});

const esquemaServidor = esquemaPublico.extend({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, "SUPABASE_SERVICE_ROLE_KEY ausente ou inválida"),
});

export function envPublico() {
  return esquemaPublico.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function envServidor() {
  if (typeof window !== "undefined") {
    throw new Error("envServidor() não pode ser chamado no cliente");
  }
  return esquemaServidor.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
