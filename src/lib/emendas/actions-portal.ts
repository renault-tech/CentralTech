"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { z } from "zod";

import { obterContextoEmendas } from "@/lib/emendas/dados";
import { metaDoPortal, pacoteDoPortal } from "@/lib/emendas/portal";
import { TAG_PORTAL } from "@/lib/emendas/portal-tag";
import { contarPorGravidade, verificarPortal } from "@/lib/emendas/portal-verificacao";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";
import type { Resultado } from "@/lib/emendas/actions";

/**
 * Publicar/retirar o exercício do portal público. Só o administrador da Central (`usuario.admin_hub`). A verificação é
 * refeita AQUI, no servidor, no momento do clique: se houver alerta crítico, só publica com a
 * ciência expressa, e o que havia fica gravado em `portal_ciencia` (auditoria).
 */

const esquema = z.object({ ano: z.number().int().min(2020).max(2100), ciente: z.boolean().optional() });

/** Publicar/retirar do ar é decisão do administrador da Central (não do gestor do módulo). */
async function administrador() {
  const ctx = await obterContextoEmendas();
  return ctx.situacao === "ok" && ctx.usuario.admin_hub ? ctx : null;
}

export async function publicarPortal(dados: { ano: number; ciente?: boolean }): Promise<Resultado> {
  const a = esquema.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: "Dados inválidos" };
  const ctx = await administrador();
  if (!ctx) return { sucesso: false, erro: "Só o administrador da Central publica o portal." };
  updateTag(TAG_PORTAL); // verifica sobre os dados de agora, não sobre o cache
  const [meta, pacote] = await Promise.all([metaDoPortal(a.data.ano), pacoteDoPortal(a.data.ano)]);
  if (!meta) return { sucesso: false, erro: "Exercício não encontrado." };
  const alertas = verificarPortal(pacote.linhas, meta);
  const contagem = contarPorGravidade(alertas);
  if (contagem.critico > 0 && !a.data.ciente) return { sucesso: false, erro: `Há ${contagem.critico} alerta(s) crítico(s). Marque a ciência para publicar mesmo assim.` };

  const emendas = await criarClienteEmendas();
  const { data, error } = await emendas
    .from("exercicios")
    .update({
      portal_publicado_em: new Date().toISOString(),
      portal_publicado_por: ctx.usuario.id,
      portal_ciencia: { ...contagem, alertas: alertas.filter((x) => x.gravidade !== "info").map((x) => ({ id: x.id, gravidade: x.gravidade, emendas: x.emendas.length })), versao: pacote.versao },
    })
    .eq("ano", a.data.ano)
    .select("ano");
  if (error || !data?.length) return { sucesso: false, erro: "Não foi possível publicar (sem permissão ou exercício inexistente)." };
  revalidateTag(TAG_PORTAL, "max");
  revalidatePath("/emendas/portal");
  revalidatePath("/transparencia/emendas");
  return { sucesso: true };
}

export async function retirarPortal(dados: { ano: number }): Promise<Resultado> {
  const a = esquema.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: "Dados inválidos" };
  if (!(await administrador())) return { sucesso: false, erro: "Só o administrador da Central retira o portal do ar." };
  const emendas = await criarClienteEmendas();
  const { data, error } = await emendas.from("exercicios").update({ portal_publicado_em: null }).eq("ano", a.data.ano).select("ano");
  if (error || !data?.length) return { sucesso: false, erro: "Não foi possível retirar do ar." };
  revalidateTag(TAG_PORTAL, "max");
  revalidatePath("/emendas/portal");
  revalidatePath("/transparencia/emendas");
  return { sucesso: true };
}
