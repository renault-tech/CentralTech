import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { criarClienteNumeraAdmin } from "@/lib/supabase/numera-admin";
import { enviarEmailBrevo } from "@/lib/email/brevo";
import { MODULOS } from "@/lib/modulos-info";

export const dynamic = "force-dynamic";

/**
 * Bypass do "esqueci minha senha" do Numera: o SMTP nativo do Supabase
 * está com um bug confirmado de plataforma naquele projeto (credenciais
 * Brevo válidas, testadas fora do Supabase com sucesso — só o envio
 * disparado pelo GoTrue nunca chega; suporte Supabase já acionado). Em vez
 * de depender do SMTP quebrado, este endpoint GERA o link de recuperação
 * pela Admin API (`generateLink`, que nunca envia e-mail sozinha — só
 * devolve o link pronto) e envia o e-mail nós mesmos, via HTTPS direto à
 * Brevo (`enviarEmailBrevo`), sem passar pela porta 587 problemática.
 *
 * O app do Numera é um site estático servido de outra origem, por isso
 * precisa de `fetch` cross-origin (não dá para usar Server Action) — o
 * `Access-Control-Allow-Origin` abaixo só controla se o JS do NAVEGADOR do
 * Numera consegue LER a resposta; não é (e não pretende ser) o controle de
 * acesso real. Quem realmente impede abuso é: (1) a resposta sempre
 * idêntica abaixo, entre e-mail cadastrado ou não, e (2) o
 * anti-enumeração por tempo constante + a janela de repetição por e-mail
 * logo adiante.
 */

const ORIGEM_NUMERA = MODULOS.numera.url;

const esquema = z.object({ email: z.email() });

function comCors(resposta: NextResponse): NextResponse {
  resposta.headers.set("Access-Control-Allow-Origin", ORIGEM_NUMERA);
  resposta.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  resposta.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return resposta;
}

export async function OPTIONS() {
  return comCors(new NextResponse(null, { status: 204 }));
}

const MENSAGEM_GENERICA =
  "Se este e-mail estiver cadastrado, você vai receber um link para definir uma nova senha.";

/** Achado de auditoria: sem isto, o caminho "conta existe" sempre demora
 * mais que "conta não existe" (chamada extra à Brevo), dando pra distinguir
 * os dois casos só medindo o tempo de resposta — o mesmo problema que a
 * mensagem genérica tenta evitar, só que pelo relógio em vez do texto.
 * Sempre espera até completar este piso antes de responder, faça o que
 * fizer dentro dele. */
const TEMPO_MINIMO_RESPOSTA_MS = 1200;

/** Trava por e-mail: best-effort (em memória, por instância — reseta em
 * cold start e não é compartilhado entre instâncias do Vercel), mas já
 * eleva o custo de "encher a caixa de entrada de alguém"/varrer uma lista
 * de e-mails candidatos, que o endpoint anterior (`resetPasswordForEmail`
 * direto do navegador) também não tinha. Não pretende ser rate limit de
 * produção robusto — se abuso real aparecer, o próximo passo é um serviço
 * dedicado (Upstash/Vercel KV), não mais Map em memória. */
const ULTIMA_TENTATIVA_POR_EMAIL = new Map<string, number>();
const JANELA_REPETICAO_MS = 60_000;

function podeTentar(email: string): boolean {
  const chave = email.toLowerCase();
  const agora = Date.now();
  const ultima = ULTIMA_TENTATIVA_POR_EMAIL.get(chave);
  if (ultima && agora - ultima < JANELA_REPETICAO_MS) return false;
  ULTIMA_TENTATIVA_POR_EMAIL.set(chave, agora);
  return true;
}

async function completarNoTempoMinimo<T>(inicio: number, trabalho: Promise<T>): Promise<T> {
  const [resultado] = await Promise.all([
    trabalho,
    new Promise((resolve) => setTimeout(resolve, Math.max(0, TEMPO_MINIMO_RESPOSTA_MS - (Date.now() - inicio)))),
  ]);
  return resultado;
}

export async function POST(request: NextRequest) {
  const inicio = Date.now();
  const corpo = await request.json().catch(() => null);
  const analise = esquema.safeParse(corpo);
  if (!analise.success) {
    return comCors(NextResponse.json({ mensagem: MENSAGEM_GENERICA }));
  }

  const email = analise.data.email;

  await completarNoTempoMinimo(
    inicio,
    (async () => {
      if (!podeTentar(email)) return;

      try {
        const numeraAdmin = criarClienteNumeraAdmin();
        const { data, error } = await numeraAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: `${ORIGEM_NUMERA}/` },
        });

        const link = data?.properties?.action_link;
        if (error || !link) {
          // `generateLink` retorna erro quando o e-mail não tem conta — é
          // exatamente o caso que não deve vazar pra fora. Loga só para
          // diagnóstico interno.
          if (error) console.error("[recuperar-senha numera] generateLink:", error.message);
          return;
        }

        const resultado = await enviarEmailBrevo({
          destinatarioEmail: email,
          assunto: "Recuperação de senha — Numera",
          html: `
            <p>Olá,</p>
            <p>Recebemos um pedido para redefinir a senha da sua conta no <b>Numera</b>
            (numeração de documentos oficiais da Prefeitura de Cataguases).</p>
            <p><a href="${link}" style="display:inline-block;background:#0071e3;color:#fff;
            padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">
            Definir nova senha</a></p>
            <p>Se você não pediu essa redefinição, pode ignorar este e-mail — sua senha
            continua a mesma.</p>
            <p style="color:#94a3b8;font-size:12px;">Este link expira em algumas horas.
            Se já tiver expirado, solicite um novo pela tela de login.</p>
          `,
        });

        if (!resultado.ok) {
          console.error("[recuperar-senha numera] falha ao enviar via Brevo:", resultado.erro);
        }
      } catch (e) {
        console.error("[recuperar-senha numera] erro inesperado:", e);
      }
    })()
  );

  return comCors(NextResponse.json({ mensagem: MENSAGEM_GENERICA }));
}
