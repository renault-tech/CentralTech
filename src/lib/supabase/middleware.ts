import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { envPublico } from "@/lib/env";

/** Rotas públicas (auth) — tudo o mais neste hub exige sessão.
 *
 * Bug real encontrado ao investigar por que /api/numera/recuperar-senha
 * nunca funcionava: essa rota (chamada sem sessão, via fetch cross-origin
 * do site estático do Numera) não estava nesta lista, então o middleware
 * redirecionava (307) TUDO que chegava nela — inclusive o preflight
 * OPTIONS do CORS — direto para /login, antes mesmo do código da rota
 * rodar. Confirmado nos logs de runtime da Vercel: OPTIONS
 * /api/numera/recuperar-senha 307, nenhum POST chegando a executar. */
const ROTAS_PUBLICAS = [
  "/login",
  "/recuperar-senha",
  "/redefinir-senha",
  "/auth/confirm",
  "/solicitar-acesso",
  "/api/numera/recuperar-senha",
];

/**
 * Renova a sessão do Supabase a cada requisição e aplica o redirecionamento
 * básico: sem sessão em rota protegida vai para /login; com sessão em
 * /login vai para /.
 */
export async function atualizarSessao(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const env = envPublico();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const rotaPublica = ROTAS_PUBLICAS.some((prefixo) => pathname.startsWith(prefixo));

  if (!user && !rotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("proximo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
