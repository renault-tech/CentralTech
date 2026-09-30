import "server-only";

import { MODULOS } from "@/lib/modulos-info";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteNumeraAdmin } from "@/lib/supabase/numera-admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Modulo } from "@/types/database";

/**
 * Núcleo do SSO por magic link — compartilhado entre o clique explícito no
 * card do Hub (`abrirModulo`) e a checagem silenciosa (`/sso/silencioso`,
 * chamada pelos próprios apps quando não têm sessão), pra não duplicar a
 * mesma regra de segurança em dois lugares (nunca aceitar e-mail do
 * cliente, conferir acesso de novo antes de gerar qualquer link).
 */

type SessaoGerada = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
};

/**
 * Monta a URL do app com a sessão no fragmento, no MESMO formato que o
 * GoTrue usaria no redirect do `/verify` (fluxo implícito) — só que sem
 * passar pelo `/verify`, portanto sem depender da "Site URL"/"Redirect URLs"
 * do projeto. Usado só para o Numera (SPA estática, cliente supabase-js
 * padrão em fluxo implícito, que lê esse fragmento sozinho ao carregar).
 * `tipo=recovery` faz o cliente disparar `PASSWORD_RECOVERY` (tela de
 * definir senha); qualquer outro vira `SIGNED_IN`.
 */
export function urlComSessaoNoFragmento(base: string, sessao: SessaoGerada, tipo: string): string {
  const params = new URLSearchParams({
    access_token: sessao.access_token,
    expires_at: String(sessao.expires_at ?? Math.floor(Date.now() / 1000) + sessao.expires_in),
    expires_in: String(sessao.expires_in),
    refresh_token: sessao.refresh_token,
    token_type: sessao.token_type,
    type: tipo,
  });
  return `${base.replace(/\/$/, "")}/#${params.toString()}`;
}

export async function temAcessoAoModulo(usuarioId: string, adminHub: boolean, modulo: Modulo): Promise<boolean> {
  if (adminHub) return true;
  const hub = await criarClienteServidor();
  const { data } = await hub
    .from("acessos_modulo")
    .select("modulo")
    .eq("usuario_id", usuarioId)
    .eq("modulo", modulo)
    .maybeSingle();
  return !!data;
}

export type ResultadoLinkSso =
  | { ok: true; link: string }
  | { ok: false; motivo: "sem_acesso" | "falha_ao_gerar" };

export async function gerarLinkSso(
  usuario: { id: string; email: string; admin_hub: boolean },
  modulo: Modulo,
  proximo?: string
): Promise<ResultadoLinkSso> {
  const liberado = await temAcessoAoModulo(usuario.id, usuario.admin_hub, modulo);
  if (!liberado) {
    return { ok: false, motivo: "sem_acesso" };
  }

  const info = MODULOS[modulo];

  // Bug real de produção (30/09/2026): antes, o link devolvido era o
  // `action_link` do GoTrue (`.../auth/v1/verify?...&redirect_to=...`), que
  // só respeita o `redirect_to` se ele estiver na allow-list "Redirect URLs"
  // do projeto — senão cai na "Site URL". No projeto do Numera a Site URL é
  // `http://localhost:3000` e o domínio do app não está na allow-list:
  // TODO clique em "Numera" no Hub terminava em localhost:3000
  // (ERR_CONNECTION_REFUSED). E no Compras/Requerimentos, mesmo com o
  // redirect aceito, a sessão chegava como fragmento `#access_token=`, que o
  // cliente `@supabase/ssr` (fluxo PKCE) RECUSA ("Not a valid PKCE flow url")
  // — a sessão nunca era gravada, a pessoa voltava pro login em loop.
  // Agora o `/verify` do GoTrue não participa mais: só o `hashed_token` do
  // link gerado é usado, validado no servidor de destino (Compras/
  // Requerimentos, `/auth/confirm` com `verifyOtp`, grava a sessão em
  // cookie) ou aqui mesmo (Numera, que é estático e não tem servidor).
  try {
    const admin = modulo === "numera" ? criarClienteNumeraAdmin() : criarClienteAdminBruto();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: usuario.email,
    });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) {
      console.error(`[gerarLinkSso] generateLink falhou (${modulo}):`, error);
      return { ok: false, motivo: "falha_ao_gerar" };
    }

    if (modulo !== "numera") {
      const destino = new URL("/auth/confirm", info.url);
      destino.searchParams.set("token_hash", tokenHash);
      destino.searchParams.set("type", "magiclink");
      destino.searchParams.set("next", proximo ?? "/dashboard");
      return { ok: true, link: destino.toString() };
    }

    const { data: verificado, error: erroVerificacao } = await admin.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    if (erroVerificacao || !verificado.session) {
      console.error("[gerarLinkSso] verifyOtp falhou (numera):", erroVerificacao);
      return { ok: false, motivo: "falha_ao_gerar" };
    }
    return { ok: true, link: urlComSessaoNoFragmento(info.url, verificado.session, "magiclink") };
  } catch (e) {
    // Numera lança se a env var da chave service_role dele não estiver
    // configurada nesta implantação (ver `criarClienteNumeraAdmin`).
    console.error(`[gerarLinkSso] falha inesperada (${modulo}):`, e);
    return { ok: false, motivo: "falha_ao_gerar" };
  }
}
