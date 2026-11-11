import type { LinhaPortal } from "@/lib/emendas/portal-tipos";

/**
 * Boletim por e-mail do portal (puro): compara a fotografia do último envio com os dados de agora
 * e monta o texto. Só o que o público já vê no portal entra no e-mail.
 */

export type EstadoBoletim = { ano: number; numero: number; etapa: string; situacao: string; valor: number; empenhado: number; pago: number };

export type Mudanca =
  | { tipo: "nova"; numero: number; vereador: string; objeto: string; valor: number }
  | { tipo: "pagamento"; numero: number; vereador: string; objeto: string; valor: number; pagoTotal: number; total: number }
  | { tipo: "empenho"; numero: number; vereador: string; objeto: string; valor: number }
  | { tipo: "fase"; numero: number; vereador: string; objeto: string; de: string; para: string }
  | { tipo: "impedimento"; numero: number; vereador: string; objeto: string; entrou: boolean };

const TOL = 0.005;

export function estadoDe(l: LinhaPortal): EstadoBoletim {
  return { ano: l.ano, numero: l.numero, etapa: l.etapa, situacao: l.situacao, valor: l.valor, empenhado: l.empenhado, pago: l.pago };
}

export function diferencas(anterior: EstadoBoletim[], atual: LinhaPortal[], nomeEtapa: (c: string) => string): Mudanca[] {
  const antes = new Map(anterior.map((e) => [e.numero, e]));
  const out: Mudanca[] = [];
  for (const l of atual) {
    const a = antes.get(l.numero);
    const base = { numero: l.numero, vereador: l.vereador, objeto: l.objeto };
    if (!a) {
      out.push({ tipo: "nova", ...base, valor: l.valor });
      continue;
    }
    if (l.pago > a.pago + TOL) out.push({ tipo: "pagamento", ...base, valor: l.pago - a.pago, pagoTotal: l.pago, total: l.valor });
    else if (l.empenhado > a.empenhado + TOL) out.push({ tipo: "empenho", ...base, valor: l.empenhado - a.empenhado });
    else if (l.etapa !== a.etapa) out.push({ tipo: "fase", ...base, de: nomeEtapa(a.etapa), para: nomeEtapa(l.etapa) });
    if ((l.situacao === "impedida") !== (a.situacao === "impedida")) out.push({ tipo: "impedimento", ...base, entrou: l.situacao === "impedida" });
  }
  return out;
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function textoDaMudanca(m: Mudanca): string {
  switch (m.tipo) {
    case "nova":
      return `Nova emenda publicada: ${brl(m.valor)}`;
    case "pagamento":
      return `Pagamento de ${brl(m.valor)} (já pago ${brl(m.pagoTotal)} de ${brl(m.total)})`;
    case "empenho":
      return `Empenho de ${brl(m.valor)}`;
    case "fase":
      return `Avançou de "${m.de}" para "${m.para}"`;
    case "impedimento":
      return m.entrou ? "Execução suspensa por impedimento" : "Impedimento resolvido";
  }
}

export function htmlDoBoletim(args: { ano: number; mudancas: Mudanca[]; urlPortal: string; urlCancelar: string; vereador?: string | null }): { assunto: string; html: string } {
  const pagos = args.mudancas.filter((m) => m.tipo === "pagamento").reduce((s, m) => s + (m.tipo === "pagamento" ? m.valor : 0), 0);
  const assunto = `Emendas impositivas ${args.ano}: ${args.mudancas.length} atualizaç${args.mudancas.length === 1 ? "ão" : "ões"}${pagos > 0 ? ` · ${brl(pagos)} pagos` : ""}`;
  const linhas = args.mudancas
    .slice(0, 60)
    .map(
      (m) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #eceaf3;vertical-align:top;width:64px;color:#6b6880;font:13px/1.4 -apple-system,Segoe UI,sans-serif">nº ${m.numero}</td>` +
        `<td style="padding:10px 0;border-bottom:1px solid #eceaf3;font:14px/1.45 -apple-system,Segoe UI,sans-serif;color:#14121f"><strong>${esc(textoDaMudanca(m))}</strong><br><span style="color:#56536a">${esc(m.objeto)} · ${esc(m.vereador)}</span></td></tr>`
    )
    .join("");
  const mais = args.mudancas.length > 60 ? `<p style="font:13px -apple-system,Segoe UI,sans-serif;color:#56536a">E mais ${args.mudancas.length - 60} atualizações no portal.</p>` : "";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f4f9;padding:24px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border-top:4px solid #6B4FBB">
<div style="padding:28px 28px 8px"><p style="margin:0;font:600 12px -apple-system,Segoe UI,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6B4FBB">Prefeitura de Cataguases · Transparência</p>
<h1 style="margin:8px 0 4px;font:700 24px/1.2 -apple-system,Segoe UI,sans-serif;color:#0C1D33">Emendas impositivas ${args.ano}</h1>
<p style="margin:0;font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#56536a">O que mudou desde o último boletim${args.vereador ? ` nas emendas de ${esc(args.vereador)}` : ""}.</p></div>
<div style="padding:8px 28px 4px"><table role="presentation" style="width:100%;border-collapse:collapse">${linhas}</table>${mais}</div>
<div style="padding:20px 28px 28px"><a href="${esc(args.urlPortal)}" style="display:inline-block;background:#0C1D33;color:#fff;text-decoration:none;font:600 14px -apple-system,Segoe UI,sans-serif;padding:12px 20px;border-radius:999px">Abrir o portal</a></div>
<div style="padding:16px 28px;background:#faf9fc;font:12px/1.5 -apple-system,Segoe UI,sans-serif;color:#6b6880">Você recebe este boletim porque confirmou o cadastro no Portal da Transparência. Seu e-mail é usado só para isto (Lei 13.709/2018). <a href="${esc(args.urlCancelar)}" style="color:#5B3FA8">Cancelar o recebimento</a>.</div>
</div></body></html>`;
  return { assunto, html };
}

export function htmlDaConfirmacao(args: { urlConfirmar: string; vereador?: string | null }): { assunto: string; html: string } {
  return {
    assunto: "Confirme o recebimento das atualizações das emendas impositivas",
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f4f9;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;border-top:4px solid #6B4FBB;padding:28px">
<p style="margin:0;font:600 12px -apple-system,Segoe UI,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6B4FBB">Prefeitura de Cataguases · Transparência</p>
<h1 style="margin:8px 0 12px;font:700 22px/1.25 -apple-system,Segoe UI,sans-serif;color:#0C1D33">Falta só confirmar</h1>
<p style="font:15px/1.55 -apple-system,Segoe UI,sans-serif;color:#33304a">Recebemos o pedido para enviar a este e-mail as novidades das emendas impositivas${args.vereador ? ` de ${esc(args.vereador)}` : ""}: novas emendas, empenhos, pagamentos e mudanças de fase.</p>
<p style="margin:24px 0"><a href="${esc(args.urlConfirmar)}" style="display:inline-block;background:#0C1D33;color:#fff;text-decoration:none;font:600 15px -apple-system,Segoe UI,sans-serif;padding:13px 22px;border-radius:999px">Confirmar o recebimento</a></p>
<p style="font:13px/1.5 -apple-system,Segoe UI,sans-serif;color:#6b6880">Se não foi você, ignore esta mensagem: nada será enviado sem a confirmação. O e-mail é usado só para este boletim e pode ser cancelado a qualquer momento (Lei 13.709/2018).</p>
</div></body></html>`,
  };
}
