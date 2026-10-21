import { redirect } from "next/navigation";

import { obterContextoEmendas } from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";

export default async function PaginaConfiguracoesEmendas() {
  const ctx = await obterContextoEmendas();
  redirect(ctx.situacao === "ok" && ehGestor(ctx.perfil) ? "/emendas/configuracoes/exercicio" : "/emendas/configuracoes/usuarios");
}
