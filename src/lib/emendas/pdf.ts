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

export const M = 12;
export const LARGURA = 297 - 2 * M;
export const ALTURA = 210;
const LIMPA: Record<string, string> = {
  "≥": ">=",
  "≤": "<=",
  "→": "->",
  "–": "-",
  "“": '"',
  "”": '"',
  "’": "'",
  "‘": "'",
  "…": "...",
};

export function seguro(t: string): string {
  return t
    .replace(/[≥≤→–“”’‘…]/g, (c) => LIMPA[c] ?? "")
    .replace(/[^ -ÿ—•]/g, "");
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function celula(v: string | number, i: number, t: TabelaPdf): string {
  return seguro(
    typeof v === "number" && t.monetarias.includes(i)
      ? brl(v)
      : String(v ?? ""),
  );
}

function larguras(t: TabelaPdf): number[] {
  // Colunas de dinheiro têm largura fixa pelo maior valor (R$ nunca quebra no meio: "R$ 86.916,3 / 3"); o resto da página
  // (LARGURA - dinheiro) é repartido entre as colunas de texto na proporção do conteúdo, com um piso para não esmagá-las.
  const dinheiro = t.colunas.map((_, i) =>
    t.monetarias.includes(i)
      ? Math.max(
          18,
          ...t.linhas.concat(t.total ? [t.total] : []).map((l) => celula(l[i] ?? "", i, t).length * 1.75 + 3),
        )
      : 0,
  );
  const reservado = dinheiro.reduce((a, b) => a + b, 0);
  const textos = t.colunas.map((_, i) => !t.monetarias.includes(i));
  // Piso de cada coluna de texto: a maior palavra do conteúdo ou do cabeçalho inteira (palavra não quebra no meio: "Re/pas/se").
  const piso = t.colunas.map((c, i) => {
    if (!textos[i]) return 0;
    const palavras = [...c.split(" "), ...t.linhas.flatMap((l) => celula(l[i] ?? "", i, t).split(/\s+/))];
    return Math.min(Math.max(...palavras.map((w) => w.length)) * 1.7 + 3, 30);
  });
  const peso = t.colunas.map((_, i) => (textos[i] ? Math.min(Math.max(...t.linhas.map((l) => celula(l[i] ?? "", i, t).length), 8), 48) : 0));
  const sobra = LARGURA - reservado - piso.reduce((a, b) => a + b, 0);
  if (sobra < 0) {
    // Não cabe nem no piso (muitas colunas): reparte tudo na proporção.
    const todos = dinheiro.map((d, i) => d || piso[i]);
    const soma = todos.reduce((a, b) => a + b, 0);
    return todos.map((p) => (p / soma) * LARGURA);
  }
  const somaPeso = peso.reduce((a, b) => a + b, 0) || 1;
  return t.colunas.map((_, i) => (textos[i] ? piso[i] + (peso[i] / somaPeso) * sobra : dinheiro[i]));
}

/**
 * Desenha tabelas a partir de `y`, quebrando de página (repete o cabeçalho) e devolve o novo `y`.
 * `aoNovaPagina` deixa o chamador redesenhar o que quiser no topo (faixa, título corrido).
 */
export function desenharTabelas(
  doc: jsPDF,
  tabelas: TabelaPdf[],
  yInicial: number,
  aoNovaPagina?: () => number,
): number {
  let y = yInicial;
  const novaPagina = () => {
    doc.addPage();
    y = aoNovaPagina ? aoNovaPagina() : M;
  };
  for (const t of tabelas) {
    const w = larguras(t);
    const x0 = (i: number) => M + w.slice(0, i).reduce((a, b) => a + b, 0);

    const cabecalhoTabela = () => {
      doc.setFont("helvetica", "bold").setFontSize(8);
      const cab = t.colunas.map((c, i) => (doc.splitTextToSize(seguro(c), w[i] - 3) as string[]).slice(0, 3));
      const altCab = Math.max(...cab.map((p) => p.length)) * 3.6 + 3.4;
      doc.setFillColor(241, 245, 249).rect(M, y, LARGURA, altCab, "F");
      doc.setTextColor(71, 85, 105);
      cab.forEach((linhasDoCab, i) =>
        linhasDoCab.forEach((txt, n) => {
          const yy = y + 4.7 + n * 3.6;
          if (t.monetarias.includes(i)) doc.text(txt, x0(i) + w[i] - 1.5, yy, { align: "right" });
          else doc.text(txt, x0(i) + 1.5, yy);
        }),
      );
      y += altCab;
    };

    if (y + 24 > ALTURA - M) novaPagina();
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(12, 29, 51);
    doc.text(seguro(t.titulo), M, y + 4);
    y += 7;
    cabecalhoTabela();

    const linhas = t.total ? [...t.linhas, t.total] : t.linhas;
    linhas.forEach((l, k) => {
      const ehTotal = !!t.total && k === linhas.length - 1;
      doc.setFont("helvetica", ehTotal ? "bold" : "normal").setFontSize(8);
      const partes = l.map(
        (v, i) => doc.splitTextToSize(celula(v, i, t), w[i] - 3) as string[],
      );
      const altura = Math.max(...partes.map((p) => p.length)) * 3.6 + 2.4;
      if (y + altura > ALTURA - M - 6) {
        novaPagina();
        cabecalhoTabela();
        doc.setFont("helvetica", ehTotal ? "bold" : "normal").setFontSize(8);
      }
      if (k % 2 === 1 && !ehTotal)
        doc.setFillColor(248, 250, 252).rect(M, y, LARGURA, altura, "F");
      doc.setTextColor(30, 41, 59);
      partes.forEach((p, i) =>
        p.forEach((linha, n) => {
          const yy = y + 4 + n * 3.6;
          if (t.monetarias.includes(i))
            doc.text(linha, x0(i) + w[i] - 1.5, yy, { align: "right" });
          else doc.text(linha, x0(i) + 1.5, yy);
        }),
      );
      doc
        .setDrawColor(226, 232, 240)
        .line(M, y + altura, M + LARGURA, y + altura);
      y += altura;
    });
    y += 8;
  }
  return y;
}

/** Rodapé de todas as páginas: identificação, data de geração e "Página x de y". */
export function desenharRodapes(doc: jsPDF, rodape?: string) {
  const paginas = doc.getNumberOfPages();
  const gerado = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc
      .setFont("helvetica", "normal")
      .setFontSize(7.5)
      .setTextColor(148, 163, 184);
    doc.text(
      seguro(
        `${rodape ?? "Central Cataguases - Emendas Impositivas"} - gerado em ${gerado}`,
      ),
      M,
      ALTURA - 6,
    );
    doc.text(`Página ${p} de ${paginas}`, 297 - M, ALTURA - 6, {
      align: "right",
    });
  }
}

/** `rodape`: identificação do módulo no pé de cada página (padrão: Emendas). */
export function montarPdfTabelas(opts: {
  titulo: string;
  subtitulo?: string;
  tabelas: TabelaPdf[];
  rodape?: string;
}): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  let y = M;

  const cabecalhoDocumento = () => {
    doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(12, 29, 51);
    doc.text(seguro(opts.titulo), M, y + 4);
    y += 8;
    if (opts.subtitulo) {
      doc
        .setFont("helvetica", "normal")
        .setFontSize(9)
        .setTextColor(100, 116, 139);
      for (const l of doc.splitTextToSize(
        seguro(opts.subtitulo),
        LARGURA,
      ) as string[]) {
        doc.text(l, M, y + 3);
        y += 4;
      }
    }
    y += 3;
  };
  cabecalhoDocumento();

  desenharTabelas(doc, opts.tabelas, y);
  desenharRodapes(doc, opts.rodape);
  return new Uint8Array(doc.output("arraybuffer"));
}
