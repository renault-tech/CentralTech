import { criarClienteNumera } from "@/lib/supabase/numera-cliente";
import { criarClienteServidor } from "@/lib/supabase/server";

export type UsuarioNumera = {
  id: string;
  nome: string;
  email: string;
  jaTemAcesso: boolean;
};

/**
 * Usuários aprovados do Numera (projeto Supabase separado), cruzados com
 * quem já tem `hub.usuarios` por e-mail — para o importador em
 * Configurações pré-marcar só quem falta.
 */
export async function listarUsuariosNumera(): Promise<UsuarioNumera[]> {
  const [numera, hub] = await Promise.all([
    criarClienteNumera()
      .from("users")
      .select("id, name, email")
      .eq("approved", true)
      .not("email", "is", null)
      .neq("email", ""),
    (await criarClienteServidor()).from("usuarios").select("email"),
  ]);

  if (numera.error) {
    console.error("[listarUsuariosNumera] falha ao ler o Numera:", numera.error);
    throw new Error("Não foi possível carregar os usuários do Numera.");
  }
  if (hub.error) {
    console.error("[listarUsuariosNumera] falha ao ler o hub:", hub.error);
    throw new Error("Não foi possível carregar os usuários já importados.");
  }

  const emailsComAcesso = new Set((hub.data ?? []).map((u) => u.email.toLowerCase()));

  return ((numera.data ?? []) as { id: string; name: string; email: string }[])
    .map((u) => ({
      id: u.id,
      nome: u.name,
      email: u.email,
      jaTemAcesso: emailsComAcesso.has(u.email.toLowerCase()),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
