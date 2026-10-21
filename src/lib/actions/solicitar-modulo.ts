"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Modulo } from "@/types/database";

const esquemaModulo = z.enum(["compras", "numera", "requerimentos", "emendas"]);

/**
 * Pedido de acesso com um clique, a partir do card inativo na tela inicial.
 * Quem já está logado não precisa preencher nada: nome e e-mail vêm da
 * própria sessão (nunca do navegador). Não duplica: se já há um pedido
 * pendente que inclui o módulo, só atualiza a tela.
 */
export async function solicitarAcessoAoModulo(modulo: string): Promise<void> {
  const analise = esquemaModulo.safeParse(modulo);
  if (!analise.success) return;

  const usuario = await obterUsuarioAtual();
  if (!usuario?.ativo) return;
  const chave: Modulo = analise.data;

  const supabase = await criarClienteServidor();

  // Quem já tem o módulo (ou é admin) não tem o que pedir.
  if (usuario.admin_hub) return;
  const { data: acessos } = await supabase.from("acessos_modulo").select("modulo").eq("usuario_id", usuario.id);
  if ((acessos ?? []).some((a) => a.modulo === chave)) return;

  // A leitura de `solicitacoes_acesso` é só do admin (RLS): a checagem de
  // duplicidade usa a service_role, restrita ao e-mail da própria sessão.
  const emailLike = usuario.email.replace(/[\\%_]/g, "\\$&");
  const { data: pendentes } = await criarClienteAdminBruto()
    .schema("hub")
    .from("solicitacoes_acesso")
    .select("modulos_solicitados")
    .eq("status", "pendente")
    .ilike("email", emailLike);
  const jaPedido = (pendentes ?? []).some((p) => (p.modulos_solicitados as string[]).includes(chave));

  if (!jaPedido) {
    const { error } = await supabase.from("solicitacoes_acesso").insert({
      nome: usuario.nome,
      email: usuario.email,
      modulos_solicitados: [chave],
      justificativa: "Pedido feito pela tela inicial da Central.",
    });
    if (error) console.error("[solicitarAcessoAoModulo] erro ao inserir:", error);
  }

  revalidatePath("/");
}
