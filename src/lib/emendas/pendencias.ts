/**
 * Pendências por emenda — o que merece atenção do gestor. Regras puras (testadas em
 * `pendencias.test.ts`); o banco guarda só as justificativas (`pendencias_justificadas`).
 * A `assinatura` de cada pendência muda quando os dados que a dispararam mudam: uma
 * justificativa só vale enquanto a assinatura é a mesma.
 */

import { baseDaPendencia } from "@/lib/emendas/base-legal";
import { conflitoInstrumento, INFO_CATEGORIA } from "@/lib/emendas/categorias";
import { bancoOficial, faltas, type ItemConformidade, type SituacaoRelatorio } from "@/lib/emendas/conformidade";
import { datasForaDeOrdem, tipoDaEmenda, type FaseCalculada } from "@/lib/emendas/fases";
import { brl, dataBr, diasAteFimDoAno, situacaoVigencia } from "@/lib/emendas/regras";
import type { SituacaoConciliacao } from "@/lib/emendas/conciliacao";
import { objetoDaDescricao } from "@/lib/emendas/objeto-da-descricao";
import type { EmendaResumo, ExecucaoEmenda, Exercicio, PendenciaJustificada } from "@/types/emendas";

export type Gravidade = "alta" | "media" | "baixa";

/** Motivo específico dentro de um assunto (ex.: "Pagamento antes do extrato" em "Datas fora de ordem"). */
export type Motivo = { chave: string; rotulo: string };

export type Pendencia = {
  regra: string;
  gravidade: Gravidade;
  titulo: string;
  detalhe: string;
  /** Muda quando os dados mudam; justificativa só vale para a mesma assinatura. */
  assinatura: string;
  /** Aba do detalhe onde se resolve. */
  aba: "fases" | "documentacao" | "financeiro" | "execucao" | "transparencia" | "documentos";
  /**
   * O que, exatamente, causa a pendência. Um assunto agrupa várias causas (datas fora de ordem: quais datas;
   * publicidade incompleta: quais itens). A chave começa pela da regra, então é única entre assuntos.
   */
  motivos?: Motivo[];
  /** Fundamento legal da regra, quando houver. */
  base?: string;
  justificativa?: string;
  /** Data (ISO) em que a justificativa foi registrada. */
  justificadaEm?: string;
};

export const ORDEM_GRAVIDADE: Record<Gravidade, number> = { alta: 0, media: 1, baixa: 2 };
export const NOME_GRAVIDADE: Record<Gravidade, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

/** Assuntos para separar as pendências: área (agrupa) e nome curto (por regra, sem o sufixo). */
export const AREAS_PENDENCIA = ["Financeiro", "Prazos e vigência", "Execução", "Publicidade e conta", "Cadastro"] as const;
export const ASSUNTO_DA_REGRA: Record<string, { area: (typeof AREAS_PENDENCIA)[number]; nome: string }> = {
  empenho_sem_data: { area: "Financeiro", nome: "Empenho sem data" },
  liquidacao_sem_data: { area: "Financeiro", nome: "Liquidação sem data" },
  pagamento_sem_data: { area: "Financeiro", nome: "Pagamento sem data" },
  empenho_sem_numero: { area: "Financeiro", nome: "Empenho sem número" },
  pago_sem_empenho: { area: "Financeiro", nome: "Pago sem empenho" },
  paga_sem_pagamento: { area: "Financeiro", nome: "Paga sem pagamento lançado" },
  empenho_maior: { area: "Financeiro", nome: "Empenhado acima do valor" },
  pago_maior: { area: "Financeiro", nome: "Pago acima do empenhado" },
  vigencia: { area: "Prazos e vigência", nome: "Vigência (terminando ou encerrada)" },
  exequibilidade_vencida: { area: "Prazos e vigência", nome: "Exequibilidade vencida sem parecer" },
  data_fora_de_ordem: { area: "Prazos e vigência", nome: "Datas fora de ordem" },
  relatorio_gestao: { area: "Prazos e vigência", nome: "Relatório de gestão" },
  nao_iniciada: { area: "Execução", nome: "Sem andamento" },
  instrumento_incompativel: { area: "Cadastro", nome: "Instrumento incompatível com o beneficiário" },
  impedimento: { area: "Execução", nome: "Impedimento em aberto" },
  termo_sem_extrato: { area: "Publicidade e conta", nome: "Termo sem extrato publicado" },
  publicidade_incompleta: { area: "Publicidade e conta", nome: "Publicidade incompleta" },
  sem_conta: { area: "Publicidade e conta", nome: "Parceria sem conta" },
  conta_repetida: { area: "Publicidade e conta", nome: "Conta repetida" },
  conta_banco_nao_oficial: { area: "Publicidade e conta", nome: "Conta em banco não oficial" },
  tipo_incoerente: { area: "Cadastro", nome: "Tipo incoerente com a natureza" },
  objeto_generico: { area: "Cadastro", nome: "Objeto pouco descritivo" },
  saldo_nao_executado: { area: "Execução", nome: "Saldo não executado a registrar" },
  anular_saldo_empenho: { area: "Execução", nome: "Saldo do empenho a anular" },
  excesso_sem_fonte: { area: "Execução", nome: "Excesso sem fonte de recurso" },
  sem_beneficiario: { area: "Cadastro", nome: "Sem beneficiário" },
};

/** Objeto que só nomeia o órgão/entidade ou é curto demais. Usado também para decidir quando buscar a descrição. */
export function objetoGenerico(objeto: string): boolean {
  const o = objeto.trim();
  const soNomeDoOrgao = /^(a|o)\s+(secretaria|fundo|departamento|prefeitura|casa|associa[cç][aã]o)\b/i.test(o) && o.split(/\s+/).length <= 8;
  return o.length < 25 || soNomeDoOrgao;
}

export type EntradaPendencias = {
  emenda: EmendaResumo;
  fases: FaseCalculada[];
  execucao: Pick<
    ExecucaoEmenda,
    "numero_termo" | "vigencia_fim" | "data_publicacao_extrato" | "conta_bancaria"
  > & { processo_licitatorio?: string | null; processo_id?: string | null } & { instrumento?: ExecucaoEmenda["instrumento"] } | null;
  exercicio: Pick<Exercicio, "prazo_exequibilidade"> | null;
  temParecer: boolean;
  /** Conciliação com o IPM (saldo não executado, anulação do saldo do empenho, fonte do excesso). */
  conciliacao?: SituacaoConciliacao;
  /** Autor da emenda fora do exercício (cassado, licenciado, substituído): a emenda segue com ele. */
  justificadas?: PendenciaJustificada[];
  /** Movimentos financeiros da emenda (para achar lançamentos sem data ou sem número). */
  movimentos?: { emenda_id: string; tipo: string; numero?: string | null; data: string | null }[];
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
  // Convênio (contrato de rateio): não é parceria do MROSC, então os fundamentos da Lei 13.019 não se aplicam.
  const convenio = execucao?.instrumento === "convenio";
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

  if (emenda.empenhado > emenda.valor + 0.005 && !e.conciliacao?.fonteExcessoInformada) {
    add({
      regra: "empenho_maior",
      gravidade: "alta",
      titulo: "Empenhado acima do valor da emenda",
      detalhe: `Empenhado ${emenda.empenhado.toFixed(2)} para valor ${emenda.valor.toFixed(2)}. Informe em Financeiro > Conciliação com o IPM a fonte de recurso que cobriu o excesso.`,
      aba: "financeiro",
    });
  }
  const conc = e.conciliacao;
  if (conc && conc.saldoNaoExecutado > 0 && !conc.saldoRegistrado) {
    add({
      regra: "saldo_nao_executado",
      gravidade: "media",
      titulo: "Saldo da emenda não executado: registrar",
      detalhe: `Valor da emenda ${brl(emenda.valor)}, empenhado ${brl(emenda.empenhado)}: ${brl(conc.saldoNaoExecutado)} não executados. Conferir no IPM e registrar o saldo (Financeiro > Conciliação com o IPM). O valor contábil não é arredondado.`,
      assinatura: `saldo|${conc.saldoNaoExecutado.toFixed(2)}`,
      aba: "financeiro",
    });
  }
  if (conc && conc.saldoEmpenho > 0) {
    add({
      regra: "anular_saldo_empenho",
      gravidade: "media",
      titulo: "Anular no IPM o saldo do empenho",
      detalhe: `Empenhado ${brl(emenda.empenhado)} e pago ${brl(emenda.pago)}: sobram ${brl(conc.saldoEmpenho)} no empenho. ${conc.anulacaoSolicitada ? "Anulação já solicitada; lance a Anulação de empenho depois de feita no IPM." : "A Contabilidade deve anular o saldo; registre a solicitação em Financeiro > Conciliação com o IPM."}`,
      assinatura: `anulacao|${conc.saldoEmpenho.toFixed(2)}|${conc.anulacaoSolicitada ? "s" : "n"}`,
      aba: "financeiro",
    });
  }
  if (conc && conc.excesso > 0 && !conc.fonteExcessoInformada) {
    add({
      regra: "excesso_sem_fonte",
      gravidade: "alta",
      titulo: "Excesso sobre o valor da emenda sem fonte de recurso",
      detalhe: `O empenhado passa o valor da emenda em ${brl(conc.excesso)}. Registrar em Financeiro > Conciliação com o IPM a fonte de recurso que cobriu o excesso.`,
      assinatura: `excesso|${conc.excesso.toFixed(2)}`,
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
      motivos: [
        tipo === "direta"
          ? { chave: "tipo_incoerente:direta_com_repasse", rotulo: "Direta, mas a natureza é de repasse (50)" }
          : { chave: "tipo_incoerente:osc_com_direta", rotulo: "Repasse a OSC, mas a natureza é de aplicação direta (90)" },
      ],
      aba: "fases",
    });
  }

  // Categoria do beneficiário × instrumento: só sinaliza (ex.: consórcio com termo de fomento do MROSC).
  const conflito = tipo !== "direta" ? conflitoInstrumento(emenda.beneficiario_categoria, execucao?.instrumento) : null;
  if (conflito) {
    add({
      regra: "instrumento_incompativel",
      gravidade: "media",
      titulo: "Instrumento incompatível com o beneficiário",
      detalhe: conflito,
      assinatura: `instrumento|${emenda.beneficiario_categoria}|${execucao?.instrumento ?? "termo_fomento"}`,
      motivos: [
        {
          chave: `instrumento_incompativel:${emenda.beneficiario_categoria ?? "sem_categoria"}:${convenio ? "convenio" : "termo_fomento"}`,
          rotulo: `${(emenda.beneficiario_categoria ? INFO_CATEGORIA[emenda.beneficiario_categoria]?.nome : null) ?? "Beneficiário"} com ${convenio ? "convênio" : "termo de fomento"}`,
        },
      ],
      aba: "execucao",
    });
  }

  const concluiuTudo = emenda.etapa === "concluida";
  // "Iniciada" vem do que de fato existe (lançamentos, fases com andamento, termo, processo), não só da etapa
  // guardada: um empenho parcial já é andamento, e a pendência some sozinha quando algo é lançado.
  const movsDaEmenda = (e.movimentos ?? []).filter((m) => m.emenda_id === emenda.id);
  const temAtividade =
    movsDaEmenda.length > 0 ||
    emenda.empenhado > 0 ||
    emenda.pago > 0 ||
    // Termo assinado ou processo de compra já aberto/ligado ao Compras também é andamento (o dado já está cadastrado).
    !!execucao?.numero_termo?.trim() ||
    !!execucao?.processo_licitatorio?.trim() ||
    !!execucao?.processo_id ||
    e.fases.some(
      (f) =>
        f.fase.chave !== "indicada" &&
        f.fase.chave !== "analise" &&
        // LOA e parecer são do exercício/da secretaria, não são andamento da emenda
        f.fase.derivacao !== "loa" &&
        f.fase.derivacao !== "parecer" &&
        f.origem !== "presumida" &&
        (f.situacao === "concluida" || f.parcial === true || f.situacao === "em_andamento")
    );
  // Andamento = qualquer fase depois da indicação e da análise (plano, processo, termo, empenho…). Análise sozinha não conta.
  const jaIniciou = (emenda.etapa !== "indicada" && emenda.etapa !== "analise") || temAtividade;

  if (tipo !== "direta" && execucao?.numero_termo && !execucao.data_publicacao_extrato) {
    add({
      regra: "termo_sem_extrato",
      gravidade: "media",
      titulo: convenio ? "Convênio assinado sem publicação" : "Termo assinado sem extrato publicado",
      detalhe: convenio
        ? `Convênio ${execucao.numero_termo} sem data de publicação (publicidade do instrumento, IN TCE-MG 05/2025, art. 7º, VIII).`
        : `Termo ${execucao.numero_termo} sem data de publicação do extrato (Lei 13.019, art. 38).`,
      aba: "execucao",
    });
  }

  if (tipo !== "direta" && execucao?.numero_termo && !execucao.conta_bancaria) {
    add({
      regra: "sem_conta",
      gravidade: "media",
      titulo: "Parceria sem conta bancária específica",
      detalhe: convenio ? "Informar a conta específica da transferência (IN TCE-MG 05/2025, art. 6º)." : "Informar a conta específica da parceria (Lei 13.019, art. 51; IN TCE-MG 05/2025, art. 6º).",
      aba: "execucao",
    });
  }

  const vig = situacaoVigencia(execucao?.vigencia_fim, e.hoje);
  if (vig?.alerta && !concluiuTudo) {
    const venceu = (execucao?.vigencia_fim ?? "") < e.hoje;
    const depoisDeVencer = venceu && execucao?.vigencia_fim ? diasEntre(execucao.vigencia_fim, e.hoje) : 0;
    const prestacao = tipo !== "direta" && !convenio && venceu && emenda.etapa !== "prestacao_contas";
    add({
      regra: "vigencia",
      gravidade: venceu ? (prestacao && depoisDeVencer > 90 ? "alta" : "media") : "baixa",
      titulo: venceu ? "Vigência encerrada" : "Vigência terminando",
      detalhe: prestacao
        ? `${vig.texto}. Prestação de contas em até 90 dias do término (Lei 13.019, art. 69): ${depoisDeVencer} dia(s) decorridos.`
        : vig.texto,
      motivos: [
        !venceu
          ? { chave: "vigencia:terminando", rotulo: "Vigência terminando" }
          : prestacao && depoisDeVencer > 90
            ? { chave: "vigencia:prestacao_atrasada", rotulo: "Encerrada há mais de 90 dias, sem prestação de contas" }
            : prestacao
              ? { chave: "vigencia:prestacao_no_prazo", rotulo: "Encerrada, prestação de contas no prazo de 90 dias" }
              : { chave: "vigencia:encerrada", rotulo: "Vigência encerrada" },
      ],
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
      detalhe: `${depois.fase.nome} (${dataBr(depois.data)}) é anterior a ${antes.fase.nome} (${dataBr(antes.data)}).${
        antes.fase.derivacao === "extrato" ? " O termo só produz efeitos depois da publicação do extrato (Lei 13.019/2014, art. 38): confira a data do pagamento ou a da publicação. Se as datas estão corretas, a saída indicada pelo Controle Interno é a publicação de um extrato saneador (registre-a na justificativa)." : ""
      }`,
      motivos: [{ chave: `data_fora_de_ordem:${antes.fase.chave}>${depois.fase.chave}`, rotulo: `${depois.fase.nome} antes de ${antes.fase.nome}` }],
      aba: "fases",
    });
  }

  // Lançamentos financeiros incompletos: cada tipo vira um assunto próprio para filtrar.
  const movs = (e.movimentos ?? []).filter((m) => m.emenda_id === emenda.id);
  const semData = (tipo: string) => movs.filter((m) => m.tipo === tipo && !m.data).length;
  const nomes: [string, string, string][] = [
    ["empenho", "empenho_sem_data", "Empenho sem data"],
    ["liquidacao", "liquidacao_sem_data", "Liquidação sem data"],
    ["pagamento", "pagamento_sem_data", "Pagamento sem data"],
  ];
  for (const [tipoMov, regra, titulo] of nomes) {
    const n = semData(tipoMov);
    if (n > 0) {
      add({
        regra,
        gravidade: "media",
        titulo,
        detalhe: `${n} lançamento(s) de ${tipoMov === "liquidacao" ? "liquidação" : tipoMov} sem data. Sem a data não dá para calcular prazos nem publicar a execução; informe em Financeiro.`,
        assinatura: `${regra}|${n}`,
        aba: "financeiro",
      });
    }
  }
  const empSemNumero = movs.filter((m) => m.tipo === "empenho" && !(m.numero ?? "").trim()).length;
  if (empSemNumero > 0) {
    add({
      regra: "empenho_sem_numero",
      gravidade: "baixa",
      titulo: "Empenho sem número",
      detalhe: `${empSemNumero} empenho(s) lançado(s) sem o número do empenho.`,
      assinatura: `empenho_sem_numero|${empSemNumero}`,
      aba: "financeiro",
    });
  }
  if (emenda.pago > 0 && emenda.empenhado <= 0) {
    add({
      regra: "pago_sem_empenho",
      gravidade: "alta",
      titulo: "Pago sem empenho registrado",
      detalhe: `Há ${emenda.pago.toFixed(2)} pagos, mas nenhum empenho lançado. Registre o empenho em Financeiro.`,
      assinatura: `pago_sem_empenho|${emenda.pago}`,
      aba: "financeiro",
    });
  }
  if (["paga", "concluida"].includes(emenda.etapa) && emenda.pago <= 0) {
    add({
      regra: "paga_sem_pagamento",
      gravidade: "media",
      titulo: "Marcada como paga, sem pagamento lançado",
      detalhe: "A fase indica pagamento, mas não há nenhum pagamento em Financeiro. Lance o pagamento (valor e data) ou corrija a fase.",
      assinatura: `paga_sem_pagamento|${emenda.etapa}`,
      aba: "financeiro",
    });
  }
  if (tipo !== "direta" && !emenda.beneficiario_id && !concluiuTudo) {
    add({
      regra: "sem_beneficiario",
      gravidade: "media",
      titulo: "Sem beneficiário",
      detalhe: "Repasse sem entidade beneficiária cadastrada.",
      assinatura: "sem_beneficiario",
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
        motivos: faltando.map((f) => ({ chave: `publicidade_incompleta:${f.codigo}`, rotulo: `${f.codigo === "art5" ? "Art. 5º" : `Art. 7º, ${f.codigo}`} · ${f.nome}` })),
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
        motivos: [{ chave: `relatorio_gestao:${r.situacao}`, rotulo: r.situacao === "vencido" ? "Relatório em atraso" : "Relatório vence em breve" }],
        aba: "documentos",
      });
    }
  }

  const objeto = emenda.objeto.trim();
  // A finalidade pode já estar na descrição da planilha: então a informação existe e não é pendência.
  if (objetoGenerico(objeto) && !objetoDaDescricao(emenda.descricao)) {
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
      const comBase = { ...p, base: baseDaPendencia(p.regra, execucao?.instrumento) };
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
