/**
 * Leitura (heurística) do TEXTO de documentos do imóvel em PDF: contrato de locação, comprovante de troca de titularidade
 * (água/luz) e laudo de vistoria. Nada aqui grava e o PDF nunca é guardado: o servidor propõe os campos, a pessoa confere e
 * aplica. Só propõe o que achou (nunca inventa); o que não achou vira aviso. Calibrado com textos de exemplo: **ajustar com os
 * primeiros documentos reais**. Função pura, testada.
 */

import { acharUnidade, detectarTipo } from "@/lib/imoveis/pdf-conta";
import { somarMeses } from "@/lib/imoveis/regras";
import type { IndiceReajuste, TipoUnidade, Unidade } from "@/types/imoveis";

export type TipoDocumentoLido = "contrato" | "titularidade" | "vistoria";

export type DadosContrato = {
  contratoNumero?: string;
  vigenciaInicio?: string;
  vigenciaFim?: string;
  valorAluguel?: number;
  diaVencimento?: number;
  indiceReajuste?: IndiceReajuste;
  proprietarioNome?: string;
  proprietarioDocumento?: string;
};
export type DadosTitularidade = { tipo?: TipoUnidade; unidadeId?: string; dataTroca?: string };
export type DadosVistoria = { dataVistoria?: string; vistoriador?: string; resumo?: string };

export type DocumentoLido =
  | { tipo: "contrato"; dados: DadosContrato; avisos: string[] }
  | { tipo: "titularidade"; dados: DadosTitularidade; avisos: string[] }
  | { tipo: "vistoria"; dados: DadosVistoria; avisos: string[] };

const NUM = "(\\d{1,3}(?:\\.\\d{3})*,\\d{2})";
const DATA = "(\\d{2}\\/\\d{2}\\/\\d{4})";
const MESES_EXTENSO: Record<string, number> = { janeiro: 1, fevereiro: 2, "março": 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

const numero = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
const limpar = (t: string) => t.replace(/\s+/g, " ").trim();

/** "dd/mm/aaaa" → "aaaa-mm-dd" (ou null se não existe no calendário). */
function dataBr(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[1]) ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** "1º de março de 2026" ou "01 de março de 2026" → "2026-03-01". */
function dataExtenso(s: string): string | null {
  const m = s.match(/(\d{1,2})\s*[ºo°]?\s+de\s+([a-zçã]+)\s+de\s+(\d{4})/i);
  if (!m) return null;
  const mes = MESES_EXTENSO[m[2].toLowerCase()];
  return mes ? `${m[3]}-${String(mes).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

function primeiraData(s: string): string | null {
  const br = s.match(new RegExp(DATA));
  if (br) return dataBr(br[1]);
  return dataExtenso(s);
}

function somaMesesData(iso: string, meses: number): string {
  // Fim = véspera do mesmo dia, `meses` depois (36 meses de 01/03/2026 → 28/02/2029).
  const ref = somarMeses(`${iso.slice(0, 7)}-01`, meses);
  const d = new Date(Date.UTC(Number(ref.slice(0, 4)), Number(ref.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function lerContrato(texto: string): DocumentoLido {
  const t = limpar(texto);
  const avisos: string[] = [];
  const dados: DadosContrato = {};

  const num = t.match(/contrato\s*(?:de\s+loca[cç][aã]o\s*)?(?:administrativo\s*)?n[ºo°.]*\s*:?\s*(\d{1,5}\s*\/\s*\d{4})/i);
  if (num) dados.contratoNumero = num[1].replace(/\s/g, "");
  else avisos.push("Número do contrato não encontrado.");

  const val =
    t.match(new RegExp(`(?:aluguel|valor locat[ií]cio|loca[cç][aã]o)[^R]{0,60}R\\$\\s*${NUM}`, "i")) ??
    t.match(new RegExp(`valor mensal[^R]{0,40}R\\$\\s*${NUM}`, "i"));
  if (val) dados.valorAluguel = numero(val[1]);
  else avisos.push("Valor do aluguel não encontrado.");

  const ini = t.match(new RegExp(`(?:a partir de|in[ií]cio(?: da vig[eê]ncia)?(?: em)?|iniciando(?: em)?)[^\\d]{0,20}${DATA}`, "i"));
  const iniExt = t.match(/(?:a partir de|in[ií]cio(?: da vig[eê]ncia)?(?: em)?|iniciando(?: em)?)[^\d]{0,20}(\d{1,2}\s*[ºo°]?\s+de\s+[a-zçã]+\s+de\s+\d{4})/i);
  const inicio = ini ? dataBr(ini[1]) : iniExt ? dataExtenso(iniExt[1]) : null;
  if (inicio) dados.vigenciaInicio = inicio;

  const fim = t.match(new RegExp(`(?:t[eé]rmino|findando(?: em)?|vigorar[áa] at[ée]|at[ée] o dia|encerrando(?: em)?)[^\\d]{0,20}${DATA}`, "i"));
  const meses = t.match(/prazo[^.]{0,50}?(\d{1,3})\s*(?:\([^)]*\)\s*)?meses/i) ?? t.match(/vig[eê]ncia[^.]{0,50}?(\d{1,3})\s*(?:\([^)]*\)\s*)?meses/i);
  if (fim && dataBr(fim[1])) dados.vigenciaFim = dataBr(fim[1]) as string;
  else if (inicio && meses) {
    dados.vigenciaFim = somaMesesData(inicio, Number(meses[1]));
    avisos.push(`Fim da vigência calculado: ${meses[1]} meses a partir do início. Confira.`);
  }
  if (!dados.vigenciaInicio || !dados.vigenciaFim) avisos.push("Vigência (início e fim) incompleta.");

  const dia = t.match(/(?:vencimento|pagamento|pag(?:o|ar[áa]?|[áa]vel))[^.]{0,80}?(?:at[ée] o|todo|no)\s*(?:dia\s*)?(\d{1,2})[º°]?(?![\d/])/i);
  if (dia && Number(dia[1]) >= 1 && Number(dia[1]) <= 31) dados.diaVencimento = Number(dia[1]);

  const ind = t.match(/\b(IPCA|IGP-?M|INPC)\b/i);
  if (ind) dados.indiceReajuste = ind[1].toUpperCase().replace(/^IGPM$/, "IGP-M") as IndiceReajuste;

  const loc = t.match(/LOCADOR[A]?\s*:?\s*([A-ZÀ-Ú][A-Za-zÀ-ú.' ]{3,80}?)(?:,|\s+inscrit|\s+portador|\s+CPF|\s+CNPJ)/);
  if (loc) dados.proprietarioNome = limpar(loc[1]);
  const doc = t.slice(loc ? (loc.index ?? 0) : 0).match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
  if (doc) dados.proprietarioDocumento = doc[1];
  if (!dados.proprietarioNome) avisos.push("Locador (proprietário) não encontrado.");

  return { tipo: "contrato", dados, avisos };
}

export function lerTitularidade(texto: string, unidades: Pick<Unidade, "id" | "tipo" | "numero">[]): DocumentoLido {
  const t = limpar(texto);
  const avisos: string[] = [];
  const dados: DadosTitularidade = {};
  const tipo = detectarTipo(t);
  if (tipo) dados.tipo = tipo;
  else avisos.push("Não deu para saber se é troca de titularidade da água ou da luz: escolha.");
  const un = acharUnidade(t, tipo, unidades);
  if (un.id) dados.unidadeId = un.id;
  else avisos.push(un.ambiguo ? "Mais de uma unidade casa com o documento: escolha a certa." : "Não achei a matrícula ou UC entre as unidades do imóvel.");
  const rotulada = t.match(new RegExp(`(?:data (?:da )?(?:altera[cç][aã]o|troca|efetiva[cç][aã]o|transfer[eê]ncia)|efetivad[ao] em|conclu[ií]d[ao] em|titularidade[^\\d]{0,40})[^\\d]{0,15}${DATA}`, "i"));
  const data = rotulada ? dataBr(rotulada[1]) : primeiraData(t);
  if (data) {
    dados.dataTroca = data;
    if (!rotulada) avisos.push("Data tirada da primeira data do documento: confira.");
  } else avisos.push("Data da troca não encontrada.");
  return { tipo: "titularidade", dados, avisos };
}

export function lerVistoria(texto: string): DocumentoLido {
  const t = limpar(texto);
  const avisos: string[] = [];
  const dados: DadosVistoria = {};
  const rot = t.match(new RegExp(`(?:data da vistoria|vistoria realizada em|vistoriado em|data)[^\\d]{0,15}${DATA}`, "i"));
  const data = rot ? dataBr(rot[1]) : primeiraData(t);
  if (data) dados.dataVistoria = data;
  else avisos.push("Data da vistoria não encontrada.");
  const vis = t.match(/(?:[Vv]istoriador|[Vv]istoriado por|[Rr]espons[áa]vel(?: [Tt][eé]cnico)?|[Ee]ngenheiro(?:\(a\))?|[Tt][eé]cnico)\s*:?\s*([A-ZÀ-Ú][A-Za-zÀ-ú.' ]{3,60}?)(?=\s{0,2}(?:CREA|CAU|CPF|,|-|\.|$|Data|Local))/);
  if (vis) dados.vistoriador = limpar(vis[1]);
  const res = t.match(/(?:conclus[aã]o|parecer(?: final)?|observa[cç][õo]es|resultado)\s*:?\s*(.{20,400})/i);
  if (res) dados.resumo = limpar(res[1]).slice(0, 400);
  else avisos.push("Não achei o resultado ou conclusão da vistoria.");
  return { tipo: "vistoria", dados, avisos };
}

export function lerDocumento(tipo: TipoDocumentoLido, texto: string, unidades: Pick<Unidade, "id" | "tipo" | "numero">[]): DocumentoLido {
  if (tipo === "contrato") return lerContrato(texto);
  if (tipo === "titularidade") return lerTitularidade(texto, unidades);
  return lerVistoria(texto);
}
