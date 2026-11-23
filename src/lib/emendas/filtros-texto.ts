/**
 * Texto dos filtros aplicados a uma lista ("Situação financeira: Empenhada, sem pagamento"), para o cabeçalho dos
 * arquivos exportados. Puro e testado: o que o arquivo diz ter filtrado é exatamente o que `filtrarEmendasLista` filtrou.
 */

import { INFO_CATEGORIA } from "@/lib/emendas/categorias";
import { TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { ASSUNTO_DA_REGRA } from "@/lib/emendas/pendencias";
import {
  CLASSES_FINANCEIRAS,
  type FiltrosLista,
} from "@/lib/emendas/painel-lista";

export type NomesFiltro = {
  vereador: (id: string) => string;
  secretaria: (id: string) => string;
  etapa: (chave: string) => string;
};

const NOME_SITUACAO: Record<string, string> = {
  normal: "Normal",
  impedida: "Impedida",
  cancelada: "Cancelada",
};

/** `buscaOriginal` é o texto como foi digitado (o de `f.q` já vem sem acento e em minúsculas). */
export function descreverFiltrosLista(
  f: FiltrosLista,
  buscaOriginal: string,
  n: NomesFiltro,
): string[] {
  const linhas: (string | false)[] = [
    !!f.t &&
      `Tipo de execução: ${TIPOS_EXECUCAO[f.t as keyof typeof TIPOS_EXECUCAO]?.nome ?? f.t}`,
    !!f.s && `Secretaria: ${n.secretaria(f.s)}`,
    !!f.v && `Vereador: ${n.vereador(f.v)}`,
    !!f.etapa && `Etapa: ${n.etapa(f.etapa)}`,
    !!f.fin &&
      `Situação financeira: ${CLASSES_FINANCEIRAS.find(([k]) => k === f.fin)?.[1] ?? "Paga, sem data de pagamento"}`,
    !!f.cat &&
      `Beneficiário: ${INFO_CATEGORIA[f.cat as keyof typeof INFO_CATEGORIA]?.nome ?? f.cat}`,
    !!f.sd && (f.sd === "1" ? "Somente Saúde" : "Fora da Saúde"),
    !!f.pe && `Pendência: ${ASSUNTO_DA_REGRA[f.pe]?.nome ?? f.pe}`,
    !!f.p && "Somente emendas com pendência aberta",
    !!f.situacao && `Situação: ${NOME_SITUACAO[f.situacao] ?? f.situacao}`,
    !!f.rem && (f.rem === "1" ? "Somente remanejadas" : "Não remanejadas"),
    f.numeros.length > 0 && `Emendas escolhidas: ${f.numeros.length}`,
    buscaOriginal.trim() !== "" && `Busca: "${buscaOriginal.trim()}"`,
  ];
  return linhas.filter((x): x is string => !!x);
}
