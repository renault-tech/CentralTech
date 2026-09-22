import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { criarClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Recebe o retorno do link de e-mail do Supabase (recuperação de senha,
 * confirmação de conta) e estabelece a sessão. Aceita os dois formatos:
 * `code` (fluxo PKCE, template padrão) e `token_hash` + `type` (template
 * customizado). Em seguida redireciona para `next` (padrão: /dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/dashboard";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;

  const destinoValido = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const supabase = await criarClienteServidor();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(destinoValido, request.url));
    }
    console.error("[auth/confirm] exchangeCodeForSession:", error);
  } else if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(destinoValido, request.url));
    }
    console.error("[auth/confirm] verifyOtp:", error);
  }

  return NextResponse.redirect(new URL("/login?motivo=link_invalido", request.url));
}
