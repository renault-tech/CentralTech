/**
 * Situação de encerramento da emenda (um campo só, marcado pelo gestor/admin) e o consolidado do "Panorama da execução".
 * Regras num lugar só, puras e testadas:
 * - Cumprida: o objeto foi entregue integralmente. Cumprida com economia: entregue gastando menos (a parte não empenhada volta ao
 *   caixa da Prefeitura e ainda assim a emenda foi cumprida); no repasse é a "cumprida com devolução de saldo" pela entidade.
 * - Restos a pagar: só vale para empenho (Lei 4.320, art. 36); valor NÃO empenhado nunca vira restos.
 * - Comprovação: execução direta = nota fiscal com o atesto; repasse = prestação de contas. Ficam na Documentação (Drive).
 */

export const SITUACOES_ENCERRAMENTO = ["cumprida", "cumprida_economia", "nao_cumprida", "restos_a_pagar"] as const;
export type SituacaoEncerramento = (typeof SITUACOES_ENCERRAMENTO)[number];
export type TipoExecucaoEnc = "direta" | "osc" | "ente";

export type Encerramento = {
  id: string;
  situacao: SituacaoEncerramento;
  definida_em: string;
  observacao: string | null;
  devolucao_valor: number | string | null;
  devolucao_data: string | null;
  devolucao_documento: string | null;
};

export const ROTULO_SITUACAO: Record<SituacaoEncerramento, string> = {
  cumprida: "Cumprida",
  cumprida_economia: "Cumprida com economia",
  nao_cumprida: "Não cumprida",
  restos_a_pagar: "Em restos a pagar",
};

/** No repasse a economia aparece como devolução de saldo pela entidade. */
export function rotuloSituacao(s: SituacaoEncerramento, tipo: TipoExecucaoEnc): string {
  return s === "cumprida_economia" && tipo !== "direta" ? "Cumprida com devolução de saldo" : ROTULO_SITUACAO[s];
}

export const COR_SITUACAO: Record<SituacaoEncerramento, { selo: string; ponto: string }> = {
  cumprida: { selo: "bg-green-50 text-green-800", ponto: "#15803D" },
  cumprida_economia: { selo: "bg-emerald-50 text-emerald-800", ponto: "#047857" },
  nao_cumprida: { selo: "bg-red-50 text-red-800", ponto: "#B91C1C" },
  restos_a_pagar: { selo: "bg-blue-50 text-blue-800", ponto: "#1D4ED8" },
};

/** Documento que comprova o cumprimento (obrigatório para marcar cumprida). */
export function documentoComprobatorio(tipo: TipoExecucaoEnc): { tipo: "nota_fiscal" | "prestacao_contas"; rotulo: string } {
  return tipo === "direta" ? { tipo: "nota_fiscal", rotulo: "Nota fiscal com o atesto de recebimento" } : { tipo: "prestacao_contas", rotulo: "Prestação de contas aprovada" };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? 0 : Number(v));

export type DadosFinanceiros = { valor: number; empenhado: number; pago: number };

export type EntradaEncerramento = {
  situacao: SituacaoEncerramento;
  tipo: TipoExecucaoEnc;
  financeiro: DadosFinanceiros;
  temDocumento: boolean;
  devolucaoValor?: number | null;
  devolucaoData?: string | null;
};

/** Devolve a mensagem do que impede o encerramento, ou null se pode gravar. */
export function validarEncerramento(e: EntradaEncerramento): string | null {
  const { valor, empenhado, pago } = e.financeiro;
  const comprova = e.situacao === "cumprida" || e.situacao === "cumprida_economia";
  if (comprova && !e.temDocumento) return `Ligue antes o documento que comprova o cumprimento: ${documentoComprobatorio(e.tipo).rotulo.toLowerCase()}.`;
  if (e.situacao === "cumprida" && r2(valor - empenhado) > 0.005) return "A emenda ainda tem valor sem empenhar: use “Cumprida com economia” para registrar a economia.";
  if (e.situacao === "cumprida" && r2(empenhado - pago) > 0.005) return "Ainda há empenho não pago: pague ou inscreva o saldo em restos a pagar.";
  if (e.situacao === "restos_a_pagar" && r2(empenhado - pago) <= 0.005) return "Não há empenho a pagar para inscrever em restos a pagar (valor não empenhado não vira restos).";
  if (e.situacao === "cumprida_economia" && e.tipo === "direta" && r2(empenhado - pago) > 0.005) return "Ainda há empenho não pago: pague, anule o saldo ou inscreva em restos a pagar.";
  if (e.devolucaoValor || e.devolucaoData) {
    if (e.tipo === "direta") return "Devolução de saldo só existe em emenda de repasse.";
    if (!e.devolucaoValor || !(e.devolucaoValor > 0) || !e.devolucaoData) return "Informe o valor e a data da devolução.";
    if (e.devolucaoValor > pago + 0.005) return "A devolução não pode passar do valor repassado.";
  }
  return null;
}

/** Sugestão a partir dos números (só orienta o gestor; nunca grava sozinha). */
export function sugerirSituacao(f: DadosFinanceiros, etapa: string): SituacaoEncerramento | null {
  const semEmpenhar = r2(f.valor - f.empenhado);
  const aPagar = r2(f.empenhado - f.pago);
  if (f.empenhado <= 0) return null;
  if (aPagar > 0.005) return etapa === "prestacao_contas" || etapa === "concluida" ? "restos_a_pagar" : null;
  if (semEmpenhar > 0.005) return etapa === "paga" || etapa === "prestacao_contas" || etapa === "concluida" ? "cumprida_economia" : null;
  return etapa === "paga" || etapa === "prestacao_contas" || etapa === "concluida" ? "cumprida" : null;
}

// ---------------------------------------------------------------- Panorama

export type EmendaPanorama = {
  id: string;
  numero: number;
  objeto: string;
  vereador_nome: string;
  secretaria_id: string;
  secretaria_nome: string;
  beneficiario_nome: string | null;
  tipo_execucao: TipoExecucaoEnc;
  valor: number;
  empenhado: number;
  pago: number;
  etapa: string;
  situacao: string;
};

export type LinhaPanorama = EmendaPanorama & {
  semEmpenhar: number;
  aPagar: number;
  encerramento: SituacaoEncerramento | null;
  encerradaEm: string | null;
  devolucao: number;
  economia: number;
  restos: number;
  anular: number;
  excesso: number;
  semFonte: boolean;
  /** Estava em restos a pagar e o empenho foi todo pago: a emenda passa sozinha a "cumprida" (só na leitura; nada é regravado). */
  restosQuitados: boolean;
};

/** Chave de cada cartão do Panorama (cada cartão é um filtro da lista). */
export const CARTOES = [
  "todas",
  "empenhadas",
  "pagas",
  "a_pagar",
  "sem_empenho_andamento",
  "sem_empenho_encerrada",
  "cumprida",
  "cumprida_economia",
  "nao_cumprida",
  "restos_a_pagar",
  "sem_situacao",
  "anular",
  "devolucao",
  "excesso",
] as const;
export type Cartao = (typeof CARTOES)[number];

export function linhasPanorama(emendas: EmendaPanorama[], encerramentos: Encerramento[], conciliacoes: { id: string; anulacao_solicitada_em: string | null; excesso_fonte: string | null }[]): LinhaPanorama[] {
  const enc = new Map(encerramentos.map((x) => [x.id, x]));
  const con = new Map(conciliacoes.map((x) => [x.id, x]));
  return emendas
    .filter((e) => e.situacao !== "cancelada")
    .map((e) => {
      const x = enc.get(e.id) ?? null;
      const c = con.get(e.id) ?? null;
      const semEmpenhar = Math.max(0, r2(e.valor - e.empenhado));
      const aPagar = Math.max(0, r2(e.empenhado - e.pago));
      const restosQuitados = x?.situacao === "restos_a_pagar" && e.empenhado > 0.005 && aPagar <= 0.005;
      const situacaoEfetiva: SituacaoEncerramento | null = restosQuitados ? (semEmpenhar > 0.005 ? "cumprida_economia" : "cumprida") : (x?.situacao ?? null);
      const encerrada = situacaoEfetiva ? situacaoEfetiva !== "restos_a_pagar" : false;
      return {
        ...e,
        semEmpenhar,
        aPagar,
        encerramento: situacaoEfetiva,
        restosQuitados,
        encerradaEm: x?.definida_em ?? null,
        devolucao: r2(num(x?.devolucao_valor)),
        economia: situacaoEfetiva === "cumprida_economia" || situacaoEfetiva === "cumprida" ? semEmpenhar : 0,
        restos: situacaoEfetiva === "restos_a_pagar" ? aPagar : 0,
        // Saldo do empenho a anular só faz sentido quando a emenda foi encerrada e ainda sobra empenho sem pagar.
        anular: encerrada && aPagar > 0.005 ? aPagar : 0,
        excesso: Math.max(0, r2(e.empenhado - e.valor)),
        semFonte: r2(e.empenhado - e.valor) > 0.005 && !c?.excesso_fonte?.trim(),
      };
    })
    .sort((a, b) => a.numero - b.numero);
}

export function pertenceAoCartao(l: LinhaPanorama, c: Cartao): boolean {
  switch (c) {
    case "todas": return true;
    case "empenhadas": return l.empenhado > 0.005;
    case "pagas": return l.pago > 0.005;
    case "a_pagar": return l.aPagar > 0.005;
    case "sem_empenho_andamento": return l.semEmpenhar > 0.005 && !l.encerramento;
    case "sem_empenho_encerrada": return l.semEmpenhar > 0.005 && !!l.encerramento && l.encerramento !== "restos_a_pagar";
    case "cumprida": return l.encerramento === "cumprida";
    case "cumprida_economia": return l.encerramento === "cumprida_economia";
    case "nao_cumprida": return l.encerramento === "nao_cumprida";
    case "restos_a_pagar": return l.encerramento === "restos_a_pagar";
    case "sem_situacao": return !l.encerramento;
    case "anular": return l.anular > 0.005;
    case "devolucao": return l.devolucao > 0.005;
    case "excesso": return l.excesso > 0.005;
  }
}

export type TotalCartao = { quantidade: number; valor: number };

/** Valor mostrado em cada cartão (o que a chave representa em dinheiro). */
export function valorDoCartao(l: LinhaPanorama, c: Cartao): number {
  switch (c) {
    case "todas": return l.valor;
    case "empenhadas": return l.empenhado;
    case "pagas": return l.pago;
    case "a_pagar": return l.aPagar;
    case "sem_empenho_andamento":
    case "sem_empenho_encerrada": return l.semEmpenhar;
    case "cumprida":
    case "cumprida_economia":
    case "nao_cumprida":
    case "sem_situacao": return l.valor;
    case "restos_a_pagar": return l.restos;
    case "anular": return l.anular;
    case "devolucao": return l.devolucao;
    case "excesso": return l.excesso;
  }
}

export function totaisPorCartao(linhas: LinhaPanorama[]): Record<Cartao, TotalCartao> {
  const out = {} as Record<Cartao, TotalCartao>;
  for (const c of CARTOES) {
    const sel = linhas.filter((l) => pertenceAoCartao(l, c));
    out[c] = { quantidade: sel.length, valor: r2(sel.reduce((s, l) => s + valorDoCartao(l, c), 0)) };
  }
  return out;
}

export type LinhaAgrupada = { chave: string; nome: string; emendas: number; valor: number; empenhado: number; pago: number; semEmpenhar: number; aPagar: number; cumpridas: number; semSituacao: number; restos: number; devolucao: number };

export function agrupar(linhas: LinhaPanorama[], por: "secretaria" | "vereador" | "tipo"): LinhaAgrupada[] {
  const m = new Map<string, LinhaAgrupada>();
  for (const l of linhas) {
    const nome = por === "secretaria" ? l.secretaria_nome : por === "vereador" ? l.vereador_nome : l.tipo_execucao === "direta" ? "Execução direta" : l.tipo_execucao === "osc" ? "Repasse a OSC" : "Repasse a ente";
    const g = m.get(nome) ?? { chave: nome, nome, emendas: 0, valor: 0, empenhado: 0, pago: 0, semEmpenhar: 0, aPagar: 0, cumpridas: 0, semSituacao: 0, restos: 0, devolucao: 0 };
    g.emendas++;
    g.valor += l.valor;
    g.empenhado += l.empenhado;
    g.pago += l.pago;
    g.semEmpenhar += l.semEmpenhar;
    g.aPagar += l.aPagar;
    g.restos += l.restos;
    g.devolucao += l.devolucao;
    if (l.encerramento === "cumprida" || l.encerramento === "cumprida_economia") g.cumpridas++;
    if (!l.encerramento) g.semSituacao++;
    m.set(nome, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, valor: r2(g.valor), empenhado: r2(g.empenhado), pago: r2(g.pago), semEmpenhar: r2(g.semEmpenhar), aPagar: r2(g.aPagar), restos: r2(g.restos), devolucao: r2(g.devolucao) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
