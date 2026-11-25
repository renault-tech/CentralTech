"use server";

import { revalidateTag } from "next/cache";
import { revalidarCaminho as revalidatePath } from "@/lib/emendas/invalidar";
import { z } from "zod";

import { TAG_PORTAL } from "@/lib/emendas/portal-tag";
import { obterContextoEmendas } from "@/lib/emendas/dados";
import { TIPOS_DRIVE, TIPOS_DRIVE_PUBLICOS, ROTULO_DRIVE, extrairIdDrive } from "@/lib/emendas/documentos-drive";
import { lerParceria } from "@/lib/emendas/leitor-parceria";
import { dataBr, ehGestor } from "@/lib/emendas/regras";
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

/**
 * Ligar, trocar ou remover documento do Drive é só do administrador da Central (decisão do dono, 25/11/2026): os arquivos
 * públicos (termo, plano) precisam estar tarjados e na pasta PUBLICIDADE, e alguns gestores ligaram os originais sem tarja,
 * direto da pasta "Documentos novos". O gestor do módulo segue editando todo o resto da emenda.
 */
const MSG_SO_ADMIN_LIGA = "Só o administrador da Central liga ou remove documentos do Drive: o arquivo precisa estar tarjado e na pasta PUBLICIDADE.";
async function exigirAdminDocumentos() {
  const ctx = await exigirGestor();
  if (!ctx || !ctx.usuario.admin_hub) return null;
  return ctx;
}

function atualizar(emendaId: string) {
  revalidateTag(TAG_PORTAL, "max");
  revalidatePath(`/emendas/${emendaId}`, "page");
}

export async function vincularDocumentoDrive(dados: z.input<typeof esquema>): Promise<Resultado> {
  const a = esquema.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  // Só os tipos que vão ao portal (termo, plano, extrato…) exigem o administrador; comprovação de cumprimento é interna.
  const ehPublico = TIPOS_DRIVE_PUBLICOS.includes(a.data.tipo);
  const ctx = ehPublico ? await exigirAdminDocumentos() : await exigirGestor();
  if (!ctx) return { sucesso: false, erro: ehPublico ? MSG_SO_ADMIN_LIGA : "Só o gestor do módulo cadastra documentos." };

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
  const { data: doc } = await emendas.from("documentos_drive").select("tipo").eq("id", id).eq("emenda_id", emendaId).maybeSingle();
  if (doc && (TIPOS_DRIVE_PUBLICOS as readonly string[]).includes(doc.tipo) && !(await exigirAdminDocumentos())) return { sucesso: false, erro: MSG_SO_ADMIN_LIGA };
  // Remove só o vínculo; o arquivo continua no Drive.
  const { error } = await emendas.from("documentos_drive").delete().eq("id", id).eq("emenda_id", emendaId);
  if (error) {
    console.error("[removerDocumentoDrive]", error);
    return { sucesso: false, erro: "Não foi possível remover o vínculo." };
  }
  atualizar(emendaId);
  return { sucesso: true };
}

const MAX_BYTES_PDF = 5 * 1024 * 1024;

/**
 * Ao ligar um termo/extrato/convênio, a pessoa pode escolher o mesmo PDF para o sistema LER o texto e preencher o que está
 * vazio (nº do termo; data de publicação, no extrato). Só preenche campo vazio, só quando o valor é inequívoco, e o PDF nunca é
 * guardado. PDF digitalizado (imagem) não tem texto: nesse caso nada é preenchido e o cadastro segue manual.
 */
export async function preencherPeloPdf(form: FormData): Promise<Resultado & { preenchidos?: string[]; motivo?: string }> {
  const emendaId = z.uuid().safeParse(form.get("emendaId"));
  const tipo = z.enum(["termo", "extrato", "convenio"]).safeParse(form.get("tipo"));
  const arquivo = form.get("arquivo");
  if (!emendaId.success || !tipo.success) return { sucesso: true, preenchidos: [] };
  const driveId = extrairIdDrive(String(form.get("link") ?? ""));
  if (!(arquivo instanceof File) || arquivo.size === 0) return { sucesso: true, preenchidos: [] };
  const ctx = await exigirAdminDocumentos();
  if (!ctx) return { sucesso: false, erro: MSG_SO_ADMIN_LIGA };
  if (arquivo.size > MAX_BYTES_PDF) return { sucesso: true, preenchidos: [], motivo: "PDF com mais de 5 MB: não foi lido." };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return { sucesso: true, preenchidos: [], motivo: "O arquivo não é um PDF: não foi lido." };

  const emendas = await criarClienteEmendas();
  // Guarda (ou limpa) o aviso na linha do documento, para aparecer ao lado dele na aba Documentação.
  const anotar = async (aviso: string | null) => {
    if (!driveId) return;
    await emendas.from("documentos_drive").update({ leitura_aviso: aviso }).eq("emenda_id", emendaId.data).eq("tipo", tipo.data).eq("drive_file_id", driveId);
    atualizar(emendaId.data);
  };

  let texto = "";
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
    texto = Array.isArray(text) ? text.join("\n") : text;
  } catch {
    await anotar("Não consegui abrir o PDF para ler: confira o arquivo e preencha os dados à mão.");
    return { sucesso: true, preenchidos: [], motivo: "Não consegui abrir o PDF para ler." };
  }
  if (texto.replace(/\s/g, "").length < 20) {
    await anotar("PDF é uma imagem (sem texto): o sistema não conseguiu ler. Confira e preencha o nº e a data à mão.");
    return { sucesso: true, preenchidos: [], motivo: "O PDF é uma imagem (sem texto): preencha a data à mão." };
  }

  const lido = lerParceria(texto);
  const { data: atual } = await emendas.from("execucao").select("numero_termo, data_publicacao_extrato").eq("id", emendaId.data).maybeSingle();
  const campos: Record<string, string> = {};
  const preenchidos: string[] = [];
  if (!atual?.numero_termo && lido.numeroTermo) {
    campos.numero_termo = lido.numeroTermo;
    preenchidos.push(`nº do termo ${lido.numeroTermo}`);
  }
  if (tipo.data !== "termo" && !atual?.data_publicacao_extrato && lido.dataPublicacao) {
    campos.data_publicacao_extrato = lido.dataPublicacao;
    preenchidos.push(`data de publicação ${dataBr(lido.dataPublicacao)}`);
  }
  // Divergências entre o PDF e o que já está cadastrado: nunca sobrescreve, só sinaliza no documento.
  const divergencias: string[] = [];
  if (atual?.numero_termo && lido.numeroTermo && atual.numero_termo.trim() !== lido.numeroTermo) divergencias.push(`o PDF traz o termo ${lido.numeroTermo}, mas o cadastro diz ${atual.numero_termo}`);
  if (tipo.data !== "termo" && atual?.data_publicacao_extrato && lido.dataPublicacao && atual.data_publicacao_extrato !== lido.dataPublicacao)
    divergencias.push(`o PDF indica publicação em ${dataBr(lido.dataPublicacao)}, mas o cadastro diz ${dataBr(atual.data_publicacao_extrato)}`);
  const resumoAviso = divergencias.length ? `Confira: ${divergencias.join("; ")}.` : null;
  if (preenchidos.length === 0) {
    await anotar(resumoAviso ?? "Li o PDF, mas não achei o nº do termo nem a data com segurança: confira e preencha à mão.");
    return { sucesso: true, preenchidos, motivo: resumoAviso ?? "Li o PDF, mas não achei com segurança nada para preencher." };
  }

  const { error } = await emendas.from("execucao").upsert({ id: emendaId.data, ...campos, atualizado_em: new Date().toISOString(), atualizado_por: ctx.usuario.id });
  if (error) {
    console.error("[preencherPeloPdf]", error);
    return { sucesso: false, erro: "Não foi possível gravar o que li do PDF." };
  }
  await anotar(resumoAviso);
  atualizar(emendaId.data);
  return { sucesso: true, preenchidos };
}
