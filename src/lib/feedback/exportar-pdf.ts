import { jsPDF } from "jspdf";

import { APPS_FEEDBACK, ROTULO_STATUS, ROTULO_TIPO } from "@/lib/feedback/apps";
import type { ItemExportado } from "@/lib/feedback/exportar";

const M = 15; // margem (mm)
const LARGURA = 210 - 2 * M;
const ALTURA_MAX_IMG = 120;

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function formatoImagem(arquivo: string): "PNG" | "JPEG" | null {
  if (/\.png$/i.test(arquivo)) return "PNG";
  if (/\.jpe?g$/i.test(arquivo)) return "JPEG";
  return null; // webp/gif: jsPDF não embute; segue listado como omitido
}

function hexParaRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * PDF único, para anexar numa conversa: cada pedido com seu contexto e,
 * logo abaixo da mensagem, as imagens dele (as de cada pedido ficam juntas).
 * `bytes` indexa o nome do arquivo (ver `nomeAnexo`).
 */
export function montarPdf(itens: ItemExportado[], filtrosTexto: string, bytes: Map<string, Uint8Array>): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = M;
  const garantir = (altura: number) => {
    if (y + altura > 297 - M) {
      doc.addPage();
      y = M;
    }
  };
  const texto = (t: string, tamanho: number, estilo: "normal" | "bold", cor: [number, number, number] = [30, 41, 59]) => {
    doc.setFont("helvetica", estilo).setFontSize(tamanho).setTextColor(...cor);
    for (const l of doc.splitTextToSize(t, LARGURA) as string[]) {
      garantir(tamanho * 0.5);
      doc.text(l, M, y);
      y += tamanho * 0.45;
    }
  };

  texto("Feedback dos usuários — exportação", 16, "bold");
  y += 1;
  texto(`Gerado em ${dataHora(new Date().toISOString())} · ${itens.length} ${itens.length === 1 ? "pedido" : "pedidos"}`, 9, "normal", [100, 116, 139]);
  texto(`Filtros: ${filtrosTexto}`, 9, "normal", [100, 116, 139]);
  y += 4;

  itens.forEach(({ item, anexos, anexosFalhos }, i) => {
    garantir(40);
    const app = APPS_FEEDBACK[item.app];
    doc.setFillColor(...hexParaRgb(app.cor)).rect(M, y, LARGURA, 1.2, "F");
    y += 5;
    texto(`${i + 1}. ${app.nome} · ${ROTULO_TIPO[item.tipo]}  (${ROTULO_STATUS[item.status]})`, 12, "bold");
    texto(
      `${item.autor_nome}${item.autor_email ? ` <${item.autor_email}>` : ""} · ${dataHora(item.criado_em)}${item.pagina ? ` · Tela: ${item.pagina}` : ""}`,
      8.5, "normal", [100, 116, 139],
    );
    y += 2;
    texto(item.mensagem, 10.5, "normal");
    y += 2;

    const omitidos: string[] = [];
    for (const a of anexos) {
      const dados = bytes.get(a.arquivo);
      const fmt = formatoImagem(a.arquivo);
      if (!dados || !fmt) {
        omitidos.push(a.arquivo);
        continue;
      }
      const props = doc.getImageProperties(dados);
      let w = Math.min(LARGURA, (props.width * 25.4) / 96); // tamanho natural a 96 dpi, limitado à página
      let h = (w * props.height) / props.width;
      if (h > ALTURA_MAX_IMG) {
        h = ALTURA_MAX_IMG;
        w = (h * props.width) / props.height;
      }
      garantir(h + 6);
      doc.addImage(dados, fmt, M, y, w, h);
      doc.setDrawColor(203, 213, 225).rect(M, y, w, h);
      y += h + 2;
      texto(a.arquivo, 7.5, "normal", [148, 163, 184]);
      y += 2;
    }
    if (omitidos.length > 0) texto(`Anexos não embutidos (formato não suportado): ${omitidos.join(", ")}`, 8.5, "normal", [180, 83, 9]);
    if (anexosFalhos > 0) texto(`${anexosFalhos} anexo(s) não puderam ser baixados.`, 8.5, "normal", [180, 83, 9]);
    y += 6;
  });

  return new Uint8Array(doc.output("arraybuffer"));
}
