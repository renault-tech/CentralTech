/**
 * Colunas dos relatórios de Imóveis que a pessoa pode esconder na exportação (mesmo desenho do Frotas:
 * o padrão é tudo; só o que foi escondido é guardado e vai na URL como `sem=A|B`).
 */

import type { IdRelatorioImoveis } from "@/lib/imoveis/relatorios";

export const COLUNAS_RELATORIO_IMOVEIS: Record<IdRelatorioImoveis, string[]> = {
  imoveis: ["Imóvel", "Endereço", "Secretaria", "Setor", "Situação", "Contrato", "Início", "Fim", "Aluguel", "Dia", "Reajuste", "Imobiliária", "Proprietário", "CPF/CNPJ"],
  contas: ["Mês", "Tipo", "Imóvel", "Secretaria", "Matrícula/UC", "Consumo", "Unidade", "Valor", "Vencimento", "Pago em"],
  pendencias: ["Gravidade", "Imóvel", "Secretaria", "Assunto", "Detalhe"],
  secretarias: ["Secretaria", "Imóveis", "Aluguel", "Água", "Luz", "Total"],
};

export const ROTULO_RELATORIO_IMOVEIS: Record<IdRelatorioImoveis, string> = {
  imoveis: "Imóveis",
  contas: "Contas de água e luz",
  pendencias: "Pendências",
  secretarias: "Gasto por secretaria",
};
