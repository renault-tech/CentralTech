import { criarClienteServidor } from "@/lib/supabase/server";
import type { Modulo } from "@/types/database";

export type UsuarioComAcessos = {
  id: string;
  nome: string;
  email: string;
  adminHub: boolean;
  ativo: boolean;
  modulos: Modulo[];
};

export async function listarUsuariosComAcessos(): Promise<UsuarioComAcessos[]> {
  const supabase = await criarClienteServidor();
  const [{ data: usuarios, error: erroUsuarios }, { data: acessos, error: erroAcessos }] =
    await Promise.all([
      supabase.from("usuarios").select("*").order("nome"),
      supabase.from("acessos_modulo").select("*"),
    ]);

  if (erroUsuarios || erroAcessos) {
    console.error("[listarUsuariosComAcessos] falha:", erroUsuarios ?? erroAcessos);
    throw new Error("Não foi possível carregar os usuários.");
  }

  return (usuarios ?? []).map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    adminHub: u.admin_hub,
    ativo: u.ativo,
    modulos: (acessos ?? []).filter((a) => a.usuario_id === u.id).map((a) => a.modulo),
  }));
}
