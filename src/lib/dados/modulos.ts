import { criarClienteServidor } from "@/lib/supabase/server";
import type { UsuarioHub } from "@/types/database";

export { MODULOS } from "@/lib/modulos-info";
export type { InfoModulo } from "@/lib/modulos-info";

import { MODULOS, type InfoModulo } from "@/lib/modulos-info";

/** Módulos que o usuário logado pode ver — admin_hub vê todos, os demais só os liberados. */
export async function listarMeusModulos(usuario: UsuarioHub): Promise<InfoModulo[]> {
  if (usuario.admin_hub) {
    return Object.values(MODULOS);
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("acessos_modulo")
    .select("modulo")
    .eq("usuario_id", usuario.id);

  if (error) {
    console.error("[listarMeusModulos] falha:", error);
    throw new Error("Não foi possível carregar seus módulos.");
  }

  return (data ?? []).map((a) => MODULOS[a.modulo]);
}
