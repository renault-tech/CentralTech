import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { UsuarioHub } from "@/types/database";

export { MODULOS } from "@/lib/modulos-info";
export type { InfoModulo } from "@/lib/modulos-info";

import { MODULOS, type InfoModulo } from "@/lib/modulos-info";

export type ModuloComAcesso = InfoModulo & { temAcesso: boolean; pedidoPendente: boolean };

/** Módulos para os quais a pessoa da sessão já tem pedido de acesso pendente.
 * Só roda no servidor e só com o e-mail da própria sessão. */
async function modulosComPedidoPendente(email: string): Promise<Set<string>> {
  try {
    const emailLike = email.replace(/[\\%_]/g, "\\$&");
    const { data } = await criarClienteAdminBruto()
      .schema("hub")
      .from("solicitacoes_acesso")
      .select("modulos_solicitados")
      .eq("status", "pendente")
      .ilike("email", emailLike);
    return new Set((data ?? []).flatMap((p) => p.modulos_solicitados as string[]));
  } catch (e) {
    console.error("[modulosComPedidoPendente] falha:", e);
    return new Set();
  }
}

/**
 * TODOS os módulos do catálogo, cada um marcado com `temAcesso` — não só
 * os liberados. Pedido do dono: "quando a pessoa não tem acesso a algum
 * app, deve aparecer em transparência no hub e não permitir tentar
 * acesso" — a página inicial escondia por completo o que a pessoa não
 * tinha (`listarMeusModulos`, substituída por esta), então ninguém sabia
 * nem que "Requerimentos" existia para pedir acesso; e nada impedia
 * clicar direto no link de um app onde a pessoa nunca vai conseguir
 * entrar (mesmo tentando a senha certa) — parte da confusão real já
 * investigada (usuária "tentou por um, era por outro").
 */
export async function listarModulosComAcesso(usuario: UsuarioHub): Promise<ModuloComAcesso[]> {
  if (usuario.admin_hub) {
    return Object.values(MODULOS).map((m) => ({ ...m, temAcesso: true, pedidoPendente: false }));
  }

  const supabase = await criarClienteServidor();
  const [{ data, error }, pedidos] = await Promise.all([
    supabase.from("acessos_modulo").select("modulo").eq("usuario_id", usuario.id),
    modulosComPedidoPendente(usuario.email),
  ]);

  if (error) {
    console.error("[listarModulosComAcesso] falha:", error);
    throw new Error("Não foi possível carregar seus módulos.");
  }

  const liberados = new Set((data ?? []).map((a) => a.modulo));
  return Object.values(MODULOS).map((m) => ({
    ...m,
    temAcesso: liberados.has(m.chave),
    pedidoPendente: !liberados.has(m.chave) && pedidos.has(m.chave),
  }));
}
