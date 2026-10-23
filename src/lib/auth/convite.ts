import { escaparLike } from "@/lib/seguranca/escapar-like";
import "server-only";

import { randomBytes } from "node:crypto";

import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteNumeraAdmin } from "@/lib/supabase/numera-admin";

/**
 * Link de primeiro acesso PERSISTENTE (`hub.convites_acesso`).
 *
 * O link nativo do Supabase (recovery) é de uso único e expira em cerca de
 * 1 hora: quem o recebia tarde, ou clicava duas vezes, ficava com a senha
 * aleatória do provisionamento e via "E-mail ou senha incorretos". Aqui o
 * token é da própria Central e fica valendo até a senha ser definida de
 * fato; cada clique (`/primeiro-acesso`) gera na hora um token novo do
 * Supabase e segue o fluxo de `/auth/confirm` → `/redefinir-senha`.
 */

export function linkDoConvite(origemHub: string, token: string): string {
  return `${origemHub}/primeiro-acesso?t=${encodeURIComponent(token)}`;
}

/** Token válido e ainda não usado da pessoa; cria (ou renova, se o anterior
 * já foi usado) quando não há. */
export async function garantirConvite(usuarioId: string): Promise<string> {
  const admin = criarClienteAdminBruto().schema("hub");

  const { data: existente } = await admin
    .from("convites_acesso")
    .select("token, usado_em")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (existente && !existente.usado_em) return existente.token as string;

  const token = randomBytes(32).toString("base64url");
  const { error } = await admin
    .from("convites_acesso")
    .upsert({ usuario_id: usuarioId, token, criado_em: new Date().toISOString(), usado_em: null });
  if (error) throw new Error(`Não foi possível gravar o link de primeiro acesso: ${error.message}`);
  return token;
}

/** Quem o token pertence, se ainda estiver pendente. */
export async function usuarioDoConvite(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  const { data } = await criarClienteAdminBruto()
    .schema("hub")
    .from("convites_acesso")
    .select("usuario_id, usado_em")
    .eq("token", token)
    .maybeSingle();
  if (!data || data.usado_em) return null;
  return data.usuario_id as string;
}

/** Há um convite pendente para esta pessoa (primeiro acesso em andamento)? */
export async function temConvitePendente(usuarioId: string): Promise<boolean> {
  const { data } = await criarClienteAdminBruto()
    .schema("hub")
    .from("convites_acesso")
    .select("usado_em")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  return !!data && !data.usado_em;
}

/** Marca o convite como usado (idempotente; não faz nada se já foi). */
export async function marcarConviteUsado(usuarioId: string): Promise<void> {
  const { error } = await criarClienteAdminBruto()
    .schema("hub")
    .from("convites_acesso")
    .update({ usado_em: new Date().toISOString() })
    .eq("usuario_id", usuarioId)
    .is("usado_em", null);
  if (error) console.error("[marcarConviteUsado] falha:", error.message);
}

/**
 * "Uma senha só": no primeiro acesso, a senha escolhida vale também para a
 * conta do Numera (projeto Supabase separado). Só roda quando existe convite
 * pendente — nunca sobrescreve a senha do Numera de quem já usa a conta (ex.:
 * alguém que só pediu "esqueci minha senha" do Hub). Falhas não derrubam a
 * troca de senha do Hub; ficam no log.
 */
export async function sincronizarSenhaNumera(email: string, senha: string): Promise<void> {
  try {
    const numera = criarClienteNumeraAdmin();
    const { data: perfil } = await numera.from("users").select("id").ilike("email", escaparLike(email)).maybeSingle();
    if (!perfil?.id) return;
    const { error } = await numera.auth.admin.updateUserById(perfil.id as string, { password: senha });
    if (error) console.error("[sincronizarSenhaNumera] updateUserById:", error.message);
  } catch (e) {
    // Ex.: NUMERA_SUPABASE_SERVICE_ROLE_KEY ausente nesta implantação.
    console.error("[sincronizarSenhaNumera] falha:", e);
  }
}
