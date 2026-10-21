/**
 * Leitura do texto livre da coluna STATUS da planilha de acompanhamento
 * ("EXECUTADA - EMP: 3931 - DP: 26/03/2026"). Pura, testada com as grafias
 * reais da planilha de 2026 (`status.test.ts`) — havia "XECUTADA",
 * "EXECUTADO", "EMP8677", "EMP:V 32856", "Nº EMPENHO 2328", "DP" sem data…
 *
 * Decisão confirmada pelo dono: "EXECUTADA" = paga; "DP" = data do
 * pagamento. "EXECUÇÃO" (ainda em execução) = empenhada.
 */

export type StatusLido = {
  etapa: "paga" | "empenhada" | null;
  empenho: string | null;
  /** AAAA-MM-DD */
  dataPagamento: string | null;
  /** O que precisa de conferência humana (vazio = leitura limpa). */
  pendencias: string[];
};

export function lerStatus(texto: string | null | undefined): StatusLido {
  const s = (texto ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!s) return { etapa: null, empenho: null, dataPagamento: null, pendencias: [] };

  const emExecucao = /EXECU[CÇ][AÃ]O/.test(s);
  const executada = /X?ECUTAD[AO]/.test(s);
  if (!emExecucao && !executada) {
    return { etapa: null, empenho: null, dataPagamento: null, pendencias: [`Situação não reconhecida: "${texto}"`] };
  }
  const etapa = emExecucao ? "empenhada" : "paga";

  const emp = s.match(/(?:EMP(?:ENHO)?\W*(?:V\s*)?|- )(\d{3,6})/);
  const dp = s.match(/DP\W*(\d{2})\/(\d{2})\/(\d{4})/);
  const empenho = emp ? emp[1] : null;
  const dataPagamento = dp ? `${dp[3]}-${dp[2]}-${dp[1]}` : null;

  const pendencias: string[] = [];
  if (!empenho) pendencias.push("sem nº de empenho");
  if (etapa === "paga" && !dataPagamento) pendencias.push("sem data de pagamento");
  if (dataPagamento && !dataValida(dataPagamento)) pendencias.push(`data de pagamento inválida (${dataPagamento})`);

  return { etapa, empenho, dataPagamento: dataPagamento && dataValida(dataPagamento) ? dataPagamento : null, pendencias };
}

function dataValida(iso: string): boolean {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "Reforço da dotação orçamentária para repasse ao Hospital…, CNPJ…" →
 * "Repasse ao Hospital…" — o "objeto" curto que aparece nas listas. */
export function resumirObjeto(descricao: string): string {
  let d = descricao.replace(/\s+/g, " ").trim();
  d = d.replace(/^Reforço da dotação orçamentária (para|de) /i, "");
  d = d.split(/,\s*(?:CNPJ|cujo|situad|com o intuito|a fim)/i)[0] ?? d;
  d = d.charAt(0).toUpperCase() + d.slice(1);
  if (d.length <= 160) return d;
  return `${d.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}

/** "10.302.0012.2087 – Manutenção…\n\n3.3.50.43.00.00.00.00 – Subvenções" →
 * funcional "10.302.0012.2087" e natureza "3.3.50.43". */
export function lerDotacao(texto: string | null | undefined): { funcional: string | null; natureza: string | null } {
  const t = texto ?? "";
  const funcional = t.match(/\b(\d{2}\.\d{3}\.\d{4}\.\d{4})\b/)?.[1] ?? null;
  const natureza = t.match(/\b(\d\.\d\.\d{2}\.\d{2})(?:\.\d{2})*/)?.[1] ?? null;
  return { funcional, natureza };
}
