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

/** Página de destino em cada app que consome o fragmento da URL e loga
 * sozinha (mesmo mecanismo já usado e validado na recuperação de senha:
 * `detectSessionInUrl` do cliente do navegador). Numera não tem uma rota
 * dedicada — a raiz do app já estabelece a sessão a partir do fragmento
 * (mesmo comportamento que a recuperação de senha de lá já usa), por isso
 * não aceita um `proximo` próprio (é uma SPA sem rotas de URL). */
const DESTINO_SSO: Record<Modulo, string> = {
  compras: "/auth/entrar-via-hub",
  requerimentos: "/auth/entrar-via-hub",
  numera: "/",
};

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
  const redirectTo =
    modulo === "numera"
      ? info.url
      : `${info.url}${DESTINO_SSO[modulo]}${proximo ? `?proximo=${encodeURIComponent(proximo)}` : ""}`;

  try {
    const admin = modulo === "numera" ? criarClienteNumeraAdmin() : criarClienteAdminBruto();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: usuario.email,
      options: { redirectTo },
    });
    if (error || !data?.properties?.action_link) {
      console.error(`[gerarLinkSso] generateLink falhou (${modulo}):`, error);
      return { ok: false, motivo: "falha_ao_gerar" };
    }
    return { ok: true, link: data.properties.action_link };
  } catch (e) {
    // Numera lança se a env var da chave service_role dele não estiver
    // configurada nesta implantação (ver `criarClienteNumeraAdmin`).
    console.error(`[gerarLinkSso] falha inesperada (${modulo}):`, e);
    return { ok: false, motivo: "falha_ao_gerar" };
  }
}
