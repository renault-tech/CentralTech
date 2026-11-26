/**
 * Catálogo das colunas da lista exportada (PDF da lista e Excel), num lugar só: o menu "Escolher colunas…" (cliente) e a rota
 * `/emendas/exportar` (servidor) leem a mesma lista. A escolha da pessoa vai na URL como `cols=chave,chave` (ordem do catálogo);
 * sem `cols`, vale o padrão de cada formato (PDF: o resumo legível; Excel: tudo). **Coluna nova = uma entrada aqui + o valor dela em `valores` da rota.**
 */
export type TipoColuna = "texto" | "dinheiro" | "data";
export type ColunaLista = { chave: string; rotulo: string; grupo: string; tipo: TipoColuna; largura: number; pdf: boolean };

export const COLUNAS_LISTA: ColunaLista[] = [
  { chave: "numero", rotulo: "Emenda", grupo: "Identificação", tipo: "texto", largura: 9, pdf: true },
  { chave: "id", rotulo: "ID (nº do vereador)", grupo: "Identificação", tipo: "texto", largura: 8, pdf: false },
  { chave: "vereador", rotulo: "Vereador", grupo: "Identificação", tipo: "texto", largura: 34, pdf: true },
  { chave: "objeto", rotulo: "Objeto", grupo: "Identificação", tipo: "texto", largura: 50, pdf: true },
  { chave: "descricao", rotulo: "Descrição completa", grupo: "Identificação", tipo: "texto", largura: 60, pdf: false },
  { chave: "beneficiario", rotulo: "Destinação / beneficiário", grupo: "Identificação", tipo: "texto", largura: 32, pdf: true },
  { chave: "secretaria", rotulo: "Secretaria", grupo: "Identificação", tipo: "texto", largura: 24, pdf: true },
  { chave: "unidade", rotulo: "Unidade orçamentária", grupo: "Identificação", tipo: "texto", largura: 30, pdf: false },
  { chave: "saude", rotulo: "Saúde", grupo: "Identificação", tipo: "texto", largura: 7, pdf: false },
  { chave: "modalidade", rotulo: "Modalidade", grupo: "Identificação", tipo: "texto", largura: 19, pdf: false },
  { chave: "tipo", rotulo: "Tipo de execução", grupo: "Identificação", tipo: "texto", largura: 20, pdf: true },
  { chave: "etapa", rotulo: "Etapa", grupo: "Identificação", tipo: "texto", largura: 20, pdf: true },
  { chave: "situacao", rotulo: "Situação (impedida/cancelada)", grupo: "Identificação", tipo: "texto", largura: 12, pdf: false },
  { chave: "remanejada", rotulo: "Remanejada", grupo: "Identificação", tipo: "texto", largura: 11, pdf: false },

  { chave: "valor", rotulo: "Valor", grupo: "Financeiro", tipo: "dinheiro", largura: 15, pdf: true },
  { chave: "empenhado", rotulo: "Empenhado", grupo: "Financeiro", tipo: "dinheiro", largura: 15, pdf: true },
  { chave: "pago", rotulo: "Pago", grupo: "Financeiro", tipo: "dinheiro", largura: 15, pdf: true },
  { chave: "semEmpenhar", rotulo: "Sem empenhar (saldo)", grupo: "Financeiro", tipo: "dinheiro", largura: 16, pdf: true },
  { chave: "naoPago", rotulo: "Empenho não pago (restos)", grupo: "Financeiro", tipo: "dinheiro", largura: 16, pdf: true },
  { chave: "acima", rotulo: "Acima da emenda", grupo: "Financeiro", tipo: "dinheiro", largura: 15, pdf: true },
  { chave: "empenhos", rotulo: "Nº dos empenhos", grupo: "Financeiro", tipo: "texto", largura: 16, pdf: false },
  { chave: "dataPagamento", rotulo: "Data do último pagamento", grupo: "Financeiro", tipo: "data", largura: 13, pdf: false },
  { chave: "situacaoExec", rotulo: "Situação da execução", grupo: "Financeiro", tipo: "texto", largura: 38, pdf: true },
  { chave: "saldoRegistrado", rotulo: "Saldo registrado em", grupo: "Financeiro", tipo: "data", largura: 14, pdf: false },
  { chave: "anulacaoEm", rotulo: "Anulação solicitada em", grupo: "Financeiro", tipo: "data", largura: 14, pdf: false },
  { chave: "excessoFonte", rotulo: "Fonte do excesso", grupo: "Financeiro", tipo: "texto", largura: 30, pdf: false },

  { chave: "funcional", rotulo: "Funcional programática", grupo: "Orçamento", tipo: "texto", largura: 18, pdf: false },
  { chave: "natureza", rotulo: "Natureza da despesa", grupo: "Orçamento", tipo: "texto", largura: 11, pdf: false },
  { chave: "ficha", rotulo: "Nova dotação (ficha)", grupo: "Orçamento", tipo: "texto", largura: 40, pdf: false },

  { chave: "termo", rotulo: "Termo de parceria", grupo: "Parceria", tipo: "texto", largura: 12, pdf: false },
  { chave: "processo", rotulo: "Processo", grupo: "Parceria", tipo: "texto", largura: 24, pdf: false },
  { chave: "vigenciaInicio", rotulo: "Início da vigência", grupo: "Parceria", tipo: "data", largura: 13, pdf: false },
  { chave: "vigenciaFim", rotulo: "Fim da vigência", grupo: "Parceria", tipo: "data", largura: 13, pdf: false },
  { chave: "extrato", rotulo: "Publicação do extrato", grupo: "Parceria", tipo: "data", largura: 13, pdf: false },
  { chave: "conta", rotulo: "Conta bancária", grupo: "Parceria", tipo: "texto", largura: 34, pdf: false },
  { chave: "gestorOsc", rotulo: "Gestor na entidade", grupo: "Parceria", tipo: "texto", largura: 30, pdf: false },
  { chave: "gestorPmc", rotulo: "Gestor na Prefeitura", grupo: "Parceria", tipo: "texto", largura: 30, pdf: false },
];

export const GRUPOS_COLUNAS = [...new Set(COLUNAS_LISTA.map((c) => c.grupo))];
export const CHAVE_COLUNAS_LOCAL = "emendas-colunas-lista";

/** Colunas do arquivo: as de `cols` (chaves conhecidas, na ordem do catálogo); sem `cols` ou sem nenhuma válida, o padrão do formato. */
export function colunasDoArquivo(cols: string | null | undefined, formato: "pdf" | "xlsx"): ColunaLista[] {
  const pedidas = new Set((cols ?? "").split(",").map((c) => c.trim()).filter(Boolean));
  const escolhidas = COLUNAS_LISTA.filter((c) => pedidas.has(c.chave));
  if (escolhidas.length > 0) return escolhidas;
  return formato === "pdf" ? COLUNAS_LISTA.filter((c) => c.pdf) : COLUNAS_LISTA;
}
