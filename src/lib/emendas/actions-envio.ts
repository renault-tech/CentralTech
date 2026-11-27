"use server";

import { z } from "zod";

import { revalidarCaminho as revalidatePath } from "@/lib/emendas/invalidar";
import { obterContextoEmendas } from "@/lib/emendas/dados";
import { TIPOS_DRIVE, TIPOS_DRIVE_PUBLICOS, ROTULO_DRIVE, type TipoDrive } from "@/lib/emendas/documentos-drive";
import { ehGestor } from "@/lib/emendas/regras";
import { tokenDeAcesso } from "@/lib/documentos/config";
import { garantirSubpasta, iniciarEnvio, lerArquivo, mensagemDoErro } from "@/lib/documentos/google";
import { limparNome, nomeComData, nomeDocumento } from "@/lib/documentos/nomes";
import { permissoesDocumentos } from "@/lib/documentos/permissoes";
import { origemDaRequisicao } from "@/lib/origem";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";

import type { Resultado } from "@/lib/emendas/actions";

/**
 * Envio de documentos pela plataforma. O arquivo vai do navegador direto para o Google Drive (nunca passa pela Vercel):
 * aqui só se confere a permissão, se prepara a pasta e o nome padrão, e se registra o que foi enviado.
 *  - Tipos públicos (termo, plano, extrato…) vão para "Originais (privada)" e esperam a análise (tarja e compressão).
 *  - Tipos internos (nota fiscal, atesto, prestação de contas) vão para "Internos". Gestor e administrador ligam na hora;
 *    a secretaria espera a aprovação.
 */
const MAX_BYTES = 25 * 1024 * 1024;


const esquemaInicio = z.object({
  emendaId: z.uuid(),
  tipo: z.enum(TIPOS_DRIVE),
  mime: z.literal("application/pdf", { error: "Envie o documento em PDF." }),
  tamanho: z.number().int().positive().max(MAX_BYTES, "O arquivo passa de 25 MB. Comprima o PDF antes de enviar."),
});

async function podeEnviar(emendaId: string) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return { ok: false, erro: "Sem acesso ao módulo." } as const;
  const perms = await permissoesDocumentos(ctx.usuario.id, ctx.perfil);
  if (!perms.enviar) return { ok: false, erro: "Você não tem permissão para enviar documentos." } as const;
  const emendas = await criarClienteEmendas();
  const { data: pode } = await emendas.rpc("pode_editar_emenda", { p_emenda: emendaId });
  if (!pode) return { ok: false, erro: "Você só envia documentos das emendas da sua secretaria." } as const;
  return { ok: true, ctx, emendas, perms } as const;
}

export async function iniciarEnvioDocumento(dados: z.input<typeof esquemaInicio>): Promise<{ sucesso: true; urlEnvio: string; nome: string } | { sucesso: false; erro: string }> {
  const a = esquemaInicio.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const p = await podeEnviar(a.data.emendaId);
  if (!p.ok) return { sucesso: false, erro: p.erro };

  const { data: emenda } = await p.emendas.from("v_emendas").select("id,numero,ano,secretaria_nome").eq("id", a.data.emendaId).maybeSingle();
  if (!emenda) return { sucesso: false, erro: "Emenda não encontrada." };
  const { data: exec } = await p.emendas.from("execucao").select("numero_termo").eq("id", a.data.emendaId).maybeSingle();

  try {
    const { token, cfg } = await tokenDeAcesso();
    const publico = (TIPOS_DRIVE_PUBLICOS as readonly string[]).includes(a.data.tipo);
    const base = publico ? cfg.pasta_originais_id : cfg.pasta_internos_id;
    if (!base) return { sucesso: false, erro: "As pastas do Drive ainda não foram preparadas. Peça ao administrador." };
    const pastaAno = await garantirSubpasta(token, base, String(emenda.ano));
    const pastaSecretaria = await garantirSubpasta(token, pastaAno, limparNome(emenda.secretaria_nome));

    let nome = nomeDocumento({ tipo: a.data.tipo, numeroEmenda: emenda.numero, ano: emenda.ano, numeroTermo: exec?.numero_termo ?? null, sufixo: publico ? "original" : null });
    const { count } = await p.emendas.from("documentos_enviados").select("id", { count: "exact", head: true }).eq("emenda_id", emenda.id).eq("nome", nome);
    if ((count ?? 0) > 0) nome = nomeComData(nome, new Date());

    const urlEnvio = await iniciarEnvio(token, { nome, paiId: pastaSecretaria, mime: a.data.mime, tamanho: a.data.tamanho, origem: await origemDaRequisicao() });
    return { sucesso: true, urlEnvio, nome };
  } catch (e) {
    console.error("[iniciarEnvioDocumento]", e);
    return { sucesso: false, erro: e instanceof Error && !("status" in e) ? e.message : mensagemDoErro(e) };
  }
}

const esquemaFim = z.object({
  emendaId: z.uuid(),
  tipo: z.enum(TIPOS_DRIVE),
  driveFileId: z.string().regex(/^[A-Za-z0-9_-]{20,80}$/),
  nome: z.string().trim().min(3).max(200),
});

export async function concluirEnvioDocumento(dados: z.input<typeof esquemaFim>): Promise<Resultado> {
  const a = esquemaFim.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: "Dados inválidos." };
  const p = await podeEnviar(a.data.emendaId);
  if (!p.ok) return { sucesso: false, erro: p.erro };

  let tamanho: number | null = null;
  try {
    const { token } = await tokenDeAcesso();
    const arquivo = await lerArquivo(token, a.data.driveFileId);
    if (arquivo.trashed || arquivo.mimeType !== "application/pdf") return { sucesso: false, erro: "O arquivo enviado não é um PDF válido." };
    if (arquivo.name !== a.data.nome) return { sucesso: false, erro: "O nome do arquivo no Drive não bate com o envio." };
    tamanho = arquivo.size ? Number(arquivo.size) : null;
  } catch (e) {
    console.error("[concluirEnvioDocumento]", e);
    return { sucesso: false, erro: mensagemDoErro(e) };
  }

  const publico = (TIPOS_DRIVE_PUBLICOS as readonly string[]).includes(a.data.tipo);
  const direto = !publico && ehGestor(p.ctx.perfil);
  const agora = new Date().toISOString();
  const { error } = await p.emendas.from("documentos_enviados").insert({
    emenda_id: a.data.emendaId,
    tipo: a.data.tipo as TipoDrive,
    nome: a.data.nome,
    drive_file_id: a.data.driveFileId,
    pasta: publico ? "originais" : "internos",
    tamanho,
    enviado_por: p.ctx.usuario.id,
    ...(direto ? { status: "aprovado" as const, decidido_por: p.ctx.usuario.id, decidido_em: agora } : {}),
  });
  if (error) {
    console.error("[concluirEnvioDocumento] insert", error);
    return { sucesso: false, erro: error.code === "23505" ? "Este arquivo já foi registrado." : "O arquivo foi para o Drive, mas não foi possível registrar o envio. Avise o administrador." };
  }
  if (direto) {
    const r = await ligarAoDrive(p.emendas, a.data.emendaId, a.data.tipo as TipoDrive, a.data.driveFileId, a.data.nome, p.ctx.usuario.id);
    if (!r.sucesso) return r;
  }
  revalidatePath(`/emendas/${a.data.emendaId}`, "page");
  revalidatePath("/emendas/aprovacoes", "page");
  return { sucesso: true, aviso: direto ? "Documento enviado e ligado à emenda." : publico ? "Documento enviado. Aguarda a análise do gestor." : "Documento enviado. Aguarda a aprovação do gestor." };
}

type ClienteEmendas = Awaited<ReturnType<typeof criarClienteEmendas>>;

/** Liga o arquivo à emenda (mesma tabela de sempre), como documento interno. */
async function ligarAoDrive(emendas: ClienteEmendas, emendaId: string, tipo: TipoDrive, driveFileId: string, titulo: string, usuarioId: string): Promise<Resultado> {
  const { error } = await emendas.from("documentos_drive").insert({
    emenda_id: emendaId,
    tipo,
    titulo: titulo || ROTULO_DRIVE[tipo],
    drive_file_id: driveFileId,
    publico: false,
    conferido_em: new Date().toISOString(),
    conferido_por: usuarioId,
  });
  if (error && error.code !== "23505") {
    console.error("[ligarAoDrive]", error);
    return { sucesso: false, erro: "O arquivo foi enviado, mas não foi possível ligá-lo à emenda." };
  }
  return { sucesso: true };
}

const esquemaDecisao = z.object({
  id: z.uuid(),
  decisao: z.enum(["aprovar", "devolver"]),
  motivo: z.string().trim().max(500).optional(),
});

/**
 * Decide um envio. Só quem analisa (gestor com a permissão). Aprovar vale por enquanto para os internos; os públicos
 * esperam a tela de análise (compressão e tarja). Devolver vale para os dois e exige o motivo.
 */
export async function decidirDocumentoEnviado(dados: z.input<typeof esquemaDecisao>): Promise<Resultado> {
  const a = esquemaDecisao.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: "Dados inválidos." };
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok" || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só o gestor decide sobre documentos enviados." };
  const perms = await permissoesDocumentos(ctx.usuario.id, ctx.perfil);
  if (!perms.analisar) return { sucesso: false, erro: "Você não tem permissão para analisar documentos." };

  const emendas = await criarClienteEmendas();
  const { data: env } = await emendas.from("documentos_enviados").select("*").eq("id", a.data.id).maybeSingle();
  if (!env) return { sucesso: false, erro: "Envio não encontrado." };
  if (env.status !== "aguardando") return { sucesso: false, erro: "Este envio já foi decidido." };

  if (a.data.decisao === "devolver" && (a.data.motivo?.length ?? 0) < 5) return { sucesso: false, erro: "Diga o motivo da devolução (pelo menos 5 letras)." };
  if (a.data.decisao === "aprovar" && env.pasta === "originais") return { sucesso: false, erro: "A análise com compressão e tarja dos documentos públicos chega na próxima etapa." };

  const { error } = await emendas
    .from("documentos_enviados")
    .update({ status: a.data.decisao === "aprovar" ? "aprovado" : "devolvido", decidido_por: ctx.usuario.id, decidido_em: new Date().toISOString(), motivo: a.data.decisao === "devolver" ? a.data.motivo : null })
    .eq("id", a.data.id)
    .eq("status", "aguardando");
  if (error) {
    console.error("[decidirDocumentoEnviado]", error);
    return { sucesso: false, erro: "Não foi possível registrar a decisão." };
  }
  if (a.data.decisao === "aprovar") {
    const r = await ligarAoDrive(emendas, env.emenda_id, env.tipo, env.drive_file_id, env.nome, ctx.usuario.id);
    if (!r.sucesso) return r;
  }
  revalidatePath(`/emendas/${env.emenda_id}`, "page");
  revalidatePath("/emendas/aprovacoes", "page");
  return { sucesso: true };
}
