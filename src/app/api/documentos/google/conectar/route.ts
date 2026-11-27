import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { envGoogle } from "@/lib/env";
import { urlAutorizacao } from "@/lib/documentos/google";
import { origemDaRequisicao } from "@/lib/origem";

/** Início da conexão com o Google Drive: só o administrador da Central. Guarda um código aleatório (state) em cookie. */
export async function GET() {
  const usuario = await obterUsuarioAtual();
  const origem = await origemDaRequisicao();
  if (!usuario?.ativo || !usuario.admin_hub) return NextResponse.redirect(new URL("/", origem));
  const google = envGoogle();
  if (!google) return NextResponse.redirect(new URL("/configuracoes/documentos?erro=sem_credenciais", origem));

  const state = randomBytes(24).toString("base64url");
  const resposta = NextResponse.redirect(
    urlAutorizacao({ clientId: google.GOOGLE_OAUTH_CLIENT_ID, redirectUri: `${origem}/api/documentos/google/callback`, state })
  );
  resposta.cookies.set("docs_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/documentos/google", maxAge: 600 });
  return resposta;
}
