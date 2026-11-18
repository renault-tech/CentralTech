/**
 * Visão consolidada dos saldos da conciliação com o IPM (todas as emendas do exercício), para a Contabilidade: quanto não foi
 * executado, quanto do empenho falta anular e quanto passou do valor da emenda (com a fonte). Puro e testado.
 */
import { situacaoConciliacao, type Conciliacao, type SituacaoConciliacao } from "@/lib/emendas/conciliacao";

export type EmendaParaSaldo = {
  id: string;
  numero: number;
  objeto: string;
  vereador_nome: string;
  secretaria_id: string;
  secretaria_nome: string;
  beneficiario_nome: string | null;
  valor: number;
  empenhado: number;
  pago: number;
  etapa: string;
  situacao: string;
};

export type LinhaSaldo = {
  id: string;
  numero: number;
  objeto: string;
  vereador: string;
  secretariaId: string;
  secretaria: string;
  beneficiario: string;
  valor: number;
  empenhado: number;
  pago: number;
  /** Valor da emenda − empenhado, já conciliado ou a conciliar (0 se não se aplica). */
  naoExecutado: number;
  naoExecutadoRegistrado: boolean;
  registradoEm: string | null;
  /** Empenhado − pago a anular no IPM (0 se não se aplica). */
  empenhoAAnular: number;
  anulacaoSolicitadaEm: string | null;
  anulacaoDocumento: string | null;
  excesso: number;
  excessoFonte: string | null;
  situacao: SituacaoConciliacao;
};

export type TipoSaldo = "registrar" | "registrado" | "anular" | "excesso";

export function linhasDeSaldo(emendas: EmendaParaSaldo[], conciliacoes: Conciliacao[]): LinhaSaldo[] {
  const mapa = new Map(conciliacoes.map((c) => [c.id, c]));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const saida: LinhaSaldo[] = [];
  for (const e of emendas) {
    if (e.situacao === "cancelada") continue;
    const c = mapa.get(e.id) ?? null;
    const s = situacaoConciliacao(e, c);
    if (!s.mostrar) continue;
    saida.push({
      id: e.id,
      numero: e.numero,
      objeto: e.objeto,
      vereador: e.vereador_nome,
      secretariaId: e.secretaria_id,
      secretaria: e.secretaria_nome,
      beneficiario: e.beneficiario_nome ?? "",
      valor: e.valor,
      empenhado: e.empenhado,
      pago: e.pago,
      naoExecutado: s.saldoNaoExecutado,
      naoExecutadoRegistrado: s.saldoRegistrado,
      registradoEm: c?.saldo_registrado_em ?? null,
      empenhoAAnular: s.saldoEmpenho,
      anulacaoSolicitadaEm: c?.anulacao_solicitada_em ?? null,
      anulacaoDocumento: c?.anulacao_documento ?? null,
      excesso: s.excesso || r2(Number(c?.excesso_valor ?? 0)),
      excessoFonte: c?.excesso_fonte ?? null,
      situacao: s,
    });
  }
  return saida.sort((a, b) => a.numero - b.numero);
}

export function temTipo(l: LinhaSaldo, t: TipoSaldo): boolean {
  if (t === "registrar") return l.naoExecutado > 0 && !l.naoExecutadoRegistrado;
  if (t === "registrado") return l.naoExecutado > 0 && l.naoExecutadoRegistrado;
  if (t === "anular") return l.empenhoAAnular > 0;
  return l.excesso > 0 || !!l.excessoFonte;
}

export type TotaisSaldo = {
  emendas: number;
  naoExecutadoRegistrado: number;
  naoExecutadoARegistrar: number;
  qtdARegistrar: number;
  empenhoAAnular: number;
  qtdAnular: number;
  anularSolicitado: number;
  excesso: number;
  excessoSemFonte: number;
  qtdExcesso: number;
};

export function totaisDeSaldo(linhas: LinhaSaldo[]): TotaisSaldo {
  const t: TotaisSaldo = { emendas: linhas.length, naoExecutadoRegistrado: 0, naoExecutadoARegistrar: 0, qtdARegistrar: 0, empenhoAAnular: 0, qtdAnular: 0, anularSolicitado: 0, excesso: 0, excessoSemFonte: 0, qtdExcesso: 0 };
  for (const l of linhas) {
    if (l.naoExecutado > 0) {
      if (l.naoExecutadoRegistrado) t.naoExecutadoRegistrado += l.naoExecutado;
      else {
        t.naoExecutadoARegistrar += l.naoExecutado;
        t.qtdARegistrar++;
      }
    }
    if (l.empenhoAAnular > 0) {
      t.empenhoAAnular += l.empenhoAAnular;
      t.qtdAnular++;
      if (l.anulacaoSolicitadaEm) t.anularSolicitado += l.empenhoAAnular;
    }
    if (l.excesso > 0) {
      t.excesso += l.excesso;
      t.qtdExcesso++;
      if (!l.excessoFonte) t.excessoSemFonte += l.excesso;
    }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  for (const k of ["naoExecutadoRegistrado", "naoExecutadoARegistrar", "empenhoAAnular", "anularSolicitado", "excesso", "excessoSemFonte"] as const) t[k] = r2(t[k]);
  return t;
}

export type LinhaSecretaria = { secretaria: string; emendas: number; naoExecutado: number; empenhoAAnular: number; excesso: number };

export function porSecretaria(linhas: LinhaSaldo[]): LinhaSecretaria[] {
  const m = new Map<string, LinhaSecretaria>();
  for (const l of linhas) {
    const r = m.get(l.secretaria) ?? { secretaria: l.secretaria, emendas: 0, naoExecutado: 0, empenhoAAnular: 0, excesso: 0 };
    r.emendas++;
    r.naoExecutado += l.naoExecutado;
    r.empenhoAAnular += l.empenhoAAnular;
    r.excesso += l.excesso;
    m.set(l.secretaria, r);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return [...m.values()].map((r) => ({ ...r, naoExecutado: r2(r.naoExecutado), empenhoAAnular: r2(r.empenhoAAnular), excesso: r2(r.excesso) })).sort((a, b) => a.secretaria.localeCompare(b.secretaria, "pt-BR"));
}
