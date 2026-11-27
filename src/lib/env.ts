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
  BREVO_REMETENTE_NOME: z.string().min(1).default("Central Cataguases"),
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

// Conexão com o Google Drive (documentos). Cliente OAuth criado no Google Cloud com a conta da instituição; a chave de
// cifra protege no banco a autorização guardada. `GOOGLE_PICKER_API_KEY`/`GOOGLE_PROJECT_NUMBER` são opcionais: sem elas
// a tela não oferece o seletor de pastas do Google, só criar as pastas na raiz do Drive conectado.
const esquemaGoogle = z.object({
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(10, "GOOGLE_OAUTH_CLIENT_ID ausente"),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(10, "GOOGLE_OAUTH_CLIENT_SECRET ausente"),
  DOCUMENTOS_CHAVE_CRIPTO: z.string().min(16, "DOCUMENTOS_CHAVE_CRIPTO ausente (mínimo 16 caracteres)"),
  GOOGLE_PICKER_API_KEY: z.string().optional(),
  GOOGLE_PROJECT_NUMBER: z.string().optional(),
});

/** `null` quando a instituição ainda não configurou o Google: a tela explica o passo a passo em vez de quebrar. */
export function envGoogle() {
  if (typeof window !== "undefined") {
    throw new Error("envGoogle() não pode ser chamado no cliente");
  }
  const r = esquemaGoogle.safeParse({
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    DOCUMENTOS_CHAVE_CRIPTO: process.env.DOCUMENTOS_CHAVE_CRIPTO,
    GOOGLE_PICKER_API_KEY: process.env.GOOGLE_PICKER_API_KEY || undefined,
    GOOGLE_PROJECT_NUMBER: process.env.GOOGLE_PROJECT_NUMBER || undefined,
  });
  return r.success ? r.data : null;
}
