import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteNumera } from "@/lib/supabase/numera-cliente";
import type { ConfigModulo, Modulo } from "@/types/database";

export type AdocaoModulo = {
  modulo: Modulo;
  ativos: number;
  jaViaHub: number;
  bloqueado: boolean;
};

async function contarAdocaoNumera(): Promise<{ ativos: number; jaViaHub: number }> {
  try {
    const { data, error } = await criarClienteNumera()
      .from("users")
      .select("id, ultimo_acesso_origem")
      .eq("approved", true);
    if (error || !data) return { ativos: 0, jaViaHub: 0 };
    return {
      ativos: data.length,
      jaViaHub: data.filter((u) => u.ultimo_acesso_origem === "hub").length,
    };
  } catch (e) {
    console.error("[contarAdocaoNumera] falha:", e);
    return { ativos: 0, jaViaHub: 0 };
  }
}

async function contarComOrigemHub(
  admin: ReturnType<typeof criarClienteAdminBruto>,
  schema: "public" | "requerimentos"
): Promise<{ ativos: number; jaViaHub: number }> {
  const [{ count: ativos }, { count: jaViaHub }] = await Promise.all([
    admin.schema(schema).from("usuarios").select("id", { count: "exact", head: true }).eq("ativo", true),
    admin
      .schema(schema)
      .from("usuarios")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
      .eq("ultimo_acesso_origem", "hub"),
  ]);
  return { ativos: ativos ?? 0, jaViaHub: jaViaHub ?? 0 };
}

/**
 * Sinal de adoção do Hub por app + estado atual do bloqueio de login
 * direto. Numera entra só como leitura informativa — projeto Supabase
 * separado, sem SSO real: bloquear o login de lá não tem substituto (o
 * card do Hub só linka de volta para a mesma tela de login), então o
 * switch de bloqueio não é oferecido para ele na UI (ver `PainelLoginDireto`).
 */
export async function listarAdocaoHub(): Promise<AdocaoModulo[]> {
  const hub = await criarClienteServidor();
  const admin = criarClienteAdminBruto();

  const [{ data: config }, compras, requerimentos, numera] = await Promise.all([
    hub.from("config_modulo").select("*"),
    contarComOrigemHub(admin, "public"),
    contarComOrigemHub(admin, "requerimentos"),
    contarAdocaoNumera(),
  ]);

  const configPorModulo = new Map((config ?? []).map((c: ConfigModulo) => [c.modulo, c.login_direto_bloqueado]));

  return [
    { modulo: "compras", ...compras, bloqueado: configPorModulo.get("compras") ?? false },
    { modulo: "requerimentos", ...requerimentos, bloqueado: configPorModulo.get("requerimentos") ?? false },
    { modulo: "numera", ...numera, bloqueado: configPorModulo.get("numera") ?? false },
  ];
}
