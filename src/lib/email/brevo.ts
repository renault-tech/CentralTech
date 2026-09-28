import "server-only";

import { envBrevo } from "@/lib/env";

/**
 * Envia e-mail transacional via a API HTTPS da Brevo
 * (`https://api.brevo.com/v3/smtp/email`), sem passar pelo SMTP-on-587 do
 * Supabase — a mesma porta 443/HTTPS já usada por qualquer chamada normal
 * de API, que nunca teve o problema que a 587 tem no projeto do Numera
 * (ver changelog "Bypass do SMTP quebrado do Numera"). Diferente da rota
 * de e-mail do App-Compras (que roda dentro do Postgres via `pg_net`),
 * esta chama a API da Brevo diretamente do servidor Next.js — mesmo
 * provedor, caminho de transporte diferente por não haver Postgres/pg_net
 * disponível aqui (é o projeto do Hub, não um banco).
 *
 * Nunca lança: erro de rede/API é logado e devolvido como `{ ok: false }`
 * para quem chama decidir o que fazer (nas rotas que usam isto, o
 * chamador sempre responde genérico ao público de qualquer forma, para
 * não expor se o envio funcionou).
 */
export async function enviarEmailBrevo(args: {
  destinatarioEmail: string;
  destinatarioNome?: string;
  assunto: string;
  html: string;
}): Promise<{ ok: boolean; erro?: string }> {
  let env: ReturnType<typeof envBrevo>;
  try {
    env = envBrevo();
  } catch (e) {
    console.error("[enviarEmailBrevo] BREVO_API_KEY/BREVO_REMETENTE_EMAIL não configurados:", e);
    return { ok: false, erro: "Brevo não configurado nesta implantação." };
  }

  try {
    const resposta = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { email: env.BREVO_REMETENTE_EMAIL, name: env.BREVO_REMETENTE_NOME },
        to: [{ email: args.destinatarioEmail, name: args.destinatarioNome ?? args.destinatarioEmail }],
        subject: args.assunto,
        htmlContent: args.html,
      }),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      console.error("[enviarEmailBrevo] API da Brevo recusou:", resposta.status, corpo);
      return { ok: false, erro: `Brevo respondeu ${resposta.status}` };
    }

    return { ok: true };
  } catch (e) {
    console.error("[enviarEmailBrevo] falha de rede ao chamar a Brevo:", e);
    return { ok: false, erro: "Falha de rede ao enviar o e-mail." };
  }
}
