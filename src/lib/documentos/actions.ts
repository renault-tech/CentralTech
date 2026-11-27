"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirAdminHub } from "@/lib/auth/exigir-admin";
import { envGoogle } from "@/lib/env";
import { gravarConfig, lerConfig, tokenDeAcesso } from "@/lib/documentos/config";
import { criarPasta, garantirSubpasta, lerArquivo, mensagemDoErro, MIME_PASTA } from "@/lib/documentos/google";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";

type Resultado = { sucesso: true; mensagem?: string } | { sucesso: false; erro: string };

/** Nomes das três pastas. Ficam aqui, num lugar só, para virarem configuráveis por instituição. */
const PASTAS = { originais: "Originais (privada)", publicada: "Publicada", internos: "Internos" } as const;

const esquemaPastas = z.object({
  /** Id da pasta escolhida no seletor do Google; vazio = criar uma pasta nova na raiz do Drive conectado. */
  pastaId: z.string().regex(/^[A-Za-z0-9_-]{10,80}$/).nullable(),
  nomeNovaPasta: z.string().trim().min(2).max(80).default("Documentos da plataforma"),
});

/**
 * Prepara as três pastas (Originais, Publicada, Internos) dentro da pasta escolhida — ou de uma pasta nova.
 * Repetir a ação não duplica nada: pastas que já existem são reaproveitadas.
 */
export async function prepararPastas(dados: z.input<typeof esquemaPastas>): Promise<Resultado> {
  await exigirAdminHub();
  const a = esquemaPastas.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: "Pasta inválida." };
  try {
    const { token } = await tokenDeAcesso();
    let raizId: string;
    let raizNome: string;
    if (a.data.pastaId) {
      const pasta = await lerArquivo(token, a.data.pastaId);
      if (pasta.mimeType !== MIME_PASTA || pasta.trashed) return { sucesso: false, erro: "O item escolhido não é uma pasta." };
      raizId = pasta.id;
      raizNome = pasta.name;
    } else {
      const nova = await criarPasta(token, a.data.nomeNovaPasta, null);
      raizId = nova.id;
      raizNome = nova.name;
    }
    const [originais, publicada, internos] = await Promise.all([
      garantirSubpasta(token, raizId, PASTAS.originais),
      garantirSubpasta(token, raizId, PASTAS.publicada),
      garantirSubpasta(token, raizId, PASTAS.internos),
    ]);
    await gravarConfig({ pasta_raiz_id: raizId, pasta_raiz_nome: raizNome, pasta_originais_id: originais, pasta_publicada_id: publicada, pasta_internos_id: internos, ultimo_erro: null });
  } catch (e) {
    console.error("[documentos:prepararPastas]", e);
    return { sucesso: false, erro: mensagemDoErro(e) };
  }
  revalidatePath("/configuracoes/documentos");
  return { sucesso: true, mensagem: "Pastas prontas no Drive." };
}

/** Teste de ponta a ponta: renova a autorização e confere que as três pastas ainda existem. */
export async function testarConexao(): Promise<Resultado> {
  await exigirAdminHub();
  try {
    const { token, cfg } = await tokenDeAcesso();
    const ids = [cfg.pasta_originais_id, cfg.pasta_publicada_id, cfg.pasta_internos_id];
    if (ids.some((i) => !i)) return { sucesso: false, erro: "As pastas ainda não foram preparadas." };
    for (const id of ids) {
      const p = await lerArquivo(token, id as string);
      if (p.trashed) return { sucesso: false, erro: `A pasta "${p.name}" está na lixeira do Drive.` };
    }
  } catch (e) {
    console.error("[documentos:testarConexao]", e);
    return { sucesso: false, erro: mensagemDoErro(e) };
  }
  revalidatePath("/configuracoes/documentos");
  return { sucesso: true, mensagem: "Tudo certo: o Drive respondeu e as três pastas existem." };
}

/** Desconecta: apaga a autorização guardada. Os arquivos continuam no Drive; só o vínculo com a plataforma sai. */
export async function desconectarDrive(): Promise<Resultado> {
  await exigirAdminHub();
  const cfg = await lerConfig();
  if (!cfg) return { sucesso: true };
  await gravarConfig({ token_cifrado: null, conta_email: null, pasta_raiz_id: null, pasta_raiz_nome: null, pasta_originais_id: null, pasta_publicada_id: null, pasta_internos_id: null, conectado_em: null, ultimo_erro: null });
  revalidatePath("/configuracoes/documentos");
  return { sucesso: true, mensagem: "Drive desconectado." };
}

/** Dados para abrir o seletor de pastas do Google (só administrador; o token vale ~1 hora e só enxerga o que o app criou/recebeu). */
export async function dadosDoSeletor(): Promise<{ sucesso: true; token: string; chave: string; projeto: string } | { sucesso: false; erro: string }> {
  await exigirAdminHub();
  const g = envGoogle();
  if (!g?.GOOGLE_PICKER_API_KEY || !g.GOOGLE_PROJECT_NUMBER) return { sucesso: false, erro: "O seletor do Google não está configurado neste ambiente." };
  try {
    const { token } = await tokenDeAcesso();
    return { sucesso: true, token, chave: g.GOOGLE_PICKER_API_KEY, projeto: g.GOOGLE_PROJECT_NUMBER };
  } catch (e) {
    return { sucesso: false, erro: mensagemDoErro(e) };
  }
}

const esquemaPermissao = z.object({
  usuarioId: z.uuid(),
  campo: z.enum(["pode_enviar", "pode_analisar"]),
  /** `null` volta ao padrão do perfil. */
  valor: z.boolean().nullable(),
});

export async function definirPermissaoDocumentos(dados: z.input<typeof esquemaPermissao>): Promise<Resultado> {
  const admin = await exigirAdminHub();
  const a = esquemaPermissao.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: "Dados inválidos." };
  const hub = criarClienteAdminBruto().schema("hub");
  const { error } = await hub.from("permissoes_documentos").upsert({ usuario_id: a.data.usuarioId, [a.data.campo]: a.data.valor, atualizado_em: new Date().toISOString(), atualizado_por: admin.id });
  if (error) {
    console.error("[documentos:definirPermissao]", error);
    return { sucesso: false, erro: "Não foi possível gravar a permissão." };
  }
  revalidatePath("/configuracoes/documentos");
  return { sucesso: true };
}
