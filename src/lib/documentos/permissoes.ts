import "server-only";

import { resolverPermissoes, type AjusteDocumentos, type PermissoesDocumentos } from "@/lib/documentos/permissoes-regra";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";

/** Permissões efetivas de uma pessoa (padrão do perfil + ajuste). Chamar só com o id da própria sessão ou como admin. */
export async function permissoesDocumentos(usuarioId: string, perfil: string | null): Promise<PermissoesDocumentos> {
  const hub = criarClienteAdminBruto().schema("hub");
  const { data } = await hub.from("permissoes_documentos").select("pode_enviar,pode_analisar").eq("usuario_id", usuarioId).maybeSingle();
  return resolverPermissoes(perfil, (data as AjusteDocumentos) ?? null);
}
