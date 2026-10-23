import { NextResponse, type NextRequest } from "next/server";

import { criarClienteNumeraAdmin } from "@/lib/supabase/numera-admin";
import { MODULOS } from "@/lib/modulos-info";
import { htmlConfirmarLink, respostaHtml } from "@/lib/seguranca/pagina-confirmar";
import { urlComSessaoNoFragmento } from "@/lib/sso/gerar-link";

export const dynamic = "force-dynamic";

const TIPOS = ["recovery", "invite", "magiclink"] as const;
type Tipo = (typeof TIPOS)[number];

function ehTipo(valor: string | null): valor is Tipo {
  return !!valor && (TIPOS as readonly string[]).includes(valor);
}

/**
 * Destino dos links de e-mail do Numera (recuperação de senha e primeiro
 * acesso). O projeto Supabase do Numera tem "Site URL" `localhost:3000` e o
 * domínio do app fora da allow-list de "Redirect URLs", então o `/verify`
 * do GoTrue mandava todo link pra localhost. Aqui o `token_hash` é validado
 * no servidor (`verifyOtp`) e o navegador vai direto pro Numera com a
 * sessão no fragmento — mesmo formato que o GoTrue usaria. Convite e
 * recuperação chegam como `type=recovery`, que é o evento que a tela de
 * definir senha do Numera escuta (`PASSWORD_RECOVERY`).
 *
 * O GET só mostra um botão: antivírus e prévia de e-mail abrem o link com GET
 * e gastavam o token de uso único antes da pessoa. Só o POST (clique) valida.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const tipo = request.nextUrl.searchParams.get("type");

  if (!tokenHash || !ehTipo(tipo)) {
    return NextResponse.redirect(`${MODULOS.numera.url}/?ssoFalhou=1`);
  }

  return respostaHtml(
    htmlConfirmarLink({
      acao: "/api/numera/abrir-link",
      campos: { token_hash: tokenHash, type: tipo },
      titulo: tipo === "magiclink" ? "Entrar no Numera" : "Definir sua senha do Numera",
      texto: "Para continuar, toque no botão abaixo. Este link só pode ser usado uma vez.",
      botao: "Continuar",
    })
  );
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const tipo = String(form.get("type") ?? "");
  const numera = MODULOS.numera.url;

  if (!tokenHash || !ehTipo(tipo)) {
    return NextResponse.redirect(`${numera}/?ssoFalhou=1`, 303);
  }

  try {
    const { data, error } = await criarClienteNumeraAdmin().auth.verifyOtp({
      type: tipo,
      token_hash: tokenHash,
    });
    if (error || !data.session) {
      console.error("[numera/abrir-link] verifyOtp:", error?.message);
      return NextResponse.redirect(`${numera}/?ssoFalhou=1`, 303);
    }
    const tipoNoApp = tipo === "magiclink" ? "magiclink" : "recovery";
    return NextResponse.redirect(urlComSessaoNoFragmento(numera, data.session, tipoNoApp), 303);
  } catch (e) {
    console.error("[numera/abrir-link] erro inesperado:", e);
    return NextResponse.redirect(`${numera}/?ssoFalhou=1`, 303);
  }
}
