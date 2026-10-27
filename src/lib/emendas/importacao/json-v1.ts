/**
 * Exportação do controle de execução em HTML (`centraltech.emendas.execucao/v1`) →
 * propostas de alteração. Nada é gravado aqui: cada diferença vira uma proposta que
 * o gestor aprova depois. Regras: campo vazio no arquivo nunca apaga dado; valor igual
 * ao atual não gera proposta; fase derivada de outro dado (LOA, parecer, empenho,
 * pagamento, termo, extrato) é ignorada — a fonte dela é o cadastro.
 */

import type { ExecucaoEmenda, FaseEmenda, FaseFluxo, ChecklistEmenda, SituacaoFase, EstadoChecklist } from "@/types/emendas";

export const FORMATO_JSON_V1 = "centraltech.emendas.execucao/v1";

export type EmendaJson = {
  numero: number;
  instrumento?: Record<string, unknown> | null;
  andamentos?: { fase?: string; status?: string; data?: string | null; documento?: string | null; observacao?: string | null }[];
  checklist?: { item?: string; status?: string }[];
};

export type ArquivoJson = { ano: number; emendas: EmendaJson[] };

export type PropostaNova = {
  numero: number;
  alvo: "execucao" | "emenda_fases" | "emenda_checklist";
  chave: string | null;
  campo: string | null;
  rotulo: string;
  valorAtual: unknown;
  valorProposto: unknown;
};

export function lerJsonV1(texto: string): { arquivo?: ArquivoJson; erro?: string } {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { erro: "O arquivo não é um JSON válido." };
  }
  const o = bruto as { formato?: unknown; ano?: unknown; emendas?: unknown };
  if (o?.formato !== FORMATO_JSON_V1) return { erro: `Formato não reconhecido (esperado ${FORMATO_JSON_V1}).` };
  if (typeof o.ano !== "number" || !Array.isArray(o.emendas)) return { erro: "Arquivo sem ano ou sem lista de emendas." };
  const emendas = (o.emendas as EmendaJson[]).filter((e) => e && Number.isInteger(e.numero));
  return { arquivo: { ano: o.ano, emendas } };
}

const CAMPOS_EXECUCAO: Record<string, { coluna: keyof ExecucaoEmenda; rotulo: string; data?: boolean }> = {
  termo: { coluna: "numero_termo", rotulo: "Termo de parceria" },
  processo: { coluna: "processo_licitatorio", rotulo: "Processo licitatório" },
  vigencia_inicio: { coluna: "vigencia_inicio", rotulo: "Início da vigência", data: true },
  vigencia_fim: { coluna: "vigencia_fim", rotulo: "Fim da vigência", data: true },
  publicacao_extrato: { coluna: "data_publicacao_extrato", rotulo: "Publicação do extrato", data: true },
  conta_bancaria: { coluna: "conta_bancaria", rotulo: "Conta bancária" },
  gestor_entidade: { coluna: "gestor_osc", rotulo: "Gestor na entidade" },
  gestor_pmc: { coluna: "gestor_pmc", rotulo: "Gestor na Prefeitura" },
};

const SITUACOES: SituacaoFase[] = ["pendente", "em_andamento", "concluida", "nao_se_aplica"];
const ESTADOS: EstadoChecklist[] = ["conferido", "presumido", "pendente", "nao_se_aplica"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export type EstadoAtualEmenda = {
  execucao: Partial<ExecucaoEmenda> | null;
  fases: Map<string, FaseEmenda>;
  checklist: Map<string, ChecklistEmenda>;
  /** Fases do tipo da emenda (para saber quais são manuais). */
  catalogo: FaseFluxo[];
  /** Chaves do checklist válidas para o tipo da emenda. */
  itensChecklist: Set<string>;
};

export function gerarPropostas(e: EmendaJson, atual: EstadoAtualEmenda): PropostaNova[] {
  const out: PropostaNova[] = [];

  for (const [chaveJson, def] of Object.entries(CAMPOS_EXECUCAO)) {
    let novo = texto(e.instrumento?.[chaveJson]);
    if (!novo) continue;
    if (def.data && !ISO.test(novo)) continue;
    novo = novo.slice(0, 300);
    const antigo = (atual.execucao?.[def.coluna] as string | null | undefined) ?? null;
    if (antigo === novo) continue;
    out.push({ numero: e.numero, alvo: "execucao", chave: null, campo: def.coluna, rotulo: def.rotulo, valorAtual: antigo, valorProposto: novo });
  }

  const manuais = new Map(atual.catalogo.filter((f) => f.ativa && !f.derivacao).map((f) => [f.chave, f]));
  for (const a of e.andamentos ?? []) {
    const fase = a.fase ? manuais.get(a.fase) : undefined;
    const situacao = a.status as SituacaoFase;
    if (!fase || !SITUACOES.includes(situacao)) continue;
    const data = a.data && ISO.test(a.data) ? a.data : null;
    const proposto = { situacao, data, documento: texto(a.documento)?.slice(0, 120) ?? null, observacao: texto(a.observacao)?.slice(0, 2000) ?? null };
    const existente = atual.fases.get(fase.chave);
    const igual =
      existente &&
      existente.situacao === proposto.situacao &&
      (existente.data ?? null) === proposto.data &&
      (existente.documento ?? null) === proposto.documento &&
      (existente.observacao ?? null) === proposto.observacao;
    if (igual) continue;
    // Não regride: fase já concluída no sistema não volta a pendente por causa de um arquivo.
    if (existente?.situacao === "concluida" && situacao === "pendente") continue;
    out.push({
      numero: e.numero,
      alvo: "emenda_fases",
      chave: fase.chave,
      campo: null,
      rotulo: `Fase: ${fase.nome}`,
      valorAtual: existente ? { situacao: existente.situacao, data: existente.data, documento: existente.documento, observacao: existente.observacao } : null,
      valorProposto: proposto,
    });
  }

  for (const c of e.checklist ?? []) {
    const estado = c.status as EstadoChecklist;
    if (!c.item || !atual.itensChecklist.has(c.item) || !ESTADOS.includes(estado)) continue;
    const existente = atual.checklist.get(c.item);
    const estadoAtual = existente?.estado ?? "pendente";
    if (estadoAtual === estado) continue;
    // Pendente no arquivo é "sem informação": nunca derruba o que já foi conferido.
    if (estado === "pendente") continue;
    out.push({
      numero: e.numero,
      alvo: "emenda_checklist",
      chave: c.item,
      campo: null,
      rotulo: `Documento: ${c.item}`,
      valorAtual: { estado: estadoAtual },
      valorProposto: { estado },
    });
  }
  return out;
}
