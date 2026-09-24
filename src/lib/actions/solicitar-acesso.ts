"use server";

import { z } from "zod";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { Modulo } from "@/types/database";

export type EstadoSolicitacao = {
  erro?: string;
  enviado?: boolean;
};

const esquema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  email: z.email("Informe um e-mail válido"),
  modulos: z.array(z.enum(["compras", "numera", "requerimentos"])).min(1, "Selecione ao menos um módulo"),
  secretaria: z.string().trim().max(120).optional(),
  justificativa: z.string().trim().max(2000).optional(),
});

/**
 * Insere o pedido em `hub.solicitacoes_acesso` — a policy de RLS
 * (`qualquer_um_solicita_acesso`) já libera `insert` para `anon` E
 * `authenticated` com `status = 'pendente'` (default da coluna), então
 * funciona igual para quem nunca teve conta e para quem já está logado e só
 * quer pedir mais um módulo.
 */
export async function solicitarAcesso(
  _estadoAnterior: EstadoSolicitacao,
  formData: FormData
): Promise<EstadoSolicitacao> {
  const analise = esquema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    modulos: formData.getAll("modulos"),
    secretaria: formData.get("secretaria") || undefined,
    justificativa: formData.get("justificativa") || undefined,
  });

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("solicitacoes_acesso").insert({
    nome: analise.data.nome,
    email: analise.data.email,
    modulos_solicitados: analise.data.modulos as Modulo[],
    secretaria_sugerida: analise.data.secretaria ?? null,
    justificativa: analise.data.justificativa ?? null,
  });

  if (error) {
    console.error("[solicitarAcesso] erro ao inserir:", error);
    return { erro: "Não foi possível enviar o pedido. Tente novamente em instantes." };
  }

  return { enviado: true };
}
