import { NextResponse, type NextRequest } from "next/server";

import { enviarEmailBrevo } from "@/lib/email/brevo";
import { anosDoPortal, dadosDoPortal, nomesDasEtapas } from "@/lib/emendas/portal";
import { diferencas, estadoDe, htmlDoBoletim, type EstadoBoletim } from "@/lib/emendas/portal-boletim";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Teto de e-mails por execução (o plano gratuito da Brevo envia 300 por dia). */
const LIMITE_ENVIOS = 280;

/**
 * Boletim diário do portal (Vercel Cron, ver `vercel.json`). Compara a fotografia do último envio
 * (`emendas.portal_boletim_estado`) com o que está publicado agora e manda só o que mudou a quem
 * confirmou o cadastro. Protegido por `CRON_SECRET` (a Vercel envia `Authorization: Bearer …`).
 * Na primeira execução de um exercício só tira a fotografia, sem enviar nada.
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });

  const db = criarClienteAdminBruto().schema("emendas");
  const origem = process.env.PORTAL_URL_BASE?.replace(/\/$/, "") || request.nextUrl.origin;
  const [anos, etapas] = await Promise.all([anosDoPortal(), nomesDasEtapas()]);
  const { data: assinantes } = await db.from("portal_assinantes").select("id,email,token,vereador").not("confirmado_em", "is", null).is("cancelado_em", null);
  const relatorio: Record<number, { mudancas: number; enviados: number; fotografia?: boolean }> = {};
  let enviados = 0;

  for (const ano of anos) {
    const linhas = await dadosDoPortal(ano);
    const { data: estado } = await db.from("portal_boletim_estado").select("*").eq("ano", ano);
    const anterior = (estado ?? []).map((e) => ({ ...e, valor: Number(e.valor), empenhado: Number(e.empenhado), pago: Number(e.pago) })) as EstadoBoletim[];
    const fotografia = () => db.from("portal_boletim_estado").upsert(linhas.map((l) => ({ ...estadoDe(l), atualizado_em: new Date().toISOString() })));

    if (anterior.length === 0) {
      await fotografia();
      relatorio[ano] = { mudancas: 0, enviados: 0, fotografia: true };
      continue;
    }
    const mudancas = diferencas(anterior, linhas, (c) => etapas[c] ?? c);
    let enviadosAno = 0;
    if (mudancas.length > 0) {
      for (const a of assinantes ?? []) {
        if (enviados >= LIMITE_ENVIOS) break;
        const deles = a.vereador ? mudancas.filter((m) => m.vereador === a.vereador) : mudancas;
        if (deles.length === 0) continue;
        const { assunto, html } = htmlDoBoletim({
          ano,
          mudancas: deles,
          vereador: a.vereador as string | null,
          urlPortal: `${origem}/transparencia/emendas?ano=${ano}${a.vereador ? `&vereador=${encodeURIComponent(a.vereador as string)}` : ""}`,
          urlCancelar: `${origem}/transparencia/emendas/boletim?acao=cancelar&t=${a.token}`,
        });
        const r = await enviarEmailBrevo({ destinatarioEmail: a.email as string, assunto, html, remetenteNome: "Transparência · Cataguases" });
        if (r.ok) {
          enviados += 1;
          enviadosAno += 1;
          await db.from("portal_assinantes").update({ ultimo_envio_em: new Date().toISOString() }).eq("id", a.id as string);
        }
      }
    }
    // Só avança a fotografia se todos receberam (senão a próxima execução reenvia o mesmo período).
    if (enviados < LIMITE_ENVIOS) await fotografia();
    relatorio[ano] = { mudancas: mudancas.length, enviados: enviadosAno };
  }
  return NextResponse.json({ ok: true, assinantes: assinantes?.length ?? 0, relatorio });
}
