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

// Service role do projeto Numera — precisa ser colada manualmente na Vercel
// (ver "Passo manual" no changelog): é a única forma de criar conta/aprovar
// diretamente no banco do Numera a partir do Hub (cadastro unificado).
// Diferente de `SUPABASE_SERVICE_ROLE_KEY` (projeto compartilhado
// Compras/Requerimentos/Hub) — são dois projetos Supabase diferentes.
const esquemaNumeraAdmin = z.object({
  NUMERA_SUPABASE_URL: z.url({ message: "NUMERA_SUPABASE_URL deve ser uma URL válida" }),
  NUMERA_SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, "NUMERA_SUPABASE_SERVICE_ROLE_KEY ausente ou inválida"),
});

export function envNumeraAdmin() {
  if (typeof window !== "undefined") {
    throw new Error("envNumeraAdmin() não pode ser chamado no cliente");
  }
  return esquemaNumeraAdmin.parse({
    NUMERA_SUPABASE_URL: process.env.NUMERA_SUPABASE_URL,
    NUMERA_SUPABASE_SERVICE_ROLE_KEY: process.env.NUMERA_SUPABASE_SERVICE_ROLE_KEY,
  });
}

// Credenciais da API HTTPS da Brevo (Transactional Email,
// https://api.brevo.com/v3/smtp/email) — usada para contornar o bug de
// SMTP nativo do Supabase no projeto do Numera (ver changelog "Bypass do
// SMTP quebrado do Numera para recuperação de senha"). É uma "Chave API"
// da Brevo (aba "Chaves API" em SMTP & API), diferente das chaves de SMTP
// AUTH configuradas (sem efeito) no painel do Supabase.
// `BREVO_REMETENTE_EMAIL` precisa ser um remetente validado na conta
// Brevo (o mesmo endereço já usado no SMTP do Supabase serve).
const esquemaBrevo = z.object({
  BREVO_API_KEY: z.string().min(20, "BREVO_API_KEY ausente ou inválida"),
  BREVO_REMETENTE_EMAIL: z.email({ message: "BREVO_REMETENTE_EMAIL deve ser um e-mail válido" }),
  BREVO_REMETENTE_NOME: z.string().min(1).default("Numera"),
});

export function envBrevo() {
  if (typeof window !== "undefined") {
    throw new Error("envBrevo() não pode ser chamado no cliente");
  }
  return esquemaBrevo.parse({
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    BREVO_REMETENTE_EMAIL: process.env.BREVO_REMETENTE_EMAIL,
    BREVO_REMETENTE_NOME: process.env.BREVO_REMETENTE_NOME,
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
