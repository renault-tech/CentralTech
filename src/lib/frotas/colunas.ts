/**
 * Colunas dos relatórios que a pessoa pode esconder na exportação. O padrão é tudo
 * visível; o que se guarda (no navegador) e se manda na URL (`sem=A|B`) é só o que ela
 * escondeu — coluna nova que surgir no futuro aparece sozinha.
 * Arquivo puro (usado no navegador e no servidor).
 */

import type { IdRelatorio, Tabela } from "@/lib/frotas/relatorios";

/** Nome de cada coluna, na ordem em que saem (união das tabelas do relatório). */
export const COLUNAS_RELATORIO: Record<IdRelatorio, string[]> = {
  veiculos: ["Placa", "Modelo", "Marca", "Ano", "Combustível", "Classificação", "Vínculo", "Secretaria", "Setor", "Situação", "Motivo da situação", "Patrimônio", "Valor de referência", "Fonte do valor", "Dados a revisar"],
  combustivel: ["Secretaria", "NF", "Posto", "Quinzena", "Emissão", "Valor", "Enviada à secretaria", "Retornou", "Enviada à Contabilidade", "Situação", "Dias na etapa", "Observações"],
  manutencoes: ["Secretaria", "Veículo", "Serviço", "Oficina", "Orçamento recebido", "Orçamento", "Situação", "OC (IPM)", "Valor da OC", "NF", "Emissão da NF", "Valor da NF", "Enviada à Contabilidade", "Alerta", "Observações"],
  custo: ["Veículo", "Secretaria", "Valor de referência", "Manutenção em 12 meses", "Manutenção total", "% do valor (12 meses)", "Parecer"],
  "gasto-secretaria": ["Secretaria", "Manutenção", "Combustível (NFs)", "Total"],
  contabilidade: ["Secretaria", "NF", "Posto", "Quinzena", "Valor", "Voltou assinada em", "Dias no Frotas", "Veículo", "OC (IPM)", "Valor da NF", "NF emitida em", "Dias com a NF"],
  pendencias: ["Tipo", "Secretaria", "Referência", "Veículo", "Parado desde", "Dias", "Nível"],
};

export const SEPARADOR_COLUNAS = "|";

/** Lê o parâmetro `sem` da URL (lista de colunas escondidas). */
export function lerColunasOcultas(valor: string | null | undefined): string[] {
  if (!valor) return [];
  return valor.split(SEPARADOR_COLUNAS).map((c) => c.trim()).filter(Boolean).slice(0, 60);
}

/**
 * Tira de cada tabela as colunas escondidas (e a célula correspondente de cada linha e do total),
 * refazendo os índices das colunas em reais. Tabela que ficaria sem nenhuma coluna é mantida inteira.
 */
export function aplicarColunasOcultas(tabelas: Tabela[], ocultas: string[]): Tabela[] {
  if (ocultas.length === 0) return tabelas;
  const esconder = new Set(ocultas);
  return tabelas.map((t) => {
    const manter = t.colunas.map((c, i) => (esconder.has(c) ? -1 : i)).filter((i) => i >= 0);
    if (manter.length === 0 || manter.length === t.colunas.length) return t;
    const pegar = <T,>(linha: T[]) => manter.map((i) => linha[i]);
    return {
      ...t,
      colunas: pegar(t.colunas),
      linhas: t.linhas.map(pegar),
      monetarias: t.monetarias.map((m) => manter.indexOf(m)).filter((i) => i >= 0),
      total: t.total ? pegar(t.total) : undefined,
    };
  });
}

const CHAVE = "frotas:export-colunas:v1";

const EVENTO = "frotas:export-colunas";
let memoria: string | null = null; // quando o navegador não deixa gravar, vale até recarregar

/** O que a pessoa escondeu, por relatório, como texto JSON (guardado no navegador). */
export function lerOcultasBruto(): string {
  try {
    return window.localStorage.getItem(CHAVE) ?? memoria ?? "{}";
  } catch {
    return memoria ?? "{}";
  }
}

export function lerOcultas(bruto: string): Partial<Record<IdRelatorio, string[]>> {
  try {
    const dado = JSON.parse(bruto);
    return dado && typeof dado === "object" ? dado : {};
  } catch {
    return {};
  }
}

export function guardarOcultas(todas: Partial<Record<IdRelatorio, string[]>>) {
  const texto = JSON.stringify(todas);
  memoria = texto;
  try {
    window.localStorage.setItem(CHAVE, texto);
  } catch {
    /* sem armazenamento (janela privada) */
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function assinarOcultas(aoMudar: () => void) {
  window.addEventListener(EVENTO, aoMudar);
  window.addEventListener("storage", aoMudar);
  return () => {
    window.removeEventListener(EVENTO, aoMudar);
    window.removeEventListener("storage", aoMudar);
  };
}
