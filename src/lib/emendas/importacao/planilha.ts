/**
 * Planilha de acompanhamento → linhas prontas para `emendas.importar`.
 *
 * Formato esperado: o mesmo da planilha usada pela gestão em 2026 — uma
 * aba por versão (a original e a "Após" os remanejamentos), colunas
 * Emenda · ID · Vereador ("02 - Nome") · Descrição · Valor · Destinação ·
 * Dotação a acrescentar · Nova dotação · Secretaria ("02.09 - Fundo de
 * Saúde") · Saúde (Sim/Não) · Impedimento · Justificativa · STATUS.
 * A aba mais recente é a "situação atual"; a diferença em relação à aba
 * original vira o histórico de remanejamento. O STATUS pode estar só na
 * aba original (era assim em 2026) — é lido de qualquer aba que o tenha.
 */

import { lerDotacao, lerStatus, resumirObjeto, type StatusLido } from "@/lib/emendas/importacao/status";

export type Registro = Record<string, unknown>;

export type LinhaImportacao = {
  numero: number;
  numero_vereador: number;
  vereador_numero: number;
  vereador_nome: string;
  objeto: string;
  descricao: string;
  valor: number;
  beneficiario: string;
  unidade_codigo: string;
  unidade_nome: string;
  saude: boolean;
  funcional: string | null;
  natureza: string | null;
  dotacao_texto: string | null;
  ficha: string | null;
  status_original: string | null;
  etapa: StatusLido["etapa"];
  empenho: string | null;
  data_pagamento: string | null;
  pendencias: string[];
  remanejamento: { antes: Record<string, string>; depois: Record<string, string> } | null;
};

export type ResultadoLeitura = { linhas: LinhaImportacao[]; erros: string[] };

const COLUNAS = {
  numero: ["emenda"],
  numeroVereador: ["id"],
  vereador: ["vereador"],
  descricao: ["descricao", "descrição"],
  valor: ["valor"],
  destinacao: ["destinacao", "destinação"],
  dotacao: ["dotacao a acrescentar", "dotação a acrescentar"],
  ficha: ["nova dotacao", "nova dotação"],
  secretaria: ["secretaria"],
  saude: ["saude", "saúde"],
  status: ["status"],
} as const;

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function campo(r: Registro, chave: keyof typeof COLUNAS): unknown {
  for (const nome of COLUNAS[chave]) {
    for (const k of Object.keys(r)) {
      if (normalizar(k) === normalizar(nome)) return r[k];
    }
  }
  return undefined;
}

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((p) => p.text).join("");
  }
  if (typeof v === "object" && v !== null && "result" in v) return texto((v as { result: unknown }).result);
  return String(v).replace(/\s+/g, " ").trim();
}

function numero(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "result" in v) return numero((v as { result: unknown }).result);
  const t = texto(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(t);
  return t && Number.isFinite(n) ? n : null;
}

/** Destinações escritas em CAIXA ALTA na planilha ("PROJETO SUPERAÇÃO")
 * viram título, para não duplicar o mesmo beneficiário. */
function nomeBeneficiario(s: string): string {
  if (s.length > 4 && s === s.toUpperCase()) {
    return s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
  }
  return s;
}

/** Converte as linhas brutas (uma por emenda) nas linhas de importação.
 * `original` = aba anterior aos remanejamentos (opcional). */
export function interpretarLinhas(atual: Registro[], original: Registro[] | null): ResultadoLeitura {
  const erros: string[] = [];
  const linhas: LinhaImportacao[] = [];
  const statusPorNumero = new Map<number, string>();
  const originalPorNumero = new Map<number, Registro>();

  for (const r of [...(original ?? []), ...atual]) {
    const n = numero(campo(r, "numero"));
    const st = texto(campo(r, "status"));
    if (n && st) statusPorNumero.set(n, st);
  }
  for (const r of original ?? []) {
    const n = numero(campo(r, "numero"));
    if (n) originalPorNumero.set(n, r);
  }

  for (const r of atual) {
    const n = numero(campo(r, "numero"));
    if (!n || !Number.isInteger(n)) continue; // linhas de total/rodapé
    const vereador = texto(campo(r, "vereador")).match(/^(\d+)\s*-\s*(.+)$/);
    const secretaria = texto(campo(r, "secretaria")).match(/^(\d{2}\.\d{2})\s*-\s*(.+)$/);
    const valor = numero(campo(r, "valor"));
    const descricao = texto(campo(r, "descricao"));
    const numeroVereador = numero(campo(r, "numeroVereador"));

    const problemas: string[] = [];
    if (!vereador) problemas.push(`vereador "${texto(campo(r, "vereador"))}" fora do formato "02 - Nome"`);
    if (!secretaria) problemas.push(`secretaria "${texto(campo(r, "secretaria"))}" fora do formato "02.09 - Nome"`);
    if (!valor || valor <= 0) problemas.push("valor ausente ou zero");
    if (!descricao) problemas.push("descrição vazia");
    if (!numeroVereador) problemas.push("ID (nº da emenda do vereador) ausente");
    if (problemas.length) {
      erros.push(`Emenda ${n}: ${problemas.join("; ")}`);
      continue;
    }

    const dotacaoTexto = texto(campo(r, "dotacao")) || null;
    const { funcional, natureza } = lerDotacao(dotacaoTexto);
    const statusTexto = statusPorNumero.get(n) ?? null;
    const st = lerStatus(statusTexto);

    let remanejamento: LinhaImportacao["remanejamento"] = null;
    const o = originalPorNumero.get(n);
    if (o) {
      const comparar: [string, keyof typeof COLUNAS, (v: unknown) => string][] = [
        ["beneficiario", "destinacao", (v) => nomeBeneficiario(texto(v))],
        ["unidade", "secretaria", texto],
        ["ficha", "ficha", texto],
        ["dotacao_texto", "dotacao", texto],
        ["valor", "valor", (v) => String(numero(v) ?? "")],
      ];
      const antes: Record<string, string> = {};
      const depois: Record<string, string> = {};
      for (const [chave, col, ler] of comparar) {
        const a = ler(campo(o, col));
        const d = ler(campo(r, col));
        if (a !== d && a.toLowerCase() !== d.toLowerCase()) {
          antes[chave] = a;
          depois[chave] = d;
        }
      }
      if (Object.keys(antes).length) remanejamento = { antes, depois };
    }

    linhas.push({
      numero: n,
      numero_vereador: numeroVereador as number,
      vereador_numero: Number(vereador![1]),
      vereador_nome: vereador![2].trim(),
      objeto: resumirObjeto(descricao),
      descricao,
      valor: Math.round((valor as number) * 100) / 100,
      beneficiario: nomeBeneficiario(texto(campo(r, "destinacao"))),
      unidade_codigo: secretaria![1],
      unidade_nome: secretaria![2].trim(),
      saude: normalizar(texto(campo(r, "saude"))) === "sim",
      funcional,
      natureza,
      dotacao_texto: dotacaoTexto ? dotacaoTexto.slice(0, 1000) : null,
      ficha: texto(campo(r, "ficha")).slice(0, 300) || null,
      status_original: statusTexto,
      etapa: st.etapa,
      empenho: st.empenho,
      data_pagamento: st.dataPagamento,
      pendencias: st.pendencias,
      remanejamento,
    });
  }

  linhas.sort((a, b) => a.numero - b.numero);
  return { linhas, erros };
}

/** Lê o .xlsx (ExcelJS) e devolve as linhas interpretadas. A aba "atual" é
 * a última (ou a que tiver "após" no nome); a "original", a primeira — só
 * quando há mais de uma. */
export async function lerPlanilha(arquivo: ArrayBuffer): Promise<ResultadoLeitura & { abas: string[] }> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arquivo);

  const abas = wb.worksheets.map((w) => w.name);
  const registros = wb.worksheets.map((ws) => {
    const cab: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => {
      cab[col] = texto(c.value);
    });
    const out: Registro[] = [];
    ws.eachRow((row, i) => {
      if (i === 1) return;
      const r: Registro = {};
      row.eachCell({ includeEmpty: false }, (c, col) => {
        if (cab[col]) r[cab[col]] = c.value;
      });
      if (Object.keys(r).length) out.push(r);
    });
    return out;
  });

  if (registros.length === 0) return { linhas: [], erros: ["Planilha vazia."], abas };
  const idxApos = abas.findIndex((n) => /ap[oó]s/i.test(n));
  const idxAtual = idxApos >= 0 ? idxApos : registros.length - 1;
  const original = registros.length > 1 ? registros[idxAtual === 0 ? 1 : 0] : null;
  return { ...interpretarLinhas(registros[idxAtual], original), abas };
}
