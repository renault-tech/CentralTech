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
 * quem já tem especificamente o módulo `numera` em `hub.acessos_modulo` —
 * para o importador em Configurações pré-marcar só quem falta.
 *
 * Importante: `jaTemAcesso` precisa checar o módulo `numera`
 * especificamente, não só "o e-mail já existe em hub.usuarios" — alguém
 * que já tem conta pelo Compras também existe em `hub.usuarios`, mas
 * ainda não tem o módulo Numera. Checar só a existência da conta
 * escondia essas pessoas da lista de pendentes e elas nunca ganhavam o
 * módulo extra (bug real, encontrado em uso).
 */
export async function listarUsuariosNumera(): Promise<UsuarioNumera[]> {
  const supabase = await criarClienteServidor();

  const [numera, usuarios, acessos] = await Promise.all([
    criarClienteNumera()
      .from("users")
      .select("id, name, email")
      .eq("approved", true)
      .not("email", "is", null)
      .neq("email", ""),
    supabase.from("usuarios").select("id, email"),
    supabase.from("acessos_modulo").select("usuario_id").eq("modulo", "numera"),
  ]);

  if (numera.error) {
    console.error("[listarUsuariosNumera] falha ao ler o Numera:", numera.error);
    throw new Error("Não foi possível carregar os usuários do Numera.");
  }
  if (usuarios.error || acessos.error) {
    console.error("[listarUsuariosNumera] falha ao ler o hub:", usuarios.error ?? acessos.error);
    throw new Error("Não foi possível carregar os usuários já importados.");
  }

  const idsComNumera = new Set((acessos.data ?? []).map((a) => a.usuario_id));
  const emailsComNumera = new Set(
    (usuarios.data ?? []).filter((u) => idsComNumera.has(u.id)).map((u) => u.email.toLowerCase())
  );

  return ((numera.data ?? []) as { id: string; name: string; email: string }[])
    .map((u) => ({
      id: u.id,
      nome: u.name,
      email: u.email,
      jaTemAcesso: emailsComNumera.has(u.email.toLowerCase()),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
