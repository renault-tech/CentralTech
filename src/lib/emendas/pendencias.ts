/**
 * Pendências por emenda — o que merece atenção do gestor. Regras puras (testadas em
 * `pendencias.test.ts`); o banco guarda só as justificativas (`pendencias_justificadas`).
 * A `assinatura` de cada pendência muda quando os dados que a dispararam mudam: uma
 * justificativa só vale enquanto a assinatura é a mesma.
 */

import { baseDaPendencia } from "@/lib/emendas/base-legal";
import { bancoOficial, faltas, type ItemConformidade, type SituacaoRelatorio } from "@/lib/emendas/conformidade";
import { datasForaDeOrdem, tipoDaEmenda, type FaseCalculada } from "@/lib/emendas/fases";
import { dataBr, diasAteFimDoAno, situacaoVigencia } from "@/lib/emendas/regras";
import type { EmendaResumo, ExecucaoEmenda, Exercicio, PendenciaJustificada } from "@/types/emendas";

export type Gravidade = "alta" | "media" | "baixa";

export type Pendencia = {
  regra: string;
  gravidade: Gravidade;
  titulo: string;
  detalhe: string;
  /** Muda quando os dados mudam; justificativa só vale para a mesma assinatura. */
  assinatura: string;
  /** Aba do detalhe onde se resolve. */
  aba: "fases" | "documentacao" | "financeiro" | "execucao" | "transparencia" | "documentos";
  /** Fundamento legal da regra, quando houver. */
  base?: string;
  justificativa?: string;
  /** Data (ISO) em que a justificativa foi registrada. */
  justificadaEm?: string;
};

export const ORDEM_GRAVIDADE: Record<Gravidade, number> = { alta: 0, media: 1, baixa: 2 };
export const NOME_GRAVIDADE: Record<Gravidade, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

export type EntradaPendencias = {
  emenda: EmendaResumo;
  fases: FaseCalculada[];
  execucao: Pick<
    ExecucaoEmenda,
    "numero_termo" | "vigencia_fim" | "data_publicacao_extrato" | "conta_bancaria"
  > | null;
  exercicio: Pick<Exercicio, "prazo_exequibilidade"> | null;
  temParecer: boolean;
  justificadas?: PendenciaJustificada[];
  /** IN TCE-MG 05/2025: itens do art. 7º já avaliados, relatórios de gestão e conta repetida. */
  conformidade?: { itens: ItemConformidade[]; relatorios: SituacaoRelatorio[]; contaRepetida: boolean };
  /** AAAA-MM-DD */
  hoje: string;
};

const DIA = 86_400_000;
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DIA);

export function pendencias(e: EntradaPendencias): Pendencia[] {
  const { emenda, execucao } = e;
  const tipo = tipoDaEmenda(emenda);
  const out: Pendencia[] = [];
  const add = (p: Omit<Pendencia, "assinatura"> & { assinatura?: string }) =>
    out.push({ ...p, assinatura: p.assinatura ?? p.detalhe });

  if (emenda.situacao === "cancelada") return [];

  if (emenda.situacao === "impedida" || emenda.impedimentos_abertos > 0) {
    add({
      regra: "impedimento",
      gravidade: "alta",
      titulo: "Impedimento em aberto",
      detalhe: "Há impedimento sem resolução: decidir o remanejamento ou registrar a solução.",
      aba: "fases",
    });
  }

  if (emenda.empenhado > emenda.valor + 0.005) {
    add({
      regra: "empenho_maior",
      gravidade: "alta",
      titulo: "Empenhado acima do valor da emenda",
      detalhe: `Empenhado ${emenda.empenhado.toFixed(2)} para valor ${emenda.valor.toFixed(2)}.`,
      aba: "financeiro",
    });
  }
  if (emenda.pago > emenda.empenhado + 0.005) {
    add({
      regra: "pago_maior",
      gravidade: "alta",
      titulo: "Pago acima do empenhado",
      detalhe: `Pago ${emenda.pago.toFixed(2)} para empenhado ${emenda.empenhado.toFixed(2)}.`,
      aba: "financeiro",
    });
  }

  const incoerente =
    (tipo === "direta" && emenda.modalidade === "repasse") || (tipo === "osc" && emenda.modalidade === "direta");
  if (incoerente) {
    add({
      regra: "tipo_incoerente",
      gravidade: "media",
      titulo: "Tipo de execução incoerente com a natureza da despesa",
      detalhe:
        tipo === "direta"
          ? "Marcada como execução direta, mas a natureza é de transferência (grupo 50): confirmar o tipo ou a dotação."
          : "Marcada como repasse a OSC, mas a natureza é de aplicação direta (grupo 90): confirmar o tipo ou a dotação.",
      aba: "fases",
    });
  }

  const concluiuTudo = emenda.etapa === "concluida";
  const jaIniciou = emenda.etapa !== "indicada";

  if (tipo !== "direta" && execucao?.numero_termo && !execucao.data_publicacao_extrato) {
    add({
      regra: "termo_sem_extrato",
      gravidade: "media",
      titulo: "Termo assinado sem extrato publicado",
      detalhe: `Termo ${execucao.numero_termo} sem data de publicação do extrato (Lei 13.019, art. 38).`,
      aba: "execucao",
    });
  }

  if (tipo !== "direta" && execucao?.numero_termo && !execucao.conta_bancaria) {
    add({
      regra: "sem_conta",
      gravidade: "media",
      titulo: "Parceria sem conta bancária específica",
      detalhe: "Informar a conta específica da parceria (Lei 13.019, art. 51; IN TCE-MG 05/2025, art. 6º).",
      aba: "execucao",
    });
  }

  const vig = situacaoVigencia(execucao?.vigencia_fim, e.hoje);
  if (vig?.alerta && !concluiuTudo) {
    const venceu = (execucao?.vigencia_fim ?? "") < e.hoje;
    const depoisDeVencer = venceu && execucao?.vigencia_fim ? diasEntre(execucao.vigencia_fim, e.hoje) : 0;
    const prestacao = tipo !== "direta" && venceu && emenda.etapa !== "prestacao_contas";
    add({
      regra: "vigencia",
      gravidade: venceu ? (prestacao && depoisDeVencer > 90 ? "alta" : "media") : "baixa",
      titulo: venceu ? "Vigência encerrada" : "Vigência terminando",
      detalhe: prestacao
        ? `${vig.texto}. Prestação de contas em até 90 dias do término (Lei 13.019, art. 69): ${depoisDeVencer} dia(s) decorridos.`
        : vig.texto,
      aba: "execucao",
    });
  }

  if (!jaIniciou && !concluiuTudo) {
    const dias = diasAteFimDoAno(new Date(`${e.hoje}T00:00:00`), emenda.ano);
    add({
      regra: "nao_iniciada",
      gravidade: dias <= 60 ? "alta" : dias <= 120 ? "media" : "baixa",
      titulo: "Sem andamento",
      detalhe: `Nenhuma fase iniciada. Faltam ${dias} dia(s) para o fim do exercício.`,
      assinatura: "nao_iniciada",
      aba: "fases",
    });
  }

  if (
    e.exercicio?.prazo_exequibilidade &&
    e.exercicio.prazo_exequibilidade < e.hoje &&
    !e.temParecer &&
    !jaIniciou &&
    emenda.impedimentos_abertos === 0
  ) {
    add({
      regra: "exequibilidade_vencida",
      gravidade: "alta",
      titulo: "Prazo de exequibilidade vencido sem parecer",
      detalhe: `A secretaria ${emenda.secretaria_nome} não enviou o parecer até ${dataBr(e.exercicio.prazo_exequibilidade)}.`,
      assinatura: `exequibilidade|${emenda.secretaria_id}`,
      aba: "fases",
    });
  }

  for (const [antes, depois] of datasForaDeOrdem(e.fases)) {
    add({
      regra: `data_fora_de_ordem:${depois.fase.chave}`,
      gravidade: "media",
      titulo: "Datas fora de ordem",
      detalhe: `${depois.fase.nome} (${dataBr(depois.data)}) é anterior a ${antes.fase.nome} (${dataBr(antes.data)}).`,
      aba: "fases",
    });
  }

  const conf = e.conformidade;
  if (conf) {
    const faltando = faltas(conf.itens);
    if (faltando.length) {
      const iniciou = emenda.empenhado > 0 || emenda.pago > 0;
      add({
        regra: "publicidade_incompleta",
        gravidade: iniciou ? "alta" : "baixa",
        titulo: iniciou ? "Execução sem publicidade completa (IN TCE-MG 05/2025)" : "Publicidade incompleta (IN TCE-MG 05/2025)",
        detalhe: `Faltam para a divulgação obrigatória: ${faltando.map((f) => `${f.codigo === "art5" ? "art. 5º" : `item ${f.codigo}`} — ${f.nome}`).join("; ")}.${iniciou ? " As informações devem ser divulgadas antes da execução (art. 7º, § 2º)." : ""}`,
        assinatura: `publicidade|${faltando.map((f) => f.codigo).join(",")}|${iniciou ? "exec" : "pre"}`,
        aba: "transparencia",
      });
    }
    const oficial = bancoOficial(execucao?.conta_bancaria);
    if (conf.contaRepetida) {
      add({
        regra: "conta_repetida",
        gravidade: "alta",
        titulo: "Mesma conta bancária em mais de uma emenda",
        detalhe: "A IN exige conta específica para cada transferência e veda contas de passagem (art. 6º). Abra conta própria para esta emenda ou corrija o cadastro.",
        assinatura: `conta_repetida|${execucao?.conta_bancaria ?? ""}`,
        aba: "execucao",
      });
    }
    if (oficial === false) {
      add({
        regra: "conta_banco_nao_oficial",
        gravidade: "media",
        titulo: "Conta fora de instituição financeira oficial",
        detalhe: `A conta informada (“${execucao?.conta_bancaria}”) não parece ser do Banco do Brasil ou da Caixa. O art. 6º da IN pede instituição financeira oficial, onde houver: confirmar com o jurídico.`,
        assinatura: `banco|${execucao?.conta_bancaria ?? ""}`,
        aba: "execucao",
      });
    }
    for (const r of conf.relatorios) {
      add({
        regra: `relatorio_gestao:${r.competencia}`,
        gravidade: r.situacao === "vencido" ? "alta" : "media",
        titulo: r.situacao === "vencido" ? `Relatório de gestão ${r.competencia} em atraso` : `Relatório de gestão ${r.competencia} vence em breve`,
        detalhe: `O relatório de gestão dos recursos de ${r.competencia} deve estar disponível até ${dataBr(r.prazo)} (IN TCE-MG 05/2025, art. 7º, X e § 1º). Anexe-o em Anexos, tipo “Relatório de gestão”, informando o ano.`,
        assinatura: `relatorio|${r.competencia}|${r.situacao}`,
        aba: "documentos",
      });
    }
  }

  const objeto = emenda.objeto.trim();
  const soNomeDoOrgao = /^(a|o)\s+(secretaria|fundo|departamento|prefeitura|casa|associa[cç][aã]o)\b/i.test(objeto) && objeto.split(/\s+/).length <= 8;
  if (objeto.length < 25 || soNomeDoOrgao) {
    add({
      regra: "objeto_generico",
      gravidade: "baixa",
      titulo: "Objeto pouco descritivo",
      detalhe: `O objeto “${objeto}” só nomeia o órgão ou a entidade. Descreva o que será feito (ex.: “Repasse ao Hospital para custeio de…”): é o texto que aparece no portal público.`,
      assinatura: `objeto|${objeto}`,
      aba: "fases",
    });
  }

  const justificadas = new Map((e.justificadas ?? []).filter((j) => j.emenda_id === emenda.id).map((j) => [j.regra, j]));
  return out
    .map((p) => {
      const j = justificadas.get(p.regra);
      const comBase = { ...p, base: baseDaPendencia(p.regra) };
      return j && j.assinatura === p.assinatura ? { ...comBase, justificativa: j.justificativa, justificadaEm: j.em } : comBase;
    })
    .sort((a, b) => ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade]);
}

/** Pendências que ainda pedem ação (as justificadas ficam registradas, mas não contam). */
export function abertas(ps: Pendencia[]): Pendencia[] {
  return ps.filter((p) => !p.justificativa);
}

export function maiorGravidade(ps: Pendencia[]): Gravidade | null {
  const a = abertas(ps);
  if (!a.length) return null;
  return a.reduce((m, p) => (ORDEM_GRAVIDADE[p.gravidade] < ORDEM_GRAVIDADE[m] ? p.gravidade : m), a[0].gravidade);
}
