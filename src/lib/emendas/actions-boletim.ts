"use server";

import { z } from "zod";

import { enviarEmailBrevo } from "@/lib/email/brevo";
import { htmlDaConfirmacao } from "@/lib/emendas/portal-boletim";
import { origemDaRequisicao } from "@/lib/origem";
import { excedeuLimite, ipDoCliente } from "@/lib/seguranca/limite-requisicoes";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";

/**
 * Boletim por e-mail do portal público (sem login). Confirmação dupla (LGPD): nada é enviado
 * antes de a pessoa clicar no link do e-mail. Resposta sempre genérica — não revela se o
 * e-mail já estava cadastrado. Só a service_role lê/grava `emendas.portal_assinantes`.
 */

const MENSAGEM = "Pronto. Se o endereço estiver correto, você vai receber um e-mail para confirmar o cadastro. Confira também a caixa de spam.";

const esquema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Informe um e-mail válido.")),
  vereador: z.string().trim().max(200).optional().transform((v) => (v ? v : null)),
  consentimento: z.literal(true, { error: "Marque a caixa de consentimento para continuar." }),
});

export async function assinarBoletim(dados: { email: string; vereador?: string; consentimento: boolean }): Promise<{ ok: boolean; mensagem: string }> {
  const a = esquema.safeParse(dados);
  if (!a.success) return { ok: false, mensagem: a.error.issues[0]?.message ?? "Dados inválidos." };
  if (await excedeuLimite("portal-boletim", await ipDoCliente(), 5, 600)) return { ok: false, mensagem: "Muitas tentativas. Tente de novo em alguns minutos." };

  const db = criarClienteAdminBruto().schema("emendas");
  const { data: existente } = await db.from("portal_assinantes").select("id,confirmado_em,cancelado_em").eq("email", a.data.email).maybeSingle();
  // Já confirmado e ativo: não muda nada (ninguém troca o filtro de outra pessoa) e responde igual.
  if (existente?.confirmado_em && !existente.cancelado_em) return { ok: true, mensagem: MENSAGEM };

  const token = crypto.randomUUID();
  const gravacao = existente
    ? await db.from("portal_assinantes").update({ token, vereador: a.data.vereador, confirmado_em: null, cancelado_em: null }).eq("id", existente.id as string)
    : await db.from("portal_assinantes").insert({ email: a.data.email, token, vereador: a.data.vereador });
  if (gravacao.error) {
    console.error("[assinarBoletim]", gravacao.error.message);
    return { ok: true, mensagem: MENSAGEM };
  }
  const origem = await origemDaRequisicao();
  const { assunto, html } = htmlDaConfirmacao({ urlConfirmar: `${origem}/transparencia/emendas/boletim?acao=confirmar&t=${token}`, vereador: a.data.vereador });
  await enviarEmailBrevo({ destinatarioEmail: a.data.email, assunto, html, remetenteNome: "Transparência · Cataguases" });
  return { ok: true, mensagem: MENSAGEM };
}

const token = z.uuid();

export async function confirmarBoletim(t: string): Promise<{ ok: boolean; mensagem: string }> {
  if (!token.safeParse(t).success) return { ok: false, mensagem: "Link inválido." };
  if (await excedeuLimite("portal-boletim-link", await ipDoCliente(), 20, 600)) return { ok: false, mensagem: "Muitas tentativas. Tente de novo em alguns minutos." };
  const db = criarClienteAdminBruto().schema("emendas");
  const { data } = await db.from("portal_assinantes").update({ confirmado_em: new Date().toISOString(), cancelado_em: null }).eq("token", t).select("id");
  return data?.length ? { ok: true, mensagem: "Cadastro confirmado. Você vai receber as atualizações das emendas impositivas." } : { ok: false, mensagem: "Link inválido ou já substituído por um mais recente." };
}

export async function cancelarBoletim(t: string): Promise<{ ok: boolean; mensagem: string }> {
  if (!token.safeParse(t).success) return { ok: false, mensagem: "Link inválido." };
  if (await excedeuLimite("portal-boletim-link", await ipDoCliente(), 20, 600)) return { ok: false, mensagem: "Muitas tentativas. Tente de novo em alguns minutos." };
  const db = criarClienteAdminBruto().schema("emendas");
  const { data } = await db.from("portal_assinantes").update({ cancelado_em: new Date().toISOString() }).eq("token", t).select("id");
  return data?.length ? { ok: true, mensagem: "Pronto. Você não vai mais receber o boletim." } : { ok: false, mensagem: "Link inválido." };
}
