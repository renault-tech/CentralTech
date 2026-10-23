import { APPS_FEEDBACK, ROTULO_STATUS, ROTULO_TIPO } from "@/lib/feedback/apps";
import type { FeedbackCentral } from "@/types/database";

export type AnexoExportado = { caminho: string; arquivo: string };
export type ItemExportado = { item: FeedbackCentral; anexos: AnexoExportado[]; anexosFalhos: number };

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/** Nome de arquivo seguro e único dentro do ZIP: `<n>-<app>-<i>.<ext>`. */
export function nomeAnexo(numero: number, app: string, indice: number, caminhoOriginal: string): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(caminhoOriginal)?.[1]?.toLowerCase() ?? "bin";
  return `${String(numero).padStart(3, "0")}-${app}-${indice + 1}.${ext}`;
}

const ehImagem = (arquivo: string) => /\.(png|jpe?g|webp|gif)$/i.test(arquivo);

/**
 * Markdown pensado para ser lido por uma IA/pessoa junto com a pasta `anexos/`:
 * uma seção por pedido, com contexto (app, tela, autor, status) e as imagens
 * referenciadas por caminho relativo.
 */
export function montarMarkdown(itens: ItemExportado[], filtrosTexto: string, geradoEm = new Date()): string {
  const linhas: string[] = [
    "# Feedback dos usuários — exportação",
    "",
    `Gerado em ${dataHora(geradoEm.toISOString())} · ${itens.length} ${itens.length === 1 ? "pedido" : "pedidos"}`,
    `Filtros: ${filtrosTexto}`,
    "",
    "Cada pedido tem o aplicativo de origem, a tela em que o usuário estava e as imagens anexadas (pasta `anexos/`).",
    "",
    "## Índice",
    "",
  ];
  itens.forEach(({ item }, i) => {
    const resumo = item.mensagem.replace(/\s+/g, " ").slice(0, 80);
    linhas.push(`${i + 1}. [${APPS_FEEDBACK[item.app].nome}] ${ROTULO_TIPO[item.tipo]} — ${resumo}${item.mensagem.length > 80 ? "…" : ""}`);
  });
  linhas.push("");

  itens.forEach(({ item, anexos, anexosFalhos }, i) => {
    linhas.push("---", "", `## ${i + 1}. ${APPS_FEEDBACK[item.app].nome} · ${ROTULO_TIPO[item.tipo]}`, "");
    linhas.push(`- **Aplicativo:** ${APPS_FEEDBACK[item.app].nome}`);
    linhas.push(`- **Tipo:** ${ROTULO_TIPO[item.tipo]}`);
    linhas.push(`- **Status:** ${ROTULO_STATUS[item.status]}`);
    linhas.push(`- **Autor:** ${item.autor_nome}${item.autor_email ? ` (${item.autor_email})` : ""}`);
    linhas.push(`- **Enviado em:** ${dataHora(item.criado_em)}`);
    if (item.pagina) linhas.push(`- **Tela:** ${item.pagina}`);
    linhas.push(`- **ID:** ${item.id}`, "", "**Mensagem:**", "");
    linhas.push(...item.mensagem.split("\n").map((l) => `> ${l}`), "");
    if (anexos.length > 0) {
      linhas.push("**Anexos:**", "");
      for (const a of anexos) {
        linhas.push(ehImagem(a.arquivo) ? `![${a.arquivo}](anexos/${a.arquivo})` : `- [${a.arquivo}](anexos/${a.arquivo})`, "");
      }
    }
    if (anexosFalhos > 0) linhas.push(`_${anexosFalhos} anexo(s) não puderam ser baixados._`, "");
  });
  return linhas.join("\n");
}
