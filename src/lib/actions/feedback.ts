"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { AppFeedback, StatusFeedback, TipoFeedback } from "@/types/database";

export type ResultadoFeedback = { sucesso: true } | { sucesso: false; erro: string };

const APPS = ["compras", "requerimentos", "numera", "hub"] as const;

const esquemaEnvio = z.object({
  app: z.enum(APPS),
  tipo: z.enum(["suporte", "sugestao"]),
  mensagem: z.string().trim().min(5, "Escreva um pouco mais.").max(4000),
  pagina: z.string().trim().max(200).optional(),
  anexos: z.array(z.string().trim().min(1)).max(5).optional(),
});

export async function enviarFeedback(dados: {
  app: AppFeedback;
  tipo: TipoFeedback;
  mensagem: string;
  pagina?: string;
  anexos?: string[];
}): Promise<ResultadoFeedback> {
  const a = esquemaEnvio.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("enviar_feedback", {
    p_app: a.data.app,
    p_tipo: a.data.tipo,
    p_mensagem: a.data.mensagem,
    p_pagina: a.data.pagina ?? null,
    p_anexos: a.data.anexos ?? [],
  });
  if (error) {
    console.error("[enviarFeedback]", error);
    return { sucesso: false, erro: "Não foi possível enviar. Tente novamente." };
  }
  revalidatePath("/feedback");
  return { sucesso: true };
}

const esquemaStatus = z.object({
  id: z.uuid(),
  status: z.enum(["novo", "lido", "resolvido", "nao_possivel"]),
});

/** Muda o status — a RLS só deixa admin do Hub e admin/diretor do Compras. */
export async function atualizarStatusFeedback(dados: {
  id: string;
  status: StatusFeedback;
}): Promise<ResultadoFeedback> {
  const a = esquemaStatus.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: "Dados inválidos." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("feedback")
    .update({ status: a.data.status, atualizado_em: new Date().toISOString() })
    .eq("id", a.data.id)
    .select("id");
  if (error || !data || data.length === 0) {
    return { sucesso: false, erro: "Não foi possível atualizar." };
  }
  revalidatePath("/feedback");
  return { sucesso: true };
}
