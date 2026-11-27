import "server-only";

import { exigirAdminHub } from "@/lib/auth/exigir-admin";
import { resolverPermissoes, type AjusteDocumentos } from "@/lib/documentos/permissoes-regra";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";

export type LinhaPermissaoDocumentos = {
  usuarioId: string;
  nome: string;
  email: string;
  perfil: string;
  secretaria: string | null;
  ajusteEnviar: boolean | null;
  ajusteAnalisar: boolean | null;
  enviar: boolean;
  analisar: boolean;
};

/** Pessoas que usam o Emendas (e o administrador), com o padrão do perfil e o ajuste de documentos. Só administrador. */
export async function listarPermissoesDocumentos(): Promise<LinhaPermissaoDocumentos[]> {
  await exigirAdminHub();
  const bruto = criarClienteAdminBruto();
  const [{ data: hub }, { data: emendas }, { data: secretarias }, { data: ajustes }] = await Promise.all([
    bruto.schema("hub").from("usuarios").select("id,nome,email,ativo,admin_hub").eq("ativo", true),
    bruto.schema("emendas").from("usuarios").select("id,perfil,ativo,secretaria_id"),
    bruto.schema("emendas").from("secretarias").select("id,nome"),
    bruto.schema("hub").from("permissoes_documentos").select("usuario_id,pode_enviar,pode_analisar"),
  ]);
  const perfis = new Map((emendas ?? []).filter((e) => e.ativo).map((e) => [e.id as string, e]));
  const nomeSec = new Map((secretarias ?? []).map((s) => [s.id as string, s.nome as string]));
  const ajusteDe = new Map((ajustes ?? []).map((a) => [a.usuario_id as string, a as AjusteDocumentos & { usuario_id: string }]));
  const linhas: LinhaPermissaoDocumentos[] = [];
  for (const h of hub ?? []) {
    const e = perfis.get(h.id as string);
    const perfil = h.admin_hub ? "admin" : (e?.perfil as string | undefined);
    if (!perfil) continue;
    const aj = ajusteDe.get(h.id as string) ?? null;
    const ef = resolverPermissoes(perfil, aj);
    linhas.push({
      usuarioId: h.id as string,
      nome: h.nome as string,
      email: h.email as string,
      perfil,
      secretaria: e?.secretaria_id ? (nomeSec.get(e.secretaria_id as string) ?? null) : null,
      ajusteEnviar: aj?.pode_enviar ?? null,
      ajusteAnalisar: aj?.pode_analisar ?? null,
      enviar: ef.enviar,
      analisar: ef.analisar,
    });
  }
  return linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
