import { obterContextoEmendas } from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";
import { podeDecidirComoMaster } from "@/lib/emendas/master-regra";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";

export async function listarMasters(): Promise<string[]> {
  const emendas = await criarClienteEmendas();
  const { data } = await emendas.from("masters").select("usuario_id");
  return (data ?? []).map((m) => m.usuario_id);
}

/** Verifica na sessão atual se pode decidir; devolve o contexto ou a mensagem de recusa. */
export async function exigirDecisor(acao: string) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok" || !ehGestor(ctx.perfil)) return { erro: `Só gestores ${acao}.` } as const;
  const masters = await listarMasters();
  const pode = podeDecidirComoMaster({ adminHub: ctx.usuario.admin_hub, ehMaster: masters.includes(ctx.usuario.id), haMasters: masters.length > 0, gestor: true });
  if (!pode) return { erro: `Só o gestor master ou o administrador da Central ${acao}.` } as const;
  return { ctx } as const;
}
