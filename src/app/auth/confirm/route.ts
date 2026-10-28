import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { destinoSeguro } from "@/lib/seguranca/destino-seguro";
import { htmlConfirmarLink, respostaHtml } from "@/lib/seguranca/pagina-confirmar";
import { criarClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Recebe o retorno do link de e-mail do Supabase (recuperação de senha,
 * confirmação de conta) e estabelece a sessão. Aceita os dois formatos:
 * `code` (fluxo PKCE, template padrão) e `token_hash` + `type` (template
 * customizado). O formato `token_hash` (links de e-mail do Hub) NÃO é validado
 * no GET: ele mostra uma página com um botão e só o POST consome o token —
 * antivírus/prévia de e-mail abrem o link com GET e gastavam o token antes da
 * pessoa ("link inválido"). Em seguida redireciona para `next` (padrão: `/`, a Início
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

  if (tokenHash && tipo && !code) {
    return respostaHtml(
      htmlConfirmarLink({
        acao: "/auth/confirm",
        campos: { token_hash: tokenHash, type: tipo, next: destinoValido },
        titulo: tipo === "recovery" ? "Definir sua senha" : "Confirmar acesso",
        texto: "Para continuar, toque no botão abaixo. Este link só pode ser usado uma vez.",
        botao: "Continuar",
      })
    );
  }

  const supabase = await criarClienteServidor();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(destinoValido, request.url));
    }
    console.error("[auth/confirm] exchangeCodeForSession:", error);
  }

  return NextResponse.redirect(new URL("/login?motivo=link_invalido", request.url));
}

const TIPOS_VALIDOS: EmailOtpType[] = ["recovery", "invite", "magiclink", "signup", "email", "email_change"];

/** Consome o token do link de e-mail (o clique no botão da página acima). */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const tipo = String(form.get("type") ?? "") as EmailOtpType;
  const destinoValido = destinoSeguro(String(form.get("next") ?? "/"), "/");

  if (tokenHash && TIPOS_VALIDOS.includes(tipo)) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) {
      // 303: o navegador troca o POST por um GET no destino.
      return NextResponse.redirect(new URL(destinoValido, request.url), 303);
    }
    console.error("[auth/confirm] verifyOtp:", error.message);
  }

  return NextResponse.redirect(new URL("/login?motivo=link_invalido", request.url), 303);
}
