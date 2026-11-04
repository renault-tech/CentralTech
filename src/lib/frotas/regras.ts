/**
 * Regras do módulo Frotas — funções puras (sem servidor), usadas pelas telas
 * e testadas em `regras.test.ts`. As regras de integridade (ordem das datas,
 * cadeia da manutenção, unicidade de OC e de NF) também valem no banco
 * (supabase/migrations/20261104000000_frotas_schema.sql); aqui elas só
 * antecipam o aviso e calculam painéis e situações.
 *
 * Datas são sempre strings AAAA-MM-DD (data-calendário de Cataguases).
 */

import type { Manutencao, NotaCombustivel, ParametrosFrotas } from "@/types/frotas";

export const COR_MODULO = "#5C7A1F";
export const COR_TEXTO_MODULO = "#3F5A12";

export type ParametrosAlerta = Pick<ParametrosFrotas, "dias_atencao" | "dias_critico" | "pct_atencao" | "pct_critico">;

export const PARAMETROS_PADRAO: ParametrosFrotas = {
  id: 1,
  dias_atencao: 10,
  dias_critico: 15,
  pct_atencao: 50,
  pct_critico: 100,
  reincidencia_qtd: 3,
  reincidencia_meses: 6,
  orcamento_acima_pct: 15,
  combustivel_acima_pct: 20,
  inativo_dias: 90,
  atualizado_em: "",
};

// ------------------------------------------------------------- datas e números

const MS_DIA = 86_400_000;

function utc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/** Dias de calendário entre duas datas AAAA-MM-DD (positivo quando `fim` é posterior). */
export function diasEntre(inicio: string, fim: string): number {
  return Math.round((utc(fim) - utc(inicio)) / MS_DIA);
}

export function somarDias(iso: string, dias: number): string {
  return new Date(utc(iso) + dias * MS_DIA).toISOString().slice(0, 10);
}

/** Subtrai meses mantendo o dia (ou o último dia do mês de destino). */
export function subtrairMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 - meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const FORMATADOR_BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function brl(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "—" : FORMATADOR_BRL.format(valor);
}

export function pct(valor: number): string {
  return `${Math.round(valor)}%`;
}

export function textoDias(dias: number): string {
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

// ------------------------------------------------------------- alertas por tempo parado

export type NivelAlerta = "ok" | "atencao" | "critico";

export function nivelPorDias(dias: number, p: Pick<ParametrosAlerta, "dias_atencao" | "dias_critico">): NivelAlerta {
  if (dias >= p.dias_critico) return "critico";
  if (dias >= p.dias_atencao) return "atencao";
  return "ok";
}

export function nivelPorPercentual(valor: number, p: Pick<ParametrosAlerta, "pct_atencao" | "pct_critico">): NivelAlerta {
  if (valor >= p.pct_critico) return "critico";
  if (valor >= p.pct_atencao) return "atencao";
  return "ok";
}

// ------------------------------------------------------------- quinzenas

export type Quinzena = { inicio: string; fim: string; rotulo: string };

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Quinzena (1–15 ou 16–fim do mês) a que a data pertence. */
export function quinzenaDe(iso: string): Quinzena {
  const [a, m, d] = iso.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  if (d <= 15) {
    return { inicio: `${a}-${mm}-01`, fim: `${a}-${mm}-15`, rotulo: `01 a 15/${mm}/${a}` };
  }
  const ultimo = ultimoDiaDoMes(a, m);
  return { inicio: `${a}-${mm}-16`, fim: `${a}-${mm}-${ultimo}`, rotulo: `16 a ${ultimo}/${mm}/${a}` };
}

export function quinzenaAnterior(q: Quinzena): Quinzena {
  return quinzenaDe(somarDias(q.inicio, -1));
}

/** As `n` quinzenas mais recentes até a de `ref` (inclusive), da mais nova para a mais antiga. */
export function quinzenasRecentes(ref: string, n: number): Quinzena[] {
  const lista: Quinzena[] = [];
  let atual = quinzenaDe(ref);
  for (let i = 0; i < n; i++) {
    lista.push(atual);
    atual = quinzenaAnterior(atual);
  }
  return lista;
}

// ------------------------------------------------------------- NF de combustível

export type EtapaNota = "recebida" | "com_secretaria" | "assinada" | "na_contabilidade";

export type SituacaoNota = {
  etapa: EtapaNota;
  rotulo: string;
  /** Desde quando a NF está nesta etapa (para contar os dias parada). */
  desde: string;
  /** A etapa depende de alguém? (a NF só sai da lista de pendências na Contabilidade) */
  pendente: boolean;
};

type CamposNota = Pick<
  NotaCombustivel,
  "data_emissao" | "enviada_secretaria_em" | "retornou_em" | "enviada_contabilidade_em"
>;

export function situacaoNota(n: CamposNota): SituacaoNota {
  if (n.enviada_contabilidade_em) {
    return { etapa: "na_contabilidade", rotulo: "Na Contabilidade", desde: n.enviada_contabilidade_em, pendente: false };
  }
  if (n.retornou_em) {
    return { etapa: "assinada", rotulo: "Assinada, a enviar à Contabilidade", desde: n.retornou_em, pendente: true };
  }
  if (n.enviada_secretaria_em) {
    return { etapa: "com_secretaria", rotulo: "Aguardando assinatura da secretaria", desde: n.enviada_secretaria_em, pendente: true };
  }
  return { etapa: "recebida", rotulo: "Recebida, a enviar à secretaria", desde: n.data_emissao, pendente: true };
}

// ------------------------------------------------------------- manutenção

export type EtapaManutencao =
  | "a_analisar"
  | "novo_orcamento"
  | "recusada"
  | "liberada"
  | "oc_emitida"
  | "aguardando_nf"
  | "aguardando_docs"
  | "docs_retornaram"
  | "concluida";

export const ROTULO_ETAPA_MANUTENCAO: Record<EtapaManutencao, string> = {
  a_analisar: "Orçamento a analisar",
  novo_orcamento: "Novo orçamento pedido",
  recusada: "Recusada",
  liberada: "Liberada, falta a OC",
  oc_emitida: "OC emitida, a enviar à secretaria",
  aguardando_nf: "Aguardando NF",
  aguardando_docs: "Aguardando os documentos",
  docs_retornaram: "Documentos no Frotas, a enviar à Contabilidade",
  concluida: "Concluída",
};

type CamposManutencao = Pick<
  Manutencao,
  | "status_analise"
  | "orcamento_recebido_em"
  | "analisado_em"
  | "oc_numero"
  | "oc_emitida_em"
  | "oc_enviada_em"
  | "nf_numero"
  | "nf_emissao"
  | "docs_retornaram_em"
  | "enviada_contabilidade_em"
>;

export type SituacaoManutencao = { etapa: EtapaManutencao; rotulo: string; desde: string; emAndamento: boolean };

export function situacaoManutencao(m: CamposManutencao): SituacaoManutencao {
  const faz = (etapa: EtapaManutencao, desde: string, emAndamento = true): SituacaoManutencao => ({
    etapa,
    rotulo: ROTULO_ETAPA_MANUTENCAO[etapa],
    desde,
    emAndamento,
  });
  if (m.status_analise === "recusado") return faz("recusada", m.analisado_em ?? m.orcamento_recebido_em, false);
  if (m.status_analise === "novo_orcamento") return faz("novo_orcamento", m.analisado_em ?? m.orcamento_recebido_em);
  if (m.status_analise === "a_analisar") return faz("a_analisar", m.orcamento_recebido_em);
  const liberadoEm = m.analisado_em ?? m.orcamento_recebido_em;
  if (m.enviada_contabilidade_em) return faz("concluida", m.enviada_contabilidade_em, false);
  if (m.docs_retornaram_em) return faz("docs_retornaram", m.docs_retornaram_em);
  if (m.nf_numero) return faz("aguardando_docs", m.nf_emissao ?? m.oc_enviada_em ?? liberadoEm);
  if (m.oc_enviada_em) return faz("aguardando_nf", m.oc_enviada_em);
  if (m.oc_numero) return faz("oc_emitida", m.oc_emitida_em ?? liberadoEm);
  return faz("liberada", liberadoEm);
}

export type PassoManutencao = { chave: string; nome: string; data: string | null; estado: "feito" | "atual" | "futuro" };

/** Os 8 passos do fluxo, com o estado de cada um (alimenta o indicador de etapas da tela). */
export function passosManutencao(m: CamposManutencao): PassoManutencao[] {
  const recusada = m.status_analise === "recusado";
  const liberada = m.status_analise === "liberado";
  const base: Omit<PassoManutencao, "estado">[] = [
    { chave: "orcamento", nome: "Orçamento recebido", data: m.orcamento_recebido_em },
    { chave: "analise", nome: "Análise do Frotas", data: liberada || recusada ? m.analisado_em : null },
    { chave: "liberado", nome: "Serviço liberado", data: liberada ? m.analisado_em : null },
    { chave: "oc", nome: "OC emitida no IPM", data: m.oc_numero ? (m.oc_emitida_em ?? m.analisado_em) : null },
    { chave: "oc_enviada", nome: "OC enviada à secretaria", data: m.oc_enviada_em },
    { chave: "nf", nome: "NF da oficina", data: m.nf_emissao },
    { chave: "docs", nome: "Documentos de volta ao Frotas", data: m.docs_retornaram_em },
    { chave: "contabilidade", nome: "Enviado à Contabilidade", data: m.enviada_contabilidade_em },
  ];
  const feitos = [
    true,
    liberada || recusada,
    liberada,
    !!m.oc_numero,
    !!m.oc_enviada_em,
    !!m.nf_numero,
    !!m.docs_retornaram_em,
    !!m.enviada_contabilidade_em,
  ];
  const primeiroPendente = feitos.findIndex((f) => !f);
  return base.map((p, i) => ({
    ...p,
    estado: feitos[i] ? "feito" : i === primeiroPendente && !recusada ? "atual" : "futuro",
  }));
}

/**
 * Quanto a manutenção pesa nas contas. Só conta o que foi liberado: a NF
 * registrada, ou o valor da OC (ou do orçamento liberado) enquanto a NF não chega.
 */
export function custoManutencao(
  m: Pick<Manutencao, "status_analise" | "nf_valor" | "oc_valor" | "orcamento_valor">
): number | null {
  if (m.status_analise !== "liberado") return null;
  return m.nf_valor ?? m.oc_valor ?? m.orcamento_valor;
}

/** Data de referência do custo (para janelas de 12 meses etc.). */
export function dataDoCusto(
  m: Pick<Manutencao, "nf_emissao" | "oc_emitida_em" | "analisado_em" | "orcamento_recebido_em">
): string {
  return m.nf_emissao ?? m.oc_emitida_em ?? m.analisado_em ?? m.orcamento_recebido_em;
}

/** Texto de serviço sem acento, minúsculo e sem espaços repetidos — chave para comparar serviços parecidos. */
export function chaveServico(servico: string): string {
  return servico
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------------- avisos de preenchimento

/** Avisos (não bloqueiam) sobre uma NF de combustível antes de salvar. */
export function avisosNota(
  n: Pick<NotaCombustivel, "data_emissao" | "enviada_secretaria_em" | "retornou_em" | "enviada_contabilidade_em" | "periodo_inicio" | "periodo_fim">
): string[] {
  const avisos: string[] = [];
  if (n.enviada_secretaria_em && n.enviada_secretaria_em < n.data_emissao) avisos.push("O envio à secretaria é anterior à emissão da NF.");
  if (n.retornou_em && n.enviada_secretaria_em && n.retornou_em < n.enviada_secretaria_em) avisos.push("O retorno é anterior ao envio.");
  if (n.enviada_contabilidade_em && n.retornou_em && n.enviada_contabilidade_em < n.retornou_em) {
    avisos.push("O envio à Contabilidade é anterior ao retorno da secretaria.");
  }
  if (n.data_emissao < n.periodo_inicio) avisos.push("A emissão é anterior ao início da quinzena.");
  return avisos;
}
