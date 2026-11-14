"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { TAG_PORTAL } from "@/lib/emendas/portal-tag";
import { obterContextoEmendas } from "@/lib/emendas/dados";
import { TIPOS_DRIVE, TIPOS_DRIVE_PUBLICOS, ROTULO_DRIVE, extrairIdDrive } from "@/lib/emendas/documentos-drive";
import { ehGestor } from "@/lib/emendas/regras";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";

import type { Resultado } from "@/lib/emendas/actions";

/**
 * Cadastro de documentos que ficam no Google Drive: grava só o ID do arquivo (nunca o arquivo). Só gestor/admin:
 * a RLS de `documentos_drive` também exige `eh_gestor()`. A ficha não é digitada — é montada dos dados da emenda.
 */

const esquema = z.object({
  emendaId: z.uuid(),
  tipo: z.enum(TIPOS_DRIVE),
  link: z.string().trim().min(1, "Cole o link do arquivo no Drive").max(500),
  titulo: z.string().trim().max(200).optional(),
});

async function exigirGestor() {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok" || !ehGestor(ctx.perfil)) return null;
  return ctx;
}

function atualizar(emendaId: string) {
  revalidateTag(TAG_PORTAL, "max");
  revalidatePath(`/emendas/${emendaId}`, "page");
}

export async function vincularDocumentoDrive(dados: z.input<typeof esquema>): Promise<Resultado> {
  const a = esquema.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await exigirGestor();
  if (!ctx) return { sucesso: false, erro: "Só o gestor do módulo cadastra documentos." };

  const id = extrairIdDrive(a.data.link);
  if (!id) return { sucesso: false, erro: "Link inválido. Cole o link de um ARQUIVO do Drive (não de uma pasta)." };

  const emendas = await criarClienteEmendas();
  const { error } = await emendas.from("documentos_drive").insert({
    emenda_id: a.data.emendaId,
    tipo: a.data.tipo,
    titulo: a.data.titulo || ROTULO_DRIVE[a.data.tipo],
    drive_file_id: id,
    // Só tipos liberados por lei vão ao portal; o resto fica interno.
    publico: TIPOS_DRIVE_PUBLICOS.includes(a.data.tipo),
    conferido_em: new Date().toISOString(),
    conferido_por: ctx.usuario.id,
  });
  if (error) {
    console.error("[vincularDocumentoDrive]", error);
    if (error.code === "23505") return { sucesso: false, erro: "Este arquivo já está ligado a esta emenda com este tipo." };
    if (error.code === "42501") return { sucesso: false, erro: "Sem permissão para cadastrar documentos." };
    return { sucesso: false, erro: "Não foi possível cadastrar o documento. Tente novamente." };
  }
  atualizar(a.data.emendaId);
  return { sucesso: true };
}

export async function removerDocumentoDrive(id: string, emendaId: string): Promise<Resultado> {
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(emendaId).success) return { sucesso: false, erro: "Documento inválido" };
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só o gestor do módulo remove documentos." };
  const emendas = await criarClienteEmendas();
  // Remove só o vínculo; o arquivo continua no Drive.
  const { error } = await emendas.from("documentos_drive").delete().eq("id", id).eq("emenda_id", emendaId);
  if (error) {
    console.error("[removerDocumentoDrive]", error);
    return { sucesso: false, erro: "Não foi possível remover o vínculo." };
  }
  atualizar(emendaId);
  return { sucesso: true };
}
