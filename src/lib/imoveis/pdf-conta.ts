/**
 * Leitura (heurística) do TEXTO de faturas de água e luz em PDF. Nada aqui grava: o servidor propõe os campos, a pessoa
 * confere e confirma. Calibrado com textos de exemplo no formato de faturas da concessionária de energia e da autarquia de
 * água; **ajustar com as primeiras faturas reais** (cada concessionária muda o layout). Função pura, testada.
 */

import type { TipoUnidade, Unidade } from "@/types/imoveis";

export type ContaLida = {
  unidadeId: string | null;
  tipo: TipoUnidade | null;
  /** AAAA-MM-01 */
  referencia: string | null;
  consumo: number | null;
  valor: number | null;
  vencimento: string | null;
  /** Quantos dos campos principais (unidade, mês, valor, vencimento) foram achados, de 0 a 4. */
  encontrados: number;
  avisos: string[];
};

const MESES: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const NUM = "(\\d{1,3}(?:\\.\\d{3})*,\\d{2})";

const numero = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
const soDigitos = (s: string) => s.replace(/\D/g, "").replace(/^0+/, "");

function dataBr(s: string): string | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mes, a] = m;
  if (Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${a}-${mes}-${d}`;
}

export function detectarTipo(texto: string): TipoUnidade | null {
  const t = texto.toLowerCase();
  const luz = /energisa|cemig|kwh|energia el[eé]trica|unidade consumidora/.test(t);
  const agua = /saae|[áa]gua|esgoto|m[³3]|hidr[oô]metro|abastecimento/.test(t);
  if (luz && !agua) return "luz";
  if (agua && !luz) return "agua";
  if (luz && agua) return /kwh/.test(t) ? "luz" : "agua";
  return null;
}

/** Acha a unidade cujo número (matrícula ou UC) aparece no texto, sem depender de pontuação nem de zeros à esquerda. */
export function acharUnidade(texto: string, tipo: TipoUnidade | null, unidades: Pick<Unidade, "id" | "tipo" | "numero">[]): { id: string | null; ambiguo: boolean } {
  const tokens = (texto.match(/\d[\d.\-/ ]{3,}\d/g) ?? []).map(soDigitos).filter((t) => t.length >= 4);
  const casam = unidades.filter((u) => {
    if (tipo && u.tipo !== tipo) return false;
    const n = soDigitos(u.numero);
    return n.length >= 4 && tokens.some((t) => t === n || t.includes(n));
  });
  if (casam.length === 1) return { id: casam[0].id, ambiguo: false };
  return { id: null, ambiguo: casam.length > 1 };
}

export function lerContaDoTexto(texto: string, unidades: Pick<Unidade, "id" | "tipo" | "numero">[]): ContaLida {
  const avisos: string[] = [];
  const t = texto.replace(/\s+/g, " ");
  const tipo = detectarTipo(t);
  if (!tipo) avisos.push("Não deu para saber se é conta de água ou de luz.");

  const un = acharUnidade(t, tipo, unidades);
  if (!un.id) avisos.push(un.ambiguo ? "Mais de uma unidade casa com os números da fatura: escolha a certa." : "Não achei a matrícula ou UC desta fatura entre as unidades cadastradas.");

  // Vencimento: a primeira data depois da palavra "vencimento".
  let vencimento: string | null = null;
  const v = t.match(/vencimento[^\d]{0,30}(\d{2}\/\d{2}\/\d{4})/i);
  if (v) vencimento = dataBr(v[1]);
  if (!vencimento) avisos.push("Vencimento não encontrado.");

  // Valor: depois de "total a pagar", "valor a pagar" ou "valor total"; senão o maior valor em reais do documento.
  let valor: number | null = null;
  const rotulos = t.match(new RegExp(`(?:total a pagar|valor a pagar|valor total|total da fatura|total)[^\\d]{0,25}${NUM}`, "i"));
  if (rotulos) valor = numero(rotulos[1]);
  else {
    const todos = [...t.matchAll(new RegExp(`R\\$\\s*${NUM}`, "gi"))].map((m) => numero(m[1]));
    if (todos.length) {
      valor = Math.max(...todos);
      avisos.push("Valor tirado do maior valor em reais da fatura: confira.");
    }
  }
  if (valor === null) avisos.push("Valor não encontrado.");

  // Referência: "referência 10/2026", "mês de referência: OUT/2026" ou "10/2026" perto da palavra.
  let referencia: string | null = null;
  const r1 = t.match(/refer[eê]ncia[^\d a-zA-Z]{0,10}\s*(\d{2})\/(\d{4})/i);
  const r2 = t.match(/refer[eê]ncia[^\d a-zA-Z]{0,10}\s*([A-Za-z]{3})[a-z]*\/(\d{4})/i);
  if (r1 && Number(r1[1]) >= 1 && Number(r1[1]) <= 12) referencia = `${r1[2]}-${r1[1]}-01`;
  else if (r2 && MESES[r2[1].toLowerCase()]) referencia = `${r2[2]}-${String(MESES[r2[1].toLowerCase()]).padStart(2, "0")}-01`;
  if (!referencia) avisos.push("Mês de referência não encontrado.");

  // Consumo.
  let consumo: number | null = null;
  if (tipo === "luz") {
    const c = t.match(/consumo[^\d]{0,40}(\d[\d.]*)\s*kwh/i) ?? t.match(/(\d[\d.]*)\s*kwh/i);
    if (c) consumo = Number(c[1].replace(/\./g, ""));
  } else if (tipo === "agua") {
    const c = t.match(/consumo[^\d]{0,40}(\d[\d.]*)\s*m[³3]/i) ?? t.match(/(\d[\d.]*)\s*m[³3]/i);
    if (c) consumo = Number(c[1].replace(/\./g, ""));
  }
  if (consumo === null) avisos.push("Consumo não encontrado (pode lançar só o valor).");

  const encontrados = [un.id, referencia, valor, vencimento].filter((x) => x !== null).length;
  return { unidadeId: un.id, tipo, referencia, consumo, valor, vencimento, encontrados, avisos };
}
