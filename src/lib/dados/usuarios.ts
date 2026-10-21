import { origemDaRequisicao } from "@/lib/actions/auth";
import { linkDoConvite } from "@/lib/auth/convite";
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
};

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
  const supabase = await criarClienteServidor();
  const [{ data: usuarios, error: erroUsuarios }, { data: acessos, error: erroAcessos }, primeiroAcesso] =
    await Promise.all([
      supabase.from("usuarios").select("*").order("nome"),
      supabase.from("acessos_modulo").select("*"),
      situacaoDePrimeiroAcesso(),
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
    };
  });
}
