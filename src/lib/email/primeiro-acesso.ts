import "server-only";

import { enviarEmailBrevo } from "@/lib/email/brevo";
import { moduloInfo } from "@/lib/modulos-info";
import type { Modulo } from "@/types/database";

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** E-mail com o link de primeiro acesso (persistente — `hub.convites_acesso`). */
export async function enviarEmailPrimeiroAcesso(args: {
  nome: string;
  email: string;
  link: string;
  modulos: Modulo[];
}): Promise<boolean> {
  const primeiroNome = escapar(args.nome.trim().split(/\s+/)[0] ?? "");
  const lista = args.modulos.length
    ? `<p>Módulos liberados para você: <b>${args.modulos.map((m) => escapar(moduloInfo(m).nome)).join(", ")}</b>.</p>`
    : "";
  const resultado = await enviarEmailBrevo({
    destinatarioEmail: args.email,
    destinatarioNome: args.nome,
    remetenteNome: "Central Cataguases",
    assunto: "Seu acesso à Central Cataguases",
    html: `
      <p>Olá${primeiroNome ? `, ${primeiroNome}` : ""}!</p>
      <p>Você recebeu acesso à <b>Central Cataguases</b>, a plataforma de sistemas da Prefeitura.</p>
      ${lista}
      <p>Para começar, defina a sua senha. Ela vale para todos os módulos liberados:</p>
      <p><a href="${escapar(args.link)}" style="display:inline-block;background:#0C1D33;color:#fff;
      padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">
      Definir minha senha</a></p>
      <p style="color:#64748b;font-size:13px;">Este link continua válido até você definir a senha.
      Depois disso, entre sempre pelo e-mail e senha que você escolheu.</p>
      <p style="color:#94a3b8;font-size:12px;">Se você não esperava este e-mail, pode ignorá-lo.</p>
    `,
  });
  if (!resultado.ok) console.error("[enviarEmailPrimeiroAcesso] falhou:", resultado.erro);
  return resultado.ok;
}
