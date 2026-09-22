"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { Modulo } from "@/types/database";

export type ResultadoConfig = { sucesso: true } | { sucesso: false; erro: string };

function traduzirErro(mensagem: string | undefined): string {
  if (!mensagem) return "Não foi possível concluir a ação. Tente novamente.";
  const conhecida = mensagem.match(/(?:^|: )([A-ZÁÉÍÓÚÂÊÔÃÕÇJS][^\n]*)/);
  return conhecida?.[1] ?? "Não foi possível concluir a ação. Tente novamente.";
}

const esquemaAcesso = z.object({
  email: z.email("Informe um e-mail válido"),
  nome: z.string().trim().min(2, "Informe o nome"),
  adminHub: z.boolean(),
  modulos: z.array(z.enum(["compras", "numera", "requerimentos"])),
  ativo: z.boolean(),
});

export async function definirAcesso(
  dados: z.infer<typeof esquemaAcesso>
): Promise<ResultadoConfig> {
  const analise = esquemaAcesso.safeParse(dados);
  if (!analise.success) {
    return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("definir_acesso", {
    p_email: analise.data.email,
    p_nome: analise.data.nome,
    p_admin_hub: analise.data.adminHub,
    p_modulos: analise.data.modulos as Modulo[],
    p_ativo: analise.data.ativo,
  });

  if (error) {
    console.error("[definirAcesso] erro na RPC:", error);
    return { sucesso: false, erro: traduzirErro(error.message) };
  }

  revalidatePath("/configuracoes");
  return { sucesso: true };
}
