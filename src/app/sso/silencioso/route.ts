import { NextResponse, type NextRequest } from "next/server";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { MODULOS } from "@/lib/modulos-info";
import { destinoSeguro } from "@/lib/seguranca/destino-seguro";
import { gerarLinkSso } from "@/lib/sso/gerar-link";
import type { Modulo } from "@/types/database";

export const dynamic = "force-dynamic";

function ehModulo(valor: string | null): valor is Modulo {
  return !!valor && valor in MODULOS;
}

/**
 * Checagem de SSO silenciosa: login unificado pelo Hub (pedido do usuário —
 * "quero que a pessoa faça login pelo hub e que esse login já libere a
 * pessoa a entrar direto no app... sem precisar fazer login em cada app").
 *
 * Cada app (Compras, Requerimentos, Numera), ao não achar uma sessão
 * própria — mesmo entrando DIRETO pela URL do app, sem passar pelo Hub —
 * navega (página inteira, nunca `fetch`: o cookie de sessão do Hub é
 * first-party só numa navegação de verdade, um `fetch` cross-origin não o
 * enviaria) pra cá antes de mostrar o próprio formulário de senha:
 *
 * - **Sessão do Hub válida + acesso ao módulo** → gera o link mágico de uso
 *   único (mesmo núcleo de `abrirModulo`) e manda o navegador direto pro
 *   app, já autenticado, sem pedir senha nenhuma.
 * - **Sem sessão nenhuma (nem no Hub)** → manda logar no Hub primeiro
 *   (`/login`, com `proximo` apontando de volta pra cá) — decisão explícita
 *   do usuário: login único, sempre pela tela do Hub, nunca a do app.
 *   Depois de logar lá, esta rota roda de novo e já encontra a sessão.
 * - **Sessão do Hub válida mas SEM acesso ao módulo, ou falha ao gerar o
 *   link** → devolve pro login do PRÓPRIO app (`ssoFalhou=1`, evita
 *   tentar de novo em loop) — nunca trava o acesso: se a pessoa tem uma
 *   conta direta nesse app fora do Hub, ainda consegue entrar por ela.
 *
 * Timeout: nenhum aqui (só lê a própria sessão/tabela do Hub, rápido por
 * natureza) — o app que chama isto é quem tem um timeout curto antes de
 * decidir mostrar o próprio formulário em vez de esperar por esta rota
 * (mesmo padrão já usado em `esta_bloqueado_login_direto`).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const appParam = searchParams.get("app");

  if (!ehModulo(appParam)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  const modulo = appParam;
  const info = MODULOS[modulo];
  const proximo = destinoSeguro(searchParams.get("proximo"), "/");

  const usuario = await obterUsuarioAtual();
  if (!usuario || !usuario.ativo) {
    const destinoSilencioso = `/sso/silencioso?app=${modulo}&proximo=${encodeURIComponent(proximo)}`;
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("proximo", destinoSilencioso);
    return NextResponse.redirect(loginUrl);
  }

  const resultado = await gerarLinkSso(usuario, modulo, modulo === "numera" ? undefined : proximo);
  if (!resultado.ok) {
    return NextResponse.redirect(`${info.url}/login?ssoFalhou=1`);
  }
  return NextResponse.redirect(resultado.link);
}
