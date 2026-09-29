"use server";

import { redirect } from "next/navigation";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { MODULOS } from "@/lib/modulos-info";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteNumeraAdmin } from "@/lib/supabase/numera-admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Modulo } from "@/types/database";

/**
 * SSO por magic link: elimina a segunda senha ao abrir um módulo pelo Hub.
 *
 * Cada app (Compras, Requerimentos, Numera) continua com login próprio —
 * não existe SSO real de sessão entre os projetos Supabase (dois deles nem
 * compartilham o mesmo projeto). Em vez disso, esta action gera um link de
 * autenticação de USO ÚNICO (`generateLink({type:"magiclink"})`) pelo lado
 * do servidor, com a chave `service_role`, e manda o navegador direto pra
 * lá — o app de destino nunca vê nem pede a senha de novo.
 *
 * Duas garantias de segurança, deliberadas:
 * 1. O e-mail usado no `generateLink` vem SEMPRE da sessão do Hub já
 *    autenticada (`obterUsuarioAtual()`), nunca de um parâmetro do
 *    cliente — um `modulo` malicioso não muda pra quem o link é gerado.
 * 2. Confere de novo que a pessoa tem acesso ao módulo (mesma checagem que
 *    já decide o que aparece na home) antes de gerar qualquer link — defesa
 *    em profundidade, não confia só na UI ter escondido o botão certo.
 *
 * O link é gerado na hora, a cada clique — nunca cacheado/persistido — e
 * expira sozinho pelas regras padrão do Supabase Auth, minimizando exposição
 * se por algum motivo a URL acabar retida em algum log de proxy/histórico.
 */

/** Página de destino em cada app que consome o fragmento da URL e loga
 * sozinha (mesmo mecanismo já usado e validado na recuperação de senha:
 * `detectSessionInUrl` do cliente do navegador). Numera não tem uma rota
 * dedicada — a raiz do app já estabelece a sessão a partir do fragmento
 * (mesmo comportamento que a recuperação de senha de lá já usa). */
const DESTINO_SSO: Record<Modulo, string> = {
  compras: "/auth/entrar-via-hub",
  requerimentos: "/auth/entrar-via-hub",
  numera: "/",
};

async function temAcessoAoModulo(usuarioId: string, adminHub: boolean, modulo: Modulo): Promise<boolean> {
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

/** Auth Admin API mínima usada aqui — `generateLink` com `type: "magiclink"`
 * não está no tipo estreito já existente em `provisionamento-modulos.ts`
 * (que só cobre invite/recovery), então usa o client de verdade direto. */
export async function abrirModulo(modulo: Modulo): Promise<void> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) {
    redirect("/login");
  }
  if (!usuario.ativo) {
    redirect("/login?motivo=desativado");
  }

  const liberado = await temAcessoAoModulo(usuario.id, usuario.admin_hub, modulo);
  if (!liberado) {
    redirect("/?erro=sem_acesso");
  }

  const info = MODULOS[modulo];
  const redirectTo = `${info.url}${DESTINO_SSO[modulo]}`;

  let actionLink: string | undefined;
  try {
    const admin = modulo === "numera" ? criarClienteNumeraAdmin() : criarClienteAdminBruto();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: usuario.email,
      options: { redirectTo },
    });
    if (error) {
      console.error(`[abrirModulo] generateLink falhou (${modulo}):`, error);
    } else {
      actionLink = data?.properties?.action_link ?? undefined;
    }
  } catch (e) {
    // Numera lança se a env var da chave service_role dele não estiver
    // configurada nesta implantação (ver `criarClienteNumeraAdmin`) — cai
    // pro link direto de sempre em vez de travar o acesso ao módulo.
    console.error(`[abrirModulo] falha inesperada (${modulo}):`, e);
  }

  redirect(actionLink ?? info.url);
}
