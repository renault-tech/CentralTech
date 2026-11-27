import { ROTULO_DRIVE, type TipoDrive } from "@/lib/emendas/documentos-drive";

/**
 * Nome padrão dos arquivos no Drive, pelo conteúdo: `E020 - TERMO - 070-2026 (original).pdf`.
 * Puro e sem dependência de servidor. O padrão fica aqui, num lugar só, para virar configurável por instituição.
 */
const NOME_CURTO: Record<TipoDrive, string> = {
  termo: "TERMO",
  plano_trabalho: "PLANO DE TRABALHO",
  extrato: "EXTRATO",
  anuencia_sus: "ANUENCIA SUS",
  relatorio_gestao: "RELATORIO DE GESTAO",
  jornal_edicao: "JORNAL OFICIAL",
  convenio: "CONVENIO",
  nota_fiscal: "NOTA FISCAL",
  atesto: "ATESTO",
  prestacao_contas: "PRESTACAO DE CONTAS",
};

export type SufixoArquivo = "original" | "versao publica" | null;

/** Tira o que o Drive ou o sistema de arquivos tratam mal e comprime espaços. */
export function limparNome(texto: string): string {
  return texto
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-{2,}/g, "-")
    .trim()
    .slice(0, 150);
}

export function nomeDocumento(entrada: { tipo: TipoDrive; numeroEmenda: number; ano: number; numeroTermo?: string | null; sufixo?: SufixoArquivo; extensao?: string }): string {
  const emenda = `E${String(entrada.numeroEmenda).padStart(3, "0")}`;
  const termo = entrada.numeroTermo?.trim() ? limparNome(entrada.numeroTermo.replace(/\//g, "-")) : null;
  const identificacao = entrada.tipo === "termo" || entrada.tipo === "convenio" ? (termo ? termo : String(entrada.ano)) : String(entrada.ano);
  const base = `${emenda} - ${NOME_CURTO[entrada.tipo]} - ${identificacao}${entrada.sufixo ? ` (${entrada.sufixo})` : ""}`;
  const ext = (entrada.extensao ?? "pdf").replace(/[^a-z0-9]/gi, "").toLowerCase() || "pdf";
  return `${limparNome(base)}.${ext}`;
}

/** Quando já existe um arquivo com o mesmo nome, acrescenta a data para não sobrescrever nem confundir. */
export function nomeComData(nome: string, data: Date): string {
  const ponto = nome.lastIndexOf(".");
  const dia = data.toISOString().slice(0, 10);
  return ponto > 0 ? `${nome.slice(0, ponto)} [${dia}]${nome.slice(ponto)}` : `${nome} [${dia}]`;
}

/** Rótulo para telas. */
export function rotuloTipo(tipo: TipoDrive): string {
  return ROTULO_DRIVE[tipo];
}
