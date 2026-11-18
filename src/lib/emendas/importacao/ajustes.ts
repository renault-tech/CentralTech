import type { LinhaImportacao } from "@/lib/emendas/importacao/planilha";

/**
 * Compara a planilha de AJUSTES (a mesma da importação, atualizada depois da análise de exequibilidade) com o que já está cadastrado
 * no exercício. Puro e testado. Regras: célula vazia na planilha nunca apaga dado; emenda que não existe ainda é "nova"; emenda
 * cadastrada que sumiu da planilha é "ausente" (o gestor decide se a cancela); nada é gravado aqui.
 */

export type CampoAjuste = "valor" | "objeto" | "ficha" | "dotacao_texto" | "beneficiario";

export const ROTULO_CAMPO: Record<CampoAjuste, string> = {
  valor: "Valor",
  objeto: "Objeto",
  ficha: "Ficha / nova dotação",
  dotacao_texto: "Dotação",
  beneficiario: "Destinação (beneficiário)",
};

export type EmendaCadastrada = {
  id: string;
  numero: number;
  situacao: string;
  valor: number;
  objeto: string;
  ficha: string | null;
  dotacao_texto: string | null;
  beneficiario_nome: string | null;
  vereador_nome?: string;
  secretaria_nome?: string;
};

export type Mudanca = { campo: CampoAjuste; rotulo: string; antes: string; depois: string };
export type EmendaAlterada = { numero: number; id: string; mudancas: Mudanca[] };
export type ResultadoComparacao = {
  novas: number[];
  alteradas: EmendaAlterada[];
  iguais: number;
  ausentes: { numero: number; id: string; objeto: string; valor: number }[];
};

const limpa = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const igual = (a: string | null | undefined, b: string | null | undefined) => limpa(a).toLocaleLowerCase("pt-BR") === limpa(b).toLocaleLowerCase("pt-BR");
const brl2 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function compararPlanilha(linhas: LinhaImportacao[], cadastradas: EmendaCadastrada[]): ResultadoComparacao {
  const porNumero = new Map(cadastradas.map((e) => [e.numero, e]));
  const naPlanilha = new Set(linhas.map((l) => l.numero));
  const novas: number[] = [];
  const alteradas: EmendaAlterada[] = [];
  let iguais = 0;

  for (const l of linhas) {
    const e = porNumero.get(l.numero);
    if (!e) {
      novas.push(l.numero);
      continue;
    }
    const mudancas: Mudanca[] = [];
    const add = (campo: CampoAjuste, antes: string, depois: string) => mudancas.push({ campo, rotulo: ROTULO_CAMPO[campo], antes, depois });
    if (Math.abs(l.valor - e.valor) > 0.005) add("valor", brl2(e.valor), brl2(l.valor));
    if (limpa(l.objeto) && !igual(l.objeto, e.objeto)) add("objeto", limpa(e.objeto), limpa(l.objeto));
    if (limpa(l.ficha) && !igual(l.ficha, e.ficha)) add("ficha", limpa(e.ficha), limpa(l.ficha));
    if (limpa(l.dotacao_texto) && !igual(l.dotacao_texto, e.dotacao_texto)) add("dotacao_texto", limpa(e.dotacao_texto), limpa(l.dotacao_texto));
    if (limpa(l.beneficiario) && !igual(l.beneficiario, e.beneficiario_nome)) add("beneficiario", limpa(e.beneficiario_nome), limpa(l.beneficiario));
    if (mudancas.length) alteradas.push({ numero: l.numero, id: e.id, mudancas });
    else iguais++;
  }

  const ausentes = cadastradas
    .filter((e) => e.situacao !== "cancelada" && !naPlanilha.has(e.numero))
    .map((e) => ({ numero: e.numero, id: e.id, objeto: e.objeto, valor: e.valor }))
    .sort((a, b) => a.numero - b.numero);
  return { novas: novas.sort((a, b) => a - b), alteradas: alteradas.sort((a, b) => a.numero - b.numero), iguais, ausentes };
}

/** Campos do `emendas.remanejar` (p_novo) a partir das mudanças escolhidas. Objeto curto demais é recusado (o banco exige 15+). */
export function novoDoRemanejamento(mudancas: Mudanca[]): { novo: Record<string, string | number>; erros: string[] } {
  const novo: Record<string, string | number> = {};
  const erros: string[] = [];
  for (const m of mudancas) {
    if (m.campo === "valor") {
      const n = Number(m.depois.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(n) && n > 0) novo.valor = n;
      else erros.push("valor inválido");
    } else if (m.campo === "objeto") {
      if (m.depois.length >= 15) novo.objeto = m.depois;
      else erros.push("objeto com menos de 15 caracteres");
    } else if (m.campo === "ficha") novo.ficha = m.depois;
    else if (m.campo === "dotacao_texto") novo.dotacao_texto = m.depois;
  }
  return { novo, erros };
}
