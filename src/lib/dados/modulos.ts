import { criarClienteServidor } from "@/lib/supabase/server";
import type { UsuarioHub } from "@/types/database";

export { MODULOS } from "@/lib/modulos-info";
export type { InfoModulo } from "@/lib/modulos-info";

import { MODULOS, type InfoModulo } from "@/lib/modulos-info";

export type ModuloComAcesso = InfoModulo & { temAcesso: boolean };

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
    return Object.values(MODULOS).map((m) => ({ ...m, temAcesso: true }));
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("acessos_modulo")
    .select("modulo")
    .eq("usuario_id", usuario.id);

  if (error) {
    console.error("[listarModulosComAcesso] falha:", error);
    throw new Error("Não foi possível carregar seus módulos.");
  }

  const liberados = new Set((data ?? []).map((a) => a.modulo));
  return Object.values(MODULOS).map((m) => ({ ...m, temAcesso: liberados.has(m.chave) }));
}
