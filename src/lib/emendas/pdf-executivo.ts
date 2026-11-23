import "server-only";

import { jsPDF } from "jspdf";

import {
  ALTURA,
  LARGURA,
  M,
  desenharRodapes,
  desenharTabelas,
  seguro,
  type TabelaPdf,
} from "@/lib/emendas/pdf";

/**
 * Relatório executivo em PDF (A4 paisagem), para apresentar panoramas ao prefeito e à Câmara: capa com os filtros
 * aplicados, indicadores, gráficos VETORIAIS (nítidos em qualquer zoom e na impressão) e, se pedido, as tabelas.
 * Só a fonte padrão do PDF (Latin-1). Cada gráfico é calculado de números que o chamador já filtrou: nada aqui filtra.
 */

export type Kpi = { rotulo: string; valor: string; apoio?: string };
export type ItemGrafico = {
  rotulo: string;
  valor: number;
  cor?: string;
  apoio?: string;
};
export type Formato = "moeda" | "numero" | "percentual";
export type Grafico =
  | {
      tipo: "barras";
      titulo: string;
      subtitulo?: string;
      formato: Formato;
      itens: ItemGrafico[];
      /** máximo de linhas; o resto vira "Demais" (nos percentuais, apenas some) */
      limite?: number;
      cheio?: boolean;
      /** Marca de referência (ex.: mínimo de 50% na Saúde), só em gráficos percentuais (escala de 0 a 100). */
      meta?: { valor: number; rotulo: string };
    }
  | {
      tipo: "rosca";
      titulo: string;
      subtitulo?: string;
      formato: Formato;
      itens: ItemGrafico[];
    }
  | {
      tipo: "empilhada";
      titulo: string;
      subtitulo?: string;
      formato: Formato;
      categorias: { rotulo: string; cor: string }[];
      linhas: { rotulo: string; valores: number[] }[];
      limite?: number;
      /** Ocupa a linha inteira (muitas linhas ou rótulos longos). */
      cheio?: boolean;
    };

export type RelatorioExecutivo = {
  titulo: string;
  subtitulo?: string;
  /** Nome do módulo (canto superior direito). */
  modulo?: string;
  /** Cor do módulo (hex). */
  cor?: string;
  /** Filtros aplicados, já em texto. Vazio = sem filtro. */
  filtros: string[];
  /** Frase de contagem sob o título, ex.: "41 emendas (de 215 do exercício)". */
  contagem?: string;
  kpis: Kpi[];
  graficos: Grafico[];
  tabelas?: TabelaPdf[];
  rodape?: string;
};

export const PALETA_PDF = [
  "#6B4FBB",
  "#0E7490",
  "#C2410C",
  "#5C7A1F",
  "#BE185D",
  "#1D4ED8",
  "#A16207",
  "#0F766E",
];
const CINZA = "#94A3B8";
const MARINHO: [number, number, number] = [12, 29, 51];
const TEXTO: [number, number, number] = [30, 41, 59];
const APOIO: [number, number, number] = [100, 116, 139];

export function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Cor clara demais sobre a trilha cinza some na impressão: escurece só o necessário, mantendo o matiz. */
export function corLegivel(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum <= 0.62) return [r, g, b];
  const f = Math.max(0.35, 0.62 / lum - 0.12);
  return [Math.round(r * f), Math.round(g * f), Math.round(b * f)];
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Valor curto para rótulos de gráfico (R$ 1,25 mi, R$ 340 mil). */
export function valorCurto(v: number, formato: Formato): string {
  if (formato === "numero")
    return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  if (formato === "percentual")
    return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
  const abs = Math.abs(v);
  if (abs >= 1e6)
    return `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (abs >= 1e3)
    return `R$ ${Math.round(v / 1e3).toLocaleString("pt-BR")} mil`;
  return brl(v);
}
const pct = (parte: number, total: number) =>
  total > 0
    ? `${((parte / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`
    : "0%";

/** Corta o texto para caber em `larg` mm (uma linha), com reticências. */
function caber(doc: jsPDF, texto: string, larg: number): string {
  const t = seguro(texto);
  if (doc.getTextWidth(t) <= larg) return t;
  let s = t;
  while (s.length > 1 && doc.getTextWidth(`${s}...`) > larg) s = s.slice(0, -1);
  return `${s.trimEnd()}...`;
}

/**
 * Agrega o que passa de `limite` linhas num "Demais" (o gráfico continua somando o total). `agregar: false` (percentuais,
 * que não se somam) só corta nas maiores.
 */
export function limitar(
  itens: ItemGrafico[],
  limite: number,
  agregar = true,
): ItemGrafico[] {
  const ord = itens
    .filter((i) => i.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  if (ord.length <= limite) return ord;
  if (!agregar) return ord.slice(0, limite);
  const resto = ord.slice(limite - 1).reduce((t, i) => t + i.valor, 0);
  return [
    ...ord.slice(0, limite - 1),
    { rotulo: `Demais (${ord.length - limite + 1})`, valor: resto, cor: CINZA },
  ];
}

type Ctx = {
  doc: jsPDF;
  y: number;
  cor: [number, number, number];
  r: RelatorioExecutivo;
};

const GAP = 6;
const LARG_CARTAO = (LARGURA - GAP) / 2;

function faixaTopo(doc: jsPDF, cor: [number, number, number]) {
  doc.setFillColor(...cor).rect(0, 0, 297, 3, "F");
}

function cartao(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc
    .setFillColor(255, 255, 255)
    .setDrawColor(226, 232, 240)
    .setLineWidth(0.3)
    .roundedRect(x, y, w, h, 1.6, 1.6, "FD");
}

function tituloDoCartao(
  doc: jsPDF,
  g: Grafico,
  x: number,
  y: number,
  w: number,
): number {
  doc
    .setFont("helvetica", "bold")
    .setFontSize(10)
    .setTextColor(...MARINHO);
  doc.text(caber(doc, g.titulo, w - 8), x + 4, y + 6);
  let yy = y + 6;
  if (g.subtitulo) {
    doc
      .setFont("helvetica", "normal")
      .setFontSize(7.5)
      .setTextColor(...APOIO);
    doc.text(caber(doc, g.subtitulo, w - 8), x + 4, y + 10);
    yy = y + 10;
  }
  return yy + 4;
}

/** Passo vertical por linha: gráficos com muitas linhas (17 vereadores) ficam um pouco mais densos para caberem numa página. */
const passoDe = (n: number) => (n > 12 ? 5.8 : 6.2);

function alturaDo(g: Grafico): number {
  switch (g.tipo) {
    case "barras": {
      const n = Math.min(
        g.itens.filter((i) => i.valor > 0).length,
        g.limite ?? 10,
      );
      return 18 + n * passoDe(n) + (g.meta ? 4 : 0);
    }
    case "rosca":
      return (
        16 +
        Math.max(
          44,
          Math.min(g.itens.filter((i) => i.valor > 0).length, 9) * 5.2 + 4,
        )
      );
    case "empilhada": {
      const n = Math.min(g.linhas.length, g.limite ?? 10);
      return 24 + n * passoDe(n);
    }
  }
}

function desenharBarras(
  doc: jsPDF,
  g: Extract<Grafico, { tipo: "barras" }>,
  x: number,
  y: number,
  w: number,
) {
  const percentual = g.formato === "percentual";
  const itens = limitar(g.itens, g.limite ?? 10, !percentual);
  // percentuais ficam numa escala de 0 a 100 (a barra não "infla" só porque o maior valor é pequeno)
  const maximo = percentual
    ? Math.max(100, ...itens.map((i) => i.valor))
    : Math.max(1, ...itens.map((i) => i.valor));
  const rotuloW = Math.min(58, w * 0.36);
  const valorW = 30;
  const trilha = w - 8 - rotuloW - valorW - 2;
  const yTopo = tituloDoCartao(doc, g, x, y, w);
  let yy = yTopo;
  itens.forEach((it) => {
    const cor = corLegivel(
      it.cor ?? (it.rotulo.startsWith("Demais") ? CINZA : PALETA_PDF[0]),
    );
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8)
      .setTextColor(...TEXTO);
    doc.text(caber(doc, it.rotulo, rotuloW - 2), x + 4, yy + 3.4);
    doc
      .setFillColor(241, 245, 249)
      .roundedRect(x + 4 + rotuloW, yy + 0.6, trilha, 3.6, 0.8, 0.8, "F");
    doc
      .setFillColor(...cor)
      .roundedRect(
        x + 4 + rotuloW,
        yy + 0.6,
        Math.max((it.valor / maximo) * trilha, 0.9),
        3.6,
        0.8,
        0.8,
        "F",
      );
    doc
      .setFont("helvetica", "bold")
      .setFontSize(8)
      .setTextColor(...MARINHO);
    doc.text(`${valorCurto(it.valor, g.formato)}`, x + w - 4, yy + 3.4, {
      align: "right",
    });
    yy += passoDe(itens.length);
  });
  if (g.meta && percentual) {
    const xm = x + 4 + rotuloW + (g.meta.valor / maximo) * trilha;
    doc
      .setDrawColor(...MARINHO)
      .setLineWidth(0.3)
      .setLineDashPattern([1, 1], 0)
      .line(xm, yTopo - 1.5, xm, yy)
      .setLineDashPattern([], 0);
    doc
      .setFont("helvetica", "bold")
      .setFontSize(6.5)
      .setTextColor(...MARINHO);
    doc.text(seguro(g.meta.rotulo), xm, yy + 2.6, { align: "center" });
  }
}

/** Anel preenchido de `a0` a `a1` (graus, 0 = topo, sentido horário) com polígono de passo fino: vetorial e sem emendas visíveis. */
function setor(
  doc: jsPDF,
  cx: number,
  cy: number,
  r1: number,
  r0: number,
  a0: number,
  a1: number,
  cor: [number, number, number],
) {
  const passo = 2;
  const n = Math.max(2, Math.ceil((a1 - a0) / passo));
  const pt = (rad: number, ang: number): [number, number] => [
    cx + rad * Math.sin((ang * Math.PI) / 180),
    cy - rad * Math.cos((ang * Math.PI) / 180),
  ];
  const pontos: [number, number][] = [];
  for (let i = 0; i <= n; i++) pontos.push(pt(r1, a0 + ((a1 - a0) * i) / n));
  for (let i = n; i >= 0; i--) pontos.push(pt(r0, a0 + ((a1 - a0) * i) / n));
  const [x0, y0] = pontos[0];
  const rel: [number, number][] = [];
  for (let i = 1; i < pontos.length; i++)
    rel.push([
      pontos[i][0] - pontos[i - 1][0],
      pontos[i][1] - pontos[i - 1][1],
    ]);
  doc
    .setFillColor(...cor)
    .setDrawColor(...cor)
    .setLineWidth(0.05);
  doc.lines(rel, x0, y0, [1, 1], "FD", true);
}

function desenharRosca(
  doc: jsPDF,
  g: Extract<Grafico, { tipo: "rosca" }>,
  x: number,
  y: number,
  w: number,
) {
  const itens = limitar(g.itens, 9);
  const total = itens.reduce((t, i) => t + i.valor, 0);
  const yTopo = tituloDoCartao(doc, g, x, y, w);
  const cx = x + 4 + 21;
  const cy = yTopo + 22;
  const R = 21;
  const r = 12.5;
  if (total <= 0) {
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8)
      .setTextColor(...APOIO);
    doc.text("Sem valores neste recorte.", x + 4, yTopo + 8);
    return;
  }
  let ang = 0;
  itens.forEach((it, k) => {
    const fim = ang + (it.valor / total) * 360;
    const cor = corLegivel(
      it.cor ??
        (it.rotulo.startsWith("Demais")
          ? CINZA
          : PALETA_PDF[k % PALETA_PDF.length]),
    );
    setor(doc, cx, cy, R, r, ang, Math.min(fim, ang + 359.9), cor);
    ang = fim;
  });
  doc
    .setFont("helvetica", "bold")
    .setFontSize(12)
    .setTextColor(...MARINHO);
  doc.text(valorCurto(total, g.formato).replace(/^R\$ /, ""), cx, cy + 0.5, {
    align: "center",
    maxWidth: 2 * r - 2,
  });
  doc
    .setFont("helvetica", "normal")
    .setFontSize(6.5)
    .setTextColor(...APOIO);
  doc.text(g.formato === "moeda" ? "reais" : "total", cx, cy + 4.6, {
    align: "center",
  });
  // legenda
  const lx = x + 4 + 2 * R + 8;
  const lw = w - (lx - x) - 4;
  itens.forEach((it, k) => {
    const yy = yTopo + 3 + k * 5.2;
    const cor = corLegivel(
      it.cor ??
        (it.rotulo.startsWith("Demais")
          ? CINZA
          : PALETA_PDF[k % PALETA_PDF.length]),
    );
    doc.setFillColor(...cor).roundedRect(lx, yy - 2.4, 3, 3, 0.6, 0.6, "F");
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8)
      .setTextColor(...TEXTO);
    doc.text(caber(doc, it.rotulo, lw - 30), lx + 5, yy);
    doc.setFont("helvetica", "bold").setTextColor(...MARINHO);
    doc.text(
      `${valorCurto(it.valor, g.formato)}  ${pct(it.valor, total)}`,
      lx + lw,
      yy,
      { align: "right" },
    );
  });
}

function desenharEmpilhada(
  doc: jsPDF,
  g: Extract<Grafico, { tipo: "empilhada" }>,
  x: number,
  y: number,
  w: number,
) {
  const linhas = g.linhas.slice(0, g.limite ?? 10);
  const rotuloW = Math.min(52, w * 0.34);
  const valorW = 26;
  const trilha = w - 8 - rotuloW - valorW - 2;
  const maximo = Math.max(
    1,
    ...linhas.map((l) => l.valores.reduce((a, b) => a + b, 0)),
  );
  let yy = tituloDoCartao(doc, g, x, y, w);
  // legenda das categorias
  let lx = x + 4;
  g.categorias.forEach((c) => {
    doc
      .setFillColor(...rgb(c.cor))
      .roundedRect(lx, yy - 2.2, 3, 3, 0.6, 0.6, "F");
    doc
      .setFont("helvetica", "normal")
      .setFontSize(7)
      .setTextColor(...TEXTO);
    doc.text(seguro(c.rotulo), lx + 4.2, yy);
    lx += 4.2 + doc.getTextWidth(seguro(c.rotulo)) + 5;
  });
  yy += 4;
  linhas.forEach((l) => {
    const soma = l.valores.reduce((a, b) => a + b, 0);
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8)
      .setTextColor(...TEXTO);
    doc.text(caber(doc, l.rotulo, rotuloW - 2), x + 4, yy + 3.4);
    doc
      .setFillColor(241, 245, 249)
      .roundedRect(x + 4 + rotuloW, yy + 0.6, trilha, 3.6, 0.8, 0.8, "F");
    let off = 0;
    l.valores.forEach((v, i) => {
      if (v <= 0) return;
      const larg = (v / maximo) * trilha;
      doc
        .setFillColor(...rgb(g.categorias[i].cor))
        .rect(x + 4 + rotuloW + off, yy + 0.6, Math.max(larg, 0.6), 3.6, "F");
      off += larg;
    });
    doc
      .setFont("helvetica", "bold")
      .setFontSize(8)
      .setTextColor(...MARINHO);
    doc.text(valorCurto(soma, g.formato), x + w - 4, yy + 3.4, {
      align: "right",
    });
    yy += passoDe(linhas.length);
  });
}

function desenharGrafico(
  doc: jsPDF,
  g: Grafico,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  cartao(doc, x, y, w, h);
  if (g.tipo === "barras") desenharBarras(doc, g, x, y, w);
  else if (g.tipo === "rosca") desenharRosca(doc, g, x, y, w);
  else desenharEmpilhada(doc, g, x, y, w);
}

function cabecalhoCorrido(c: Ctx): number {
  faixaTopo(c.doc, c.cor);
  c.doc
    .setFont("helvetica", "bold")
    .setFontSize(9)
    .setTextColor(...MARINHO);
  c.doc.text(caber(c.doc, c.r.titulo, 200), M, 11);
  c.doc
    .setFont("helvetica", "normal")
    .setFontSize(8)
    .setTextColor(...APOIO);
  c.doc.text(seguro(c.r.contagem ?? ""), 297 - M, 11, { align: "right" });
  c.doc.setDrawColor(226, 232, 240).line(M, 14, 297 - M, 14);
  return 19;
}

export function montarPdfExecutivo(r: RelatorioExecutivo): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const cor = rgb(r.cor ?? "#6B4FBB");
  const c: Ctx = { doc, y: M, cor, r };

  // ---- capa: título, filtros, indicadores
  faixaTopo(doc, cor);
  doc
    .setFont("helvetica", "bold")
    .setFontSize(18)
    .setTextColor(...MARINHO);
  doc.text(caber(doc, r.titulo, LARGURA - 60), M, 17);
  if (r.modulo) {
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8.5)
      .setTextColor(...APOIO);
    doc.text(seguro(r.modulo), 297 - M, 15, { align: "right" });
  }
  c.y = 22;
  if (r.subtitulo) {
    doc
      .setFont("helvetica", "normal")
      .setFontSize(9.5)
      .setTextColor(...APOIO);
    for (const l of doc.splitTextToSize(
      seguro(r.subtitulo),
      LARGURA,
    ) as string[]) {
      doc.text(l, M, c.y + 2);
      c.y += 4.6;
    }
  }
  c.y += 2;

  // caixa de filtros: o que o arquivo contém, dito com todas as letras (e a contagem, para conferir com a tela)
  const textoFiltros = r.filtros.length
    ? r.filtros.join("   |   ")
    : "Nenhum filtro: todas as emendas do exercício.";
  const linhasFiltro = doc.splitTextToSize(
    seguro(textoFiltros),
    LARGURA - 8,
  ) as string[];
  const hFiltro = 9 + linhasFiltro.length * 4.1 + (r.contagem ? 5 : 0);
  doc
    .setFillColor(248, 250, 252)
    .setDrawColor(226, 232, 240)
    .setLineWidth(0.3)
    .roundedRect(M, c.y, LARGURA, hFiltro, 1.6, 1.6, "FD");
  doc.setFillColor(...cor).rect(M, c.y, 1.4, hFiltro, "F");
  doc
    .setFont("helvetica", "bold")
    .setFontSize(7.5)
    .setTextColor(...APOIO);
  doc.text("FILTROS APLICADOS A ESTE RELATÓRIO", M + 5, c.y + 5);
  doc
    .setFont("helvetica", "normal")
    .setFontSize(8.5)
    .setTextColor(...TEXTO);
  linhasFiltro.forEach((l, i) => doc.text(l, M + 5, c.y + 9.6 + i * 4.1));
  if (r.contagem) {
    doc
      .setFont("helvetica", "bold")
      .setFontSize(9)
      .setTextColor(...MARINHO);
    doc.text(
      seguro(r.contagem),
      M + 5,
      c.y + 9.6 + linhasFiltro.length * 4.1 + 1.2,
    );
  }
  c.y += hFiltro + 5;

  if (r.kpis.length) {
    const gap = 4;
    const w = (LARGURA - gap * (r.kpis.length - 1)) / r.kpis.length;
    r.kpis.forEach((k, i) => {
      const x = M + i * (w + gap);
      cartao(doc, x, c.y, w, 22);
      doc.setFillColor(...cor).rect(x, c.y + 3, 1, 16, "F");
      doc
        .setFont("helvetica", "normal")
        .setFontSize(7.5)
        .setTextColor(...APOIO);
      doc.text(caber(doc, k.rotulo.toUpperCase(), w - 8), x + 4, c.y + 6.4);
      doc
        .setFont("helvetica", "bold")
        .setFontSize(15)
        .setTextColor(...MARINHO);
      doc.text(caber(doc, k.valor, w - 8), x + 4, c.y + 13.6);
      if (k.apoio) {
        doc
          .setFont("helvetica", "normal")
          .setFontSize(7)
          .setTextColor(...APOIO);
        doc.text(caber(doc, k.apoio, w - 8), x + 4, c.y + 18.4);
      }
    });
    c.y += 22 + 6;
  }

  // ---- gráficos: dois por linha (ou um de largura cheia); a página só quebra ENTRE linhas, nunca no meio de um gráfico
  const limite = ALTURA - M - 8;
  const linhasDeGraficos: Grafico[][] = [];
  for (const g of r.graficos) {
    const ultima = linhasDeGraficos[linhasDeGraficos.length - 1];
    const cheio = "cheio" in g && g.cheio;
    const ultimaCheia = ultima?.some((x) => "cheio" in x && x.cheio);
    if (!cheio && ultima && ultima.length === 1 && !ultimaCheia) ultima.push(g);
    else linhasDeGraficos.push([g]);
  }
  // Preenchimento: em cada página usa-se primeiro o que couber no espaço que sobra (um gráfico alto não deixa meia página em branco).
  let fila = linhasDeGraficos.map((par) => ({
    par,
    h: Math.max(...par.map(alturaDo)),
  }));
  while (fila.length) {
    let i = fila.findIndex((x) => c.y + x.h <= limite);
    if (i < 0) {
      doc.addPage();
      c.y = cabecalhoCorrido(c);
      i = fila.findIndex((x) => c.y + x.h <= limite);
      if (i < 0) i = 0;
    }
    const { par, h } = fila[i];
    fila = fila.filter((_, k) => k !== i);
    const cheio = par.length === 1 && "cheio" in par[0] && par[0].cheio;
    par.forEach((g, k) =>
      desenharGrafico(
        doc,
        g,
        M + k * (LARG_CARTAO + GAP),
        c.y,
        cheio ? LARGURA : LARG_CARTAO,
        h,
      ),
    );
    c.y += h + GAP;
  }

  // ---- tabelas (opcional), com a faixa e o título corrido nas páginas novas
  if (r.tabelas?.length) {
    doc.addPage();
    c.y = cabecalhoCorrido(c);
    desenharTabelas(doc, r.tabelas, c.y, () => cabecalhoCorrido(c));
  }

  desenharRodapes(doc, r.rodape);
  return new Uint8Array(doc.output("arraybuffer"));
}
