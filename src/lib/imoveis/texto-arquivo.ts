/**
 * Extração do TEXTO de um arquivo enviado para leitura (PDF, Word .docx ou texto puro). Só servidor; nada é gravado e o arquivo
 * nunca é guardado. PDF digitalizado (imagem) não tem texto: o chamador avisa e a pessoa digita (sem OCR).
 */

export const EXTENSOES_LEITURA = [".pdf", ".docx", ".txt"] as const;

function decodificarXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Texto do `word/document.xml` de um .docx: parágrafos viram linhas, tabulações e células viram espaço. */
export function textoDoDocumentoXml(xml: string): string {
  return decodificarXml(
    xml
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:(?:tab|br)\b[^>]*\/>/g, " ")
      .replace(/<\/w:tc>/g, " ")
      .replace(/<[^>]+>/g, "")
  );
}

export async function extrairTexto(nome: string, bytes: Uint8Array): Promise<string> {
  const n = nome.toLowerCase();
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
  if (n.endsWith(".docx") || (zip && !n.endsWith(".pdf"))) {
    const { unzipSync, strFromU8 } = await import("fflate");
    const arquivos = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
    const doc = arquivos["word/document.xml"];
    if (!doc) throw new Error("docx sem word/document.xml");
    return textoDoDocumentoXml(strFromU8(doc));
  }
  if (n.endsWith(".txt")) return new TextDecoder("utf-8").decode(bytes);
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}
