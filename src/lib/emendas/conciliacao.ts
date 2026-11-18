/**
 * Conciliação com o IPM (orientação do Controle Interno, 18/11/2026): empenhado e pago ficam SEMPRE exatos (sem arredondamento).
 * A diferença para o valor da emenda é registrada à parte:
 *  - valor executado MENOR que o da emenda → "saldo não executado" (registrar) e anulação do saldo do empenho no IPM;
 *  - valor executado MAIOR → fonte de recurso que cobriu o excesso.
 * Puro (sem rede) e testado. Os campos só aparecem quando há o que registrar.
 */

export type Conciliacao = {
  id: string;
  saldo_registrado_em: string | null;
  saldo_valor: number | string | null;
  saldo_observacao: string | null;
  anulacao_solicitada_em: string | null;
  anulacao_documento: string | null;
  anulacao_valor: number | string | null;
  excesso_valor: number | string | null;
  excesso_fonte: string | null;
  excesso_documento: string | null;
  conciliado_ipm_em: string | null;
  observacao: string | null;
};

/** Etapas em que a execução financeira terminou ou está em encerramento. */
const ETAPAS_ENCERRAMENTO = new Set(["prestacao_contas", "concluida"]);
const ETAPAS_PAGAS = new Set(["paga", "prestacao_contas", "concluida"]);

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? 0 : Number(v));

export type SituacaoConciliacao = {
  /** Valor da emenda − empenhado, quando a execução já terminou o que foi empenhado (senão 0: ainda pode ser empenhado). */
  saldoNaoExecutado: number;
  /** Empenhado − pago, quando a execução está encerrada (senão 0: ainda pode ser pago). */
  saldoEmpenho: number;
  /** Empenhado − valor da emenda (excesso). */
  excesso: number;
  saldoRegistrado: boolean;
  anulacaoSolicitada: boolean;
  fonteExcessoInformada: boolean;
  /** Há algo a registrar ou já registrado: só então a tela mostra o painel. */
  mostrar: boolean;
};

export function situacaoConciliacao(
  e: { valor: number; empenhado: number; pago: number; etapa: string },
  c: Pick<Conciliacao, "saldo_registrado_em" | "saldo_valor" | "anulacao_solicitada_em" | "excesso_fonte"> | null
): SituacaoConciliacao {
  const valor = Number(e.valor), emp = Number(e.empenhado), pago = Number(e.pago);
  const encerrada = ETAPAS_ENCERRAMENTO.has(e.etapa);
  // A emenda já está paga e o que foi empenhado foi todo pago: a diferença para o valor da emenda não vai mais ser empenhada.
  // (Empenho e pagamento parciais com a emenda ainda em andamento não contam: pode haver novos empenhos.)
  const pagoTudo = emp > 0 && pago > 0 && pago + 0.005 >= emp;
  const faltaEmpenhar = r2(valor - emp);
  // Saldo já registrado pelo gestor (mesmo antes de a emenda estar paga) continua valendo enquanto o valor bater.
  const jaRegistrado = !!c?.saldo_registrado_em && Math.abs(num(c.saldo_valor) - faltaEmpenhar) < 0.005;
  const saldoNaoExecutado = emp > 0 && faltaEmpenhar > 0.005 && (jaRegistrado || ((pagoTudo && ETAPAS_PAGAS.has(e.etapa)) || encerrada)) ? faltaEmpenhar : 0;
  const naoPago = r2(emp - pago);
  const saldoEmpenho = naoPago > 0.005 && (encerrada || !!c?.anulacao_solicitada_em) ? naoPago : 0;
  const excesso = r2(emp - valor) > 0.005 ? r2(emp - valor) : 0;
  const fonteExcessoInformada = !!c?.excesso_fonte?.trim();
  const saldoRegistrado = !!c?.saldo_registrado_em && saldoNaoExecutado > 0 && Math.abs(num(c.saldo_valor) - saldoNaoExecutado) < 0.005;
  return {
    saldoNaoExecutado,
    saldoEmpenho,
    excesso,
    saldoRegistrado,
    anulacaoSolicitada: !!c?.anulacao_solicitada_em,
    fonteExcessoInformada,
    mostrar: saldoNaoExecutado > 0 || saldoEmpenho > 0 || excesso > 0 || !!c?.saldo_registrado_em || !!c?.anulacao_solicitada_em || fonteExcessoInformada,
  };
}
