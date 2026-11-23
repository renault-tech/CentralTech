import { exigirAdminHub } from "@/lib/auth/exigir-admin";
import { origemDaRequisicao } from "@/lib/origem";
import { linkDoConvite } from "@/lib/auth/convite";
import { CHAVES_COMPRAS } from "@/lib/permissoes/catalogo";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Modulo } from "@/types/database";

export type UsuarioComAcessos = {
  id: string;
  nome: string;
  email: string;
  adminHub: boolean;
  ativo: boolean;
  modulos: Modulo[];
  /** Nunca fez login (ainda não usou o acesso). */
  nuncaEntrou: boolean;
  /** Link de primeiro acesso pendente — some quando a pessoa define a senha. */
  linkPrimeiroAcesso: string | null;
  /**
   * Permissões de Contratos do Compras (`public.permissoes`: contratos_ver / contratos_editar). `null` = a pessoa não tem conta
   * no Compras (nada a definir). Ver contratos NÃO vem do perfil: sem a linha `contratos_ver`, o setor de Contratos não enxerga nada.
   */
  contratos: { ver: boolean; editar: boolean; deContratos: boolean } | null;
  /** Perfil e permissões ligadas no Compras (`public.permissoes`, só chaves do catálogo). `null` = sem conta no Compras. */
  compras: { perfil: string; ligadas: string[] } | null;
};

/** Contratos do Compras por pessoa. Falha aqui não derruba a lista (some só o controle). */
async function permissoesDeContratos(): Promise<Map<string, { ver: boolean; editar: boolean; deContratos: boolean; perfil: string; ligadas: string[] }> | null> {
  try {
    const admin = criarClienteAdminBruto();
    const [{ data: contas }, { data: perms }] = await Promise.all([
      admin.schema("public").from("usuarios").select("id, perfil"),
      admin.schema("public").from("permissoes").select("usuario_id, chave, permitido").in("chave", CHAVES_COMPRAS),
    ]);
    const mapa = new Map<string, { ver: boolean; editar: boolean; deContratos: boolean; perfil: string; ligadas: string[] }>(
      (contas ?? []).map((c) => [
        c.id as string,
        { ver: false, editar: false, perfil: String(c.perfil), ligadas: [], deContratos: c.perfil === "serv_contratos" || c.perfil === "coord_contratos" },
      ])
    );
    for (const x of perms ?? []) {
      const m = mapa.get(x.usuario_id as string);
      if (!m || !x.permitido) continue;
      m.ligadas.push(x.chave as string);
      if (x.chave === "contratos_ver") m.ver = true;
      else if (x.chave === "contratos_editar") m.editar = true;
    }
    return mapa;
  } catch (e) {
    console.error("[listarUsuariosComAcessos] permissões de contratos indisponíveis:", e);
    return null;
  }
}

/** Quem ainda não acessou e qual link de primeiro acesso está pendente.
 * Falha aqui não derruba a lista: só some a informação do link. */
async function situacaoDePrimeiroAcesso(): Promise<{
  ultimoAcesso: Map<string, string | null>;
  convites: Map<string, string>;
  origem: string;
} | null> {
  try {
    const admin = criarClienteAdminBruto();
    const [{ data: contas }, { data: convites }, origem] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.schema("hub").from("convites_acesso").select("usuario_id, token, usado_em"),
      origemDaRequisicao(),
    ]);
    return {
      ultimoAcesso: new Map((contas?.users ?? []).map((c) => [c.id, c.last_sign_in_at ?? null])),
      convites: new Map(
        (convites ?? []).filter((c) => !c.usado_em).map((c) => [c.usuario_id as string, c.token as string])
      ),
      origem,
    };
  } catch (e) {
    console.error("[listarUsuariosComAcessos] situação de primeiro acesso indisponível:", e);
    return null;
  }
}

export async function listarUsuariosComAcessos(): Promise<UsuarioComAcessos[]> {
  await exigirAdminHub();
  const supabase = await criarClienteServidor();
  const [{ data: usuarios, error: erroUsuarios }, { data: acessos, error: erroAcessos }, primeiroAcesso, contratos] =
    await Promise.all([
      supabase.from("usuarios").select("*").order("nome"),
      supabase.from("acessos_modulo").select("*"),
      situacaoDePrimeiroAcesso(),
      permissoesDeContratos(),
    ]);

  if (erroUsuarios || erroAcessos) {
    console.error("[listarUsuariosComAcessos] falha:", erroUsuarios ?? erroAcessos);
    throw new Error("Não foi possível carregar os usuários.");
  }

  return (usuarios ?? []).map((u) => {
    const nuncaEntrou = !!primeiroAcesso && primeiroAcesso.ultimoAcesso.has(u.id) && !primeiroAcesso.ultimoAcesso.get(u.id);
    const token = nuncaEntrou ? primeiroAcesso?.convites.get(u.id) : undefined;
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      adminHub: u.admin_hub,
      ativo: u.ativo,
      modulos: (acessos ?? []).filter((a) => a.usuario_id === u.id).map((a) => a.modulo),
      nuncaEntrou,
      linkPrimeiroAcesso: token && primeiroAcesso ? linkDoConvite(primeiroAcesso.origem, token) : null,
      contratos: contratos?.get(u.id) ?? null,
      compras: contratos?.get(u.id) ? { perfil: contratos.get(u.id)!.perfil, ligadas: contratos.get(u.id)!.ligadas } : null,
    };
  });
}
