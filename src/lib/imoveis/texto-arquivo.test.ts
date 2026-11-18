import { zipSync, strToU8 } from "fflate";
import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";

import { extrairTexto, textoDoDocumentoXml } from "./texto-arquivo";

describe("texto-arquivo", () => {
  it("converte o XML do Word em linhas de texto", () => {
    const xml = '<w:p><w:r><w:t>LOCADOR: Jo&#227;o &amp; Filhos</w:t></w:r></w:p><w:p><w:r><w:t>Aluguel</w:t></w:r><w:tab/><w:r><w:t>R$ 1.000,00</w:t></w:r></w:p>';
    expect(textoDoDocumentoXml(xml)).toBe("LOCADOR: João & Filhos\nAluguel R$ 1.000,00\n");
  });
  it("lê um .docx de verdade (zip) e um .txt", async () => {
    const docx = zipSync({ "word/document.xml": strToU8("<w:body><w:p><w:r><w:t>Contrato nº 1/2026</w:t></w:r></w:p></w:body>") });
    expect(await extrairTexto("contrato.docx", docx)).toContain("Contrato nº 1/2026");
    expect(await extrairTexto("a.txt", strToU8("Olá, texto"))).toBe("Olá, texto");
  });
  it("docx sem document.xml falha", async () => {
    await expect(extrairTexto("x.docx", zipSync({ "outro.xml": strToU8("a") }))).rejects.toThrow();
  });
  it("lê um PDF com texto de verdade", async () => {
    const doc = new jsPDF();
    doc.text("CONTRATO DE LOCACAO N 031/2024", 10, 20);
    doc.text("Aluguel mensal de R$ 4.800,00 ao mes.", 10, 30);
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    const texto = await extrairTexto("c.pdf", bytes);
    expect(texto).toContain("031/2024");
    expect(texto).toContain("4.800,00");
  });
});
