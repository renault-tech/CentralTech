"use server";

import { redirect } from "next/navigation";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { MODULOS } from "@/lib/modulos-info";
import { gerarLinkSso } from "@/lib/sso/gerar-link";
import type { Modulo } from "@/types/database";

/**
 * SSO por magic link ao clicar num módulo liberado na home do Hub. Ver
 * `src/lib/sso/gerar-link.ts` para o núcleo (compartilhado com
 * `/sso/silencioso`, a checagem automática que cada app faz quando não tem
 * sessão própria — ver comentário lá para o desenho completo do login
 * unificado).
 *
 * Duas garantias de segurança, deliberadas:
 * 1. O e-mail usado no `generateLink` vem SEMPRE da sessão do Hub já
 *    autenticada (`obterUsuarioAtual()`), nunca de um parâmetro do
 *    cliente — um `modulo` malicioso não muda pra quem o link é gerado.
 * 2. Confere de novo que a pessoa tem acesso ao módulo (mesma checagem que
 *    já decide o que aparece na home) antes de gerar qualquer link — defesa
 *    em profundidade, não confia só na UI ter escondido o botão certo.
 */
export async function abrirModulo(modulo: Modulo): Promise<void> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) {
    redirect("/login");
  }
  if (!usuario.ativo) {
    redirect("/login?motivo=desativado");
  }

  const resultado = await gerarLinkSso(usuario, modulo);
  if (!resultado.ok) {
    if (resultado.motivo === "sem_acesso") {
      redirect("/?erro=sem_acesso");
    }
    // Falha ao gerar o link (API fora do ar, chave do Numera ausente etc.)
    // — cai pro login direto do próprio app, nunca trava o acesso ao
    // módulo. `ssoFalhou=1` evita que o /login de lá tente a checagem
    // silenciosa de novo e reproduza a mesma falha em loop.
    redirect(`${MODULOS[modulo].url}/login?ssoFalhou=1`);
  }
  redirect(resultado.link);
}
