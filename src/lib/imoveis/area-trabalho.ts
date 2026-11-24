/**
 * Linhas das áreas de trabalho de Imóveis (Imóveis, Pendências, Entregas): a lista e o resumo ao lado já vêm calculados aqui
 * (puro e testado), em objetos simples que atravessam do servidor para o navegador.
 */

import {
  diasEntre,
  etapasDaEntrega,
  mascararDocumento,
  progressoEntrega,
  referenciaDe,
  situacaoVigencia,
  type EstadoEtapa,
  type Pendencia,
} from "@/lib/imoveis/regras";
import type { Conta, Entrega, Imobiliaria, Imovel, ParametrosImoveis, PendenciaJustificada, SecretariaImoveis, Unidade } from "@/types/imoveis";

type Base = {
  hoje: string;
  imoveis: Imovel[];
  unidades: Unidade[];
  contas: Conta[];
  entregas: Entrega[];
  secretarias: SecretariaImoveis[];
  par: ParametrosImoveis;
};

export type NivelVigencia = "ok" | "atencao" | "critico" | "vencido" | "sem_fim" | "entregue";

// ------------------------------------------------------------------ imóveis

export type LinhaImovel = {
  id: string;
  nome: string;
  endereco: string;
  secretariaId: string;
  secretaria: string;
  situacao: Imovel["situacao"];
  vinculo: Imovel["vinculo"];
  setor: string | null;
  finalidade: string | null;
  imobiliaria: string | null;
  contrato: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  vigencia: { nivel: NivelVigencia; texto: string; dias: number | null };
  aluguel: number;
  diaVencimento: number | null;
  indice: string | null;
  proximoReajuste: string | null;
  proprietario: string | null;
  documento: string;
  referencia: string;
  agua: number;
  luz: number;
  unidades: { tipo: "agua" | "luz"; numero: string; ativa: boolean }[];
  pendencias: { titulo: string; detalhe: string; nivel: "critico" | "atencao" }[];
};

export function mesDeReferencia(contas: Conta[], hoje: string): string {
  const atual = referenciaDe(hoje);
  return contas.map((c) => c.referencia).filter((r) => r <= atual).sort().at(-1) ?? atual;
}

export function montarLinhasImoveis(e: Base & { imobiliarias: Imobiliaria[]; pendencias: Pendencia[] }): LinhaImovel[] {
  const nomeSec = new Map(e.secretarias.map((s) => [s.id, s.nome]));
  const nomeImob = new Map(e.imobiliarias.map((i) => [i.id, i.nome]));
  const referencia = mesDeReferencia(e.contas, e.hoje);
  const unidadePorId = new Map(e.unidades.map((u) => [u.id, u]));
  const gasto = new Map<string, { agua: number; luz: number }>();
  for (const c of e.contas) {
    if (c.referencia !== referencia) continue;
    const u = unidadePorId.get(c.unidade_id);
    if (!u) continue;
    const g = gasto.get(u.imovel_id) ?? { agua: 0, luz: 0 };
    g[u.tipo] += c.valor;
    gasto.set(u.imovel_id, g);
  }
  return e.imoveis.map((i) => {
    const v = situacaoVigencia(i.vigencia_fim, e.hoje, e.par);
    const nivel: NivelVigencia = i.situacao === "entregue" ? "entregue" : !i.vigencia_fim ? "sem_fim" : v.nivel;
    const g = gasto.get(i.id) ?? { agua: 0, luz: 0 };
    return {
      id: i.id,
      nome: i.nome,
      endereco: i.endereco,
      secretariaId: i.secretaria_id,
      secretaria: nomeSec.get(i.secretaria_id) ?? "—",
      situacao: i.situacao,
      vinculo: i.vinculo,
      setor: i.setor,
      finalidade: i.finalidade,
      imobiliaria: i.imobiliaria_id ? (nomeImob.get(i.imobiliaria_id) ?? null) : null,
      contrato: i.contrato_numero,
      vigenciaInicio: i.vigencia_inicio,
      vigenciaFim: i.vigencia_fim,
      vigencia: { nivel, texto: v.texto, dias: v.dias },
      aluguel: i.valor_aluguel,
      diaVencimento: i.dia_vencimento,
      indice: i.indice_reajuste,
      proximoReajuste: i.proximo_reajuste,
      proprietario: i.proprietario_nome,
      documento: mascararDocumento(i.proprietario_documento),
      referencia,
      agua: g.agua,
      luz: g.luz,
      unidades: e.unidades.filter((u) => u.imovel_id === i.id).map((u) => ({ tipo: u.tipo, numero: u.numero, ativa: u.ativa })),
      pendencias: e.pendencias.filter((p) => p.imovelId === i.id).map((p) => ({ titulo: p.titulo, detalhe: p.detalhe, nivel: p.nivel })),
    };
  });
}

// ------------------------------------------------------------------ pendências

export type AssuntoPendencia = "consumo" | "contrato" | "entrega" | "conta" | "cadastro" | "outro";
export const ROTULO_ASSUNTO: Record<AssuntoPendencia, string> = {
  consumo: "Consumo e valor das contas",
  contrato: "Contrato e reajuste",
  entrega: "Entrega do imóvel",
  conta: "Lançamento e pagamento de contas",
  cadastro: "Cadastro",
  outro: "Outros",
};

export function assuntoDaPendencia(chave: string): AssuntoPendencia {
  if (chave.startsWith("consumo_") || chave.startsWith("valor_")) return "consumo";
  if (chave.startsWith("contrato_") || chave === "reajuste") return "contrato";
  if (chave.startsWith("ligacao_ativa_") || chave.startsWith("entrega_") || chave === "vistoria_pendente" || chave === "titularidade_pendente") return "entrega";
  if (chave.startsWith("sem_conta_") || chave.startsWith("atraso_")) return "conta";
  if (chave === "cadastro_revisar") return "cadastro";
  return "outro";
}

export type LinhaPendencia = {
  id: string;
  imovelId: string;
  imovel: string;
  secretariaId: string;
  secretaria: string;
  chave: string;
  assinatura: string;
  titulo: string;
  detalhe: string;
  nivel: "critico" | "atencao";
  assunto: AssuntoPendencia;
  justificada: { em: string; texto: string } | null;
};

/** Uma linha por pendência (inclusive as justificadas: a visão padrão as esconde, "mostrar justificadas" as traz de volta). */
export function montarLinhasPendencias(e: { imoveis: Imovel[]; secretarias: SecretariaImoveis[]; todas: Pendencia[]; justificadas: PendenciaJustificada[] }): LinhaPendencia[] {
  const imovel = new Map(e.imoveis.map((i) => [i.id, i]));
  const nomeSec = new Map(e.secretarias.map((s) => [s.id, s.nome]));
  const justificativa = new Map(e.justificadas.map((j) => [`${j.imovel_id}|${j.chave}|${j.assinatura}`, j]));
  const linhas: LinhaPendencia[] = [];
  for (const p of e.todas) {
    const im = imovel.get(p.imovelId);
    if (!im) continue;
    const j = justificativa.get(`${p.imovelId}|${p.chave}|${p.assinatura}`);
    linhas.push({
      id: `${p.imovelId}|${p.chave}`,
      imovelId: p.imovelId,
      imovel: im.nome,
      secretariaId: im.secretaria_id,
      secretaria: nomeSec.get(im.secretaria_id) ?? "—",
      chave: p.chave,
      assinatura: p.assinatura,
      titulo: p.titulo,
      detalhe: p.detalhe,
      nivel: p.nivel,
      assunto: assuntoDaPendencia(p.chave),
      justificada: j ? { em: j.em.slice(0, 10), texto: j.justificativa } : null,
    });
  }
  return linhas;
}

// ------------------------------------------------------------------ entregas

export type LinhaEntrega = {
  id: string;
  nome: string;
  endereco: string;
  secretariaId: string;
  secretaria: string;
  situacao: Imovel["situacao"];
  contrato: string | null;
  vigenciaFim: string | null;
  feitas: number;
  total: number;
  /** Nome da etapa que pede atenção (alerta) ou é a próxima; "Concluída" quando tudo foi feito e "Etapas não registradas" quando não há registro da entrega. */
  proxima: string;
  alerta: boolean;
  critica: boolean;
  diasDesdeAviso: number | null;
  etapas: { nome: string; estado: EstadoEtapa; data: string | null; detalhe: string }[];
};

export function montarLinhasEntregas(e: Base & { pendencias: Pendencia[] }): LinhaEntrega[] {
  const nomeSec = new Map(e.secretarias.map((s) => [s.id, s.nome]));
  const entregaPorId = new Map(e.entregas.map((x) => [x.id, x]));
  return e.imoveis
    .filter((i) => i.situacao !== "ativo" || entregaPorId.has(i.id))
    .map((i) => {
      const ent = entregaPorId.get(i.id) ?? null;
      const etapas = etapasDaEntrega(ent);
      const { feitas, total } = progressoEntrega(ent);
      const falta = etapas.find((x) => x.estado === "alerta") ?? etapas.find((x) => x.estado === "agora");
      return {
        id: i.id,
        nome: i.nome,
        endereco: i.endereco,
        secretariaId: i.secretaria_id,
        secretaria: nomeSec.get(i.secretaria_id) ?? "—",
        situacao: i.situacao,
        contrato: i.contrato_numero,
        vigenciaFim: i.vigencia_fim,
        feitas,
        total,
        proxima: falta ? falta.nome : feitas === total ? "Concluída" : "Etapas não registradas",
        alerta: etapas.some((x) => x.estado === "alerta"),
        critica: e.pendencias.some((p) => p.imovelId === i.id && p.nivel === "critico"),
        diasDesdeAviso: ent?.aviso_saida_em ? diasEntre(ent.aviso_saida_em, e.hoje) : null,
        etapas: etapas.map((x) => ({ nome: x.nome, estado: x.estado, data: x.data, detalhe: x.detalhe })),
      };
    })
    .sort((a, b) => Number(a.situacao === "entregue") - Number(b.situacao === "entregue") || a.nome.localeCompare(b.nome, "pt-BR"));
}
