import { cache } from "react";

import { obterUsuarioAtual } from "@/lib/auth/perfil";

/**
 * Confere (de novo, no ponto de uso) que a sessão é de um admin do Hub ativo.
 * O layout de `/configuracoes` já barra quem não é admin, mas layouts do App
 * Router não são reavaliados em toda navegação entre rotas filhas e as páginas
 * renderizam em paralelo com ele: toda leitura que usa a chave de serviço
 * (que ignora a RLS) chama isto primeiro. Um admin rebaixado com a aba aberta
 * deixa de enxergar contas e links de convite na hora.
 */
export const exigirAdminHub = cache(async () => {
  const usuario = await obterUsuarioAtual();
  if (!usuario?.ativo || !usuario.admin_hub) {
    throw new Error("Acesso restrito a administradores do Hub.");
  }
  return usuario;
});
