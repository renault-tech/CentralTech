import "server-only";

import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteNumeraAdmin } from "@/lib/supabase/numera-admin";

/**
 * Bug real de produção (30/09/2026 — Alexandre, Junia e outros): quem só
 * tinha Numera ganhou uma conta no Hub pelo provisionamento de acesso
 * (`encontrarOuCriarConta`), criada com SENHA ALEATÓRIA — e o link de
 * primeiro acesso que deveria deixá-la definir a senha nunca foi gerado
 * (ver `gerarLinkPrimeiroAcesso`). Resultado: essas pessoas digitavam no
 * Hub a senha de sempre (a do Numera) e recebiam "E-mail ou senha
 * incorretos", sem nenhum jeito de sair disso.
 *
 * Quando o login do Hub falha, confere a MESMA senha no projeto do Numera.
 * Se o Numera aceitar (e a conta de lá estiver aprovada), grava essa senha
 * na conta do Hub — "uma senha só", que é o que a pessoa já espera. Só age
 * sobre conta do Hub que NUNCA fez login (`last_sign_in_at` nulo, ou seja,
 * ainda com a senha aleatória do provisionamento) e que tem registro no
 * Hub: nunca sobrescreve uma senha que alguém já usa no Compras/
 * Requerimentos/Hub.
 */
export async function alinharSenhaComNumera(email: string, senha: string): Promise<boolean> {
  try {
    const admin = criarClienteAdminBruto();
    const { data: hubUsuario } = await admin
      .schema("hub")
      .from("usuarios")
      .select("id, ativo")
      .ilike("email", email)
      .maybeSingle();
    if (!hubUsuario?.ativo) return false;

    const { data: conta } = await admin.auth.admin.getUserById(hubUsuario.id);
    if (!conta.user || conta.user.last_sign_in_at) return false;

    const numera = criarClienteNumeraAdmin();
    const { data: login, error: erroLogin } = await numera.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (erroLogin || !login.user) return false;
    await numera.auth.signOut({ scope: "local" });

    const { data: perfilNumera } = await numera
      .from("users")
      .select("approved")
      .eq("id", login.user.id)
      .maybeSingle();
    if (!perfilNumera?.approved) return false;

    const { error: erroAtualizar } = await admin.auth.admin.updateUserById(hubUsuario.id, {
      password: senha,
    });
    if (erroAtualizar) {
      console.error("[alinharSenhaComNumera] updateUserById:", erroAtualizar.message);
      return false;
    }
    return true;
  } catch (e) {
    // Ex.: chave service_role do Numera ausente nesta implantação.
    console.error("[alinharSenhaComNumera] falha:", e);
    return false;
  }
}
