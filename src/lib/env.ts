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

// Projeto Supabase SEPARADO do Numera — só leitura de public.users, para o
// importador em Configurações. Não são segredos (a mesma chave já vai
// hardcoded no client-side do próprio Numera), mas ficam em env var pelo
// mesmo padrão dos demais valores de configuração deste projeto. Schema
// próprio (não misturado a `esquemaServidor`) para não exigir a
// service_role só pra listar os usuários do Numera.
const esquemaNumera = z.object({
  NUMERA_SUPABASE_URL: z.url({ message: "NUMERA_SUPABASE_URL deve ser uma URL válida" }),
  NUMERA_SUPABASE_ANON_KEY: z.string().min(10, "NUMERA_SUPABASE_ANON_KEY ausente ou inválida"),
});

export function envNumera() {
  if (typeof window !== "undefined") {
    throw new Error("envNumera() não pode ser chamado no cliente");
  }
  return esquemaNumera.parse({
    NUMERA_SUPABASE_URL: process.env.NUMERA_SUPABASE_URL,
    NUMERA_SUPABASE_ANON_KEY: process.env.NUMERA_SUPABASE_ANON_KEY,
  });
}

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
