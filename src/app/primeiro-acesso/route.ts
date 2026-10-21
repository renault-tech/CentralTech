import { NextResponse, type NextRequest } from "next/server";

import { usuarioDoConvite } from "@/lib/auth/convite";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Destino do link de primeiro acesso (`hub.convites_acesso`). O token da
 * Central é persistente; aqui ele é trocado, na hora do clique, por um token
 * novo do Supabase (recovery) e a pessoa segue para `/auth/confirm`, que grava
 * a sessão e leva a `/redefinir-senha`. Um clique a mais (pré-visualização de
 * mensagem, duplo clique) só gasta o token do Supabase daquele clique — o
 * convite continua válido até a senha ser definida.
 */
export async function GET(request: NextRequest) {
  const invalido = () => NextResponse.redirect(new URL("/login?motivo=convite_invalido", request.url));

  const token = new URL(request.url).searchParams.get("t") ?? "";
  const usuarioId = await usuarioDoConvite(token);
  if (!usuarioId) return invalido();

  const admin = criarClienteAdminBruto();
  const { data: conta } = await admin.auth.admin.getUserById(usuarioId);
  const email = conta.user?.email;
  if (!email) return invalido();

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error("[primeiro-acesso] generateLink:", error?.message);
    return invalido();
  }

  const destino = new URL("/auth/confirm", request.url);
  destino.searchParams.set("token_hash", tokenHash);
  destino.searchParams.set("type", "recovery");
  destino.searchParams.set("next", "/redefinir-senha");
  return NextResponse.redirect(destino);
}
