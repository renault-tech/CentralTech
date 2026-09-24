import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { criarClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Achado de auditoria de segurança: `next.startsWith("/") &&
 * !next.startsWith("//")` parecia bloquear open redirect, mas não barra
 * `/\evil.com` — o parser de URL (WHATWG, usado tanto pelo `new URL()`
 * quanto pela resolução do header `Location` no navegador) normaliza `\`
 * para `/` em esquemas especiais, então `/\evil.com` vira `//evil.com` →
 * autoridade `evil.com`. Confirmado ao vivo (`new URL("/\\evil.com",
 * base)` resolve para `https://evil.com/`). Corrigido resolvendo o valor
 * com o MESMO parser que vai processar o redirect de verdade, e só
 * aceitando quando a origem resultante não mudou — não dá pra bypassar
 * com nenhuma variação de string que o navegador entenda diferente,
 * porque a checagem usa o navegador (via WHATWG URL) para decidir, não
 * um regex que tenta prever o que ele vai fazer.
 */
function destinoSeguro(valor: string | null | undefined, fallback: string): string {
  if (!valor) return fallback;
  try {
    const base = "http://localhost";
    const resolvido = new URL(valor, base);
    if (resolvido.origin !== base) return fallback;
    return resolvido.pathname + resolvido.search + resolvido.hash;
  } catch {
    return fallback;
  }
}

/**
 * Recebe o retorno do link de e-mail do Supabase (recuperação de senha,
 * confirmação de conta) e estabelece a sessão. Aceita os dois formatos:
 * `code` (fluxo PKCE, template padrão) e `token_hash` + `type` (template
 * customizado). Em seguida redireciona para `next` (padrão: `/`, a Início
 * do Hub — não `/dashboard`, que não existe neste repo; achado à parte,
 * herdado de copiar este arquivo do App-Compras sem ajustar o fallback).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;

  const destinoValido = destinoSeguro(next, "/");
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
