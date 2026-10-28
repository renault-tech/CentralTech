import "server-only";

import { jsPDF } from "jspdf";

/**
 * PDF de tabelas (relatórios e lista de emendas), paisagem A4. Só a fonte padrão do PDF
 * (helvetica, Latin-1): acentos do português funcionam; símbolos fora disso são trocados.
 */
export type TabelaPdf = {
  titulo: string;
  colunas: string[];
  linhas: (string | number)[][];
  /** Índices de colunas numéricas/monetárias (alinhadas à direita; número vira R$). */
  monetarias: number[];
  /** Linha de total opcional (mesmo número de colunas). */
  total?: (string | number)[];
};

const M = 12;
const LARGURA = 297 - 2 * M;
const ALTURA = 210;
const LIMPA: Record<string, string> = { "≥": ">=", "≤": "<=", "→": "->", "–": "-", "“": '"', "”": '"', "’": "'", "‘": "'", "…": "..." };

function seguro(t: string): string {
  return t.replace(/[≥≤→–“”’‘…]/g, (c) => LIMPA[c] ?? "").replace(/[^ -ÿ—•]/g, "");
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function celula(v: string | number, i: number, t: TabelaPdf): string {
  return seguro(typeof v === "number" && t.monetarias.includes(i) ? brl(v) : String(v ?? ""));
}

function larguras(t: TabelaPdf): number[] {
  const peso = t.colunas.map((c, i) => {
    const maior = Math.max(c.length, ...t.linhas.map((l) => celula(l[i] ?? "", i, t).length));
    return Math.min(Math.max(maior, 6), 48);
  });
  const soma = peso.reduce((a, b) => a + b, 0);
  return peso.map((p) => (p / soma) * LARGURA);
}

export function montarPdfTabelas(opts: { titulo: string; subtitulo?: string; tabelas: TabelaPdf[] }): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  let y = M;

  const cabecalhoDocumento = () => {
    doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(12, 29, 51);
    doc.text(seguro(opts.titulo), M, y + 4);
    y += 8;
    if (opts.subtitulo) {
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100, 116, 139);
      for (const l of doc.splitTextToSize(seguro(opts.subtitulo), LARGURA) as string[]) {
        doc.text(l, M, y + 3);
        y += 4;
      }
    }
    y += 3;
  };
  cabecalhoDocumento();

  for (const t of opts.tabelas) {
    const w = larguras(t);
    const x0 = (i: number) => M + w.slice(0, i).reduce((a, b) => a + b, 0);

    const cabecalhoTabela = () => {
      doc.setFillColor(241, 245, 249).rect(M, y, LARGURA, 7, "F");
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(71, 85, 105);
      t.colunas.forEach((c, i) => {
        const txt = (doc.splitTextToSize(seguro(c), w[i] - 3) as string[])[0] ?? "";
        if (t.monetarias.includes(i)) doc.text(txt, x0(i) + w[i] - 1.5, y + 4.7, { align: "right" });
        else doc.text(txt, x0(i) + 1.5, y + 4.7);
      });
      y += 7;
    };

    if (y + 24 > ALTURA - M) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(12, 29, 51);
    doc.text(seguro(t.titulo), M, y + 4);
    y += 7;
    cabecalhoTabela();

    const linhas = t.total ? [...t.linhas, t.total] : t.linhas;
    linhas.forEach((l, k) => {
      const ehTotal = !!t.total && k === linhas.length - 1;
      doc.setFont("helvetica", ehTotal ? "bold" : "normal").setFontSize(8);
      const partes = l.map((v, i) => doc.splitTextToSize(celula(v, i, t), w[i] - 3) as string[]);
      const altura = Math.max(...partes.map((p) => p.length)) * 3.6 + 2.4;
      if (y + altura > ALTURA - M - 6) {
        doc.addPage();
        y = M;
        cabecalhoTabela();
        doc.setFont("helvetica", ehTotal ? "bold" : "normal").setFontSize(8);
      }
      if (k % 2 === 1 && !ehTotal) doc.setFillColor(248, 250, 252).rect(M, y, LARGURA, altura, "F");
      doc.setTextColor(30, 41, 59);
      partes.forEach((p, i) =>
        p.forEach((linha, n) => {
          const yy = y + 4 + n * 3.6;
          if (t.monetarias.includes(i)) doc.text(linha, x0(i) + w[i] - 1.5, yy, { align: "right" });
          else doc.text(linha, x0(i) + 1.5, yy);
        })
      );
      doc.setDrawColor(226, 232, 240).line(M, y + altura, M + LARGURA, y + altura);
      y += altura;
    });
    y += 8;
  }

  const paginas = doc.getNumberOfPages();
  const gerado = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(148, 163, 184);
    doc.text(seguro(`Central Cataguases - Emendas Impositivas - gerado em ${gerado}`), M, ALTURA - 6);
    doc.text(`Pagina ${p} de ${paginas}`, 297 - M, ALTURA - 6, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
