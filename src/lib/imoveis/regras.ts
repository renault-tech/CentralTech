/**
 * Regras do módulo Imóveis e Consumo — funções puras (sem servidor), usadas pelas telas e testadas em
 * `regras.test.ts`. As regras de integridade (ordem das datas da entrega, encerramento só com tudo
 * resolvido, uma conta por unidade e mês) também valem no banco
 * (supabase/migrations/20261107000000_imoveis_schema.sql); aqui elas antecipam o aviso e calculam
 * painéis, alertas e pendências.
 *
 * Datas são strings AAAA-MM-DD (data-calendário de Cataguases); `referencia` de conta é sempre AAAA-MM-01.
 */

import { brl, diasEntre, formatarData, somarDias } from "@/lib/frotas/regras";
import type { Conta, Entrega, Imovel, ParametrosImoveis, TipoUnidade, Unidade } from "@/types/imoveis";

export { brl, diasEntre, formatarData, somarDias };

export const COR_MODULO = "#0E7490";
export const COR_TEXTO_MODULO = "#0B5566";

export const PARAMETROS_PADRAO: ParametrosImoveis = {
  id: 1,
  pct_acima: 40,
  pct_abaixo: 40,
  meses_media: 6,
  dias_fim_contrato: 90,
  dia_lancamento: 20,
  pct_valor: 25,
  dias_atraso: 5,
  atualizado_em: "",
};

export const UNIDADE_DE_MEDIDA: Record<TipoUnidade, string> = { agua: "m³", luz: "kWh" };
export const ROTULO_TIPO: Record<TipoUnidade, string> = { agua: "Água", luz: "Luz" };

// ------------------------------------------------------------------ referências (meses)

/** Primeiro dia do mês de `iso`. */
export function referenciaDe(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Soma (ou subtrai) meses a uma referência AAAA-MM-01. */
export function somarMeses(referencia: string, meses: number): string {
  const [a, m] = referencia.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  return alvo.toISOString().slice(0, 10);
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-11-01" → "nov/26". */
export function rotuloMes(referencia: string): string {
  const [a, m] = referencia.split("-");
  return `${MESES_CURTOS[Number(m) - 1]}/${a.slice(2)}`;
}

/** Os `n` meses terminando em `ref` (inclusive), do mais antigo ao mais novo. */
export function ultimosMeses(ref: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somarMeses(ref, i - (n - 1)));
}

// ------------------------------------------------------------------ consumo e valor

export type PontoConta = { referencia: string; consumo: number | null; valor: number };

export type Anomalia = {
  tipo: "acima" | "abaixo" | "valor_unitario";
  nivel: "critico" | "atencao";
  /** De onde veio a comparação: do consumo (m³/kWh) ou do valor em reais (quando a conta só tem o valor). */
  base: "consumo" | "valor";
  /** Variação percentual sobre a média dos meses anteriores. */
  variacao: number;
  media: number;
  texto: string;
};

const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/**
 * Compara a conta MAIS RECENTE do histórico com a média dos `meses_media` meses anteriores. Com menos de 3 meses de histórico não
 * avalia (não há base). Usa o CONSUMO (m³/kWh) quando a conta e o histórico têm consumo; senão cai para o VALOR em reais (é o caso de
 * quem controla só o valor mensal, como nas planilhas de controle). Acima do limite = crítico; abaixo do limite e valor por m³/kWh
 * fora do padrão = atenção.
 */
export function analisarConsumo(historico: PontoConta[], par: Pick<ParametrosImoveis, "pct_acima" | "pct_abaixo" | "meses_media" | "pct_valor">, un = ""): Anomalia[] {
  const ordem = [...historico].sort((a, b) => a.referencia.localeCompare(b.referencia));
  const atual = ordem[ordem.length - 1];
  if (!atual) return [];
  const anteriores = ordem.slice(0, -1);
  const comConsumo = anteriores.filter((p) => p.consumo !== null && p.consumo > 0).slice(-par.meses_media);
  const usaConsumo = atual.consumo !== null && comConsumo.length >= 3;
  const base: "consumo" | "valor" = usaConsumo ? "consumo" : "valor";
  const prev = usaConsumo ? comConsumo : anteriores.filter((p) => p.valor > 0).slice(-par.meses_media);
  if (prev.length < 3) return [];
  const valorAtual = usaConsumo ? (atual.consumo as number) : atual.valor;
  const serie = prev.map((p) => (usaConsumo ? (p.consumo as number) : p.valor));
  const sufixo = usaConsumo && un ? ` ${un}` : "";
  const mediaBase = media(serie);
  const variacao = (valorAtual / mediaBase - 1) * 100;
  const quem = usaConsumo ? "" : "Valor da conta ";
  const fmtMedia = usaConsumo ? `${Math.round(mediaBase)}${sufixo}` : `R$ ${mediaBase.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const out: Anomalia[] = [];
  if (variacao > par.pct_acima) {
    out.push({ tipo: "acima", nivel: "critico", base, variacao, media: mediaBase, texto: `${quem}${quem ? "+" : "+"}${Math.round(variacao)}% sobre a média de ${prev.length} meses (${fmtMedia})` });
  } else if (variacao < -par.pct_abaixo) {
    out.push({
      tipo: "abaixo",
      nivel: "atencao",
      base,
      variacao,
      media: mediaBase,
      texto: usaConsumo ? `${Math.round(-variacao)}% abaixo da média de ${prev.length} meses: possível falha no medidor ou leitura estimada` : `Valor da conta ${Math.round(-variacao)}% abaixo da média de ${prev.length} meses (${fmtMedia}): confira se a conta veio completa`,
    });
  }
  // Valor por m³/kWh só existe quando há consumo.
  if (usaConsumo && (atual.consumo as number) > 0) {
    const unitarios = comConsumo.map((p) => p.valor / (p.consumo as number));
    const mediaUnit = media(unitarios);
    const varUnit = (atual.valor / (atual.consumo as number) / mediaUnit - 1) * 100;
    if (Math.abs(varUnit) > par.pct_valor) {
      out.push({
        tipo: "valor_unitario",
        nivel: "atencao",
        base: "valor",
        variacao: varUnit,
        media: mediaUnit,
        texto: `Valor por${un ? ` ${un}` : " unidade"} ${varUnit > 0 ? "+" : ""}${Math.round(varUnit)}% sobre a média: confira tarifa e taxas`,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------------ contrato

export type SituacaoVigencia = { dias: number | null; nivel: "ok" | "atencao" | "critico" | "vencido"; texto: string };

export function situacaoVigencia(fim: string | null, hoje: string, par: Pick<ParametrosImoveis, "dias_fim_contrato">): SituacaoVigencia {
  if (!fim) return { dias: null, nivel: "ok", texto: "Sem data de fim" };
  const dias = diasEntre(hoje, fim);
  if (dias < 0) return { dias, nivel: "vencido", texto: `Venceu há ${-dias} ${-dias === 1 ? "dia" : "dias"}` };
  if (dias === 0) return { dias, nivel: "critico", texto: "Vence hoje" };
  if (dias <= 30) return { dias, nivel: "critico", texto: `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}` };
  if (dias <= par.dias_fim_contrato) return { dias, nivel: "atencao", texto: `Vence em ${dias} dias` };
  return { dias, nivel: "ok", texto: `Vence em ${dias} dias` };
}

/** Próximo dia `dia` do mês a partir de `hoje` (inclusive); ajusta para o último dia de meses curtos. */
export function proximoVencimentoAluguel(dia: number | null, hoje: string): string | null {
  if (!dia) return null;
  const ref = referenciaDe(hoje);
  for (const r of [ref, somarMeses(ref, 1)]) {
    const [a, m] = r.split("-").map(Number);
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const d = `${r.slice(0, 8)}${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
    if (d >= hoje) return d;
  }
  return null;
}

// ------------------------------------------------------------------ entrega do imóvel

export type EstadoEtapa = "feita" | "agora" | "alerta" | "pendente";
export type EtapaEntrega = { chave: string; nome: string; estado: EstadoEtapa; data: string | null; detalhe: string };

/**
 * As 8 etapas da entrega, na ordem em que acontecem. "Alerta" = o que já deveria ter acontecido
 * (ex.: chaves entregues sem desligamento de água/luz registrado). A primeira etapa não feita sem alerta
 * é a "agora".
 */
export function etapasDaEntrega(e: Entrega | null): EtapaEntrega[] {
  const chavesFeitas = !!e?.chaves_entregues_em;
  const base: Omit<EtapaEntrega, "estado">[] = [
    { chave: "aviso", nome: "Aviso de saída", data: e?.aviso_saida_em ?? null, detalhe: "" },
    {
      chave: "agua",
      nome: "Desligamento da água",
      data: e?.agua_desligada_em ?? null,
      detalhe: [e?.agua_pedido_em && `pedido em ${formatarData(e.agua_pedido_em)}`, e?.agua_protocolo && `protocolo ${e.agua_protocolo}`].filter(Boolean).join(" · "),
    },
    {
      chave: "luz",
      nome: "Desligamento da luz",
      data: e?.luz_desligada_em ?? null,
      detalhe: [e?.luz_pedido_em && `pedido em ${formatarData(e.luz_pedido_em)}`, e?.luz_protocolo && `protocolo ${e.luz_protocolo}`].filter(Boolean).join(" · "),
    },
    {
      chave: "chaves",
      nome: "Entrega das chaves",
      data: e?.chaves_entregues_em ?? null,
      detalhe: [e?.chaves_entregue_por && `entregue por ${e.chaves_entregue_por}`, e?.chaves_recebida_por && `recebida por ${e.chaves_recebida_por}`].filter(Boolean).join(" · "),
    },
    {
      chave: "vistoria_agendada",
      nome: "Vistoria agendada",
      data: e?.vistoria_agendada_em ?? null,
      detalhe: e?.vistoriador ? `vistoriador: ${e.vistoriador}` : "",
    },
    { chave: "vistoria", nome: "Vistoria concluída", data: e?.vistoria_concluida_em ?? null, detalhe: e?.vistoria_obs ?? "" },
    {
      chave: "titularidade",
      nome: "Troca de titularidade (água e luz)",
      data: e?.titularidade_agua_em && e?.titularidade_luz_em ? (e.titularidade_agua_em > e.titularidade_luz_em ? e.titularidade_agua_em : e.titularidade_luz_em) : null,
      detalhe: [`água: ${e?.titularidade_agua_em ? formatarData(e.titularidade_agua_em) : "pendente"}`, `luz: ${e?.titularidade_luz_em ? formatarData(e.titularidade_luz_em) : "pendente"}`].join(" · "),
    },
    { chave: "encerramento", nome: "Encerramento do contrato", data: e?.encerrado_em ?? null, detalhe: "" },
  ];
  let achouAgora = false;
  return base.map((et) => {
    if (et.data) return { ...et, estado: "feita" as const };
    // Chaves já entregues e água/luz ainda ligadas: alerta (o que o setor deve garantir).
    const alerta = chavesFeitas && (et.chave === "agua" || et.chave === "luz" || et.chave === "titularidade");
    if (alerta) return { ...et, estado: "alerta" as const };
    if (!achouAgora && e) {
      achouAgora = true;
      return { ...et, estado: "agora" as const };
    }
    return { ...et, estado: "pendente" as const };
  });
}

export function progressoEntrega(e: Entrega | null): { feitas: number; total: number } {
  const etapas = etapasDaEntrega(e);
  return { feitas: etapas.filter((x) => x.estado === "feita").length, total: etapas.length };
}

// ------------------------------------------------------------------ pendências

export type NivelPendencia = "critico" | "atencao";
export type Pendencia = {
  /** Única por imóvel; a justificativa fica presa a ela. */
  chave: string;
  imovelId: string;
  nivel: NivelPendencia;
  titulo: string;
  detalhe: string;
  /** Muda quando o dado muda: justificativa antiga deixa de valer. */
  assinatura: string;
};

export type EntradaPendencias = {
  imoveis: Imovel[];
  unidades: Unidade[];
  contas: Conta[];
  entregas: Entrega[];
  hoje: string;
  par: ParametrosImoveis;
};

export function calcularPendencias({ imoveis, unidades, contas, entregas, hoje, par }: EntradaPendencias): Pendencia[] {
  const out: Pendencia[] = [];
  const mesAtual = referenciaDe(hoje);
  const diaDoMes = Number(hoje.slice(8, 10));
  const entregaDe = new Map(entregas.map((e) => [e.id, e]));
  const contasDaUnidade = new Map<string, Conta[]>();
  for (const c of contas) {
    const l = contasDaUnidade.get(c.unidade_id) ?? [];
    l.push(c);
    contasDaUnidade.set(c.unidade_id, l);
  }
  const add = (p: Omit<Pendencia, "assinatura"> & { assinatura?: string }) => out.push({ ...p, assinatura: p.assinatura ?? p.detalhe });

  for (const im of imoveis) {
    const ent = entregaDe.get(im.id) ?? null;
    const unids = unidades.filter((u) => u.imovel_id === im.id);

    if (im.situacao !== "entregue") {
      const v = situacaoVigencia(im.vigencia_fim, hoje, par);
      if (v.nivel === "vencido") {
        add({ chave: "contrato_vencido", imovelId: im.id, nivel: "critico", titulo: "Contrato vencido", detalhe: `${v.texto} (${formatarData(im.vigencia_fim)}). Renovar ou iniciar a entrega do imóvel.` });
      } else if (v.nivel === "critico" || v.nivel === "atencao") {
        add({ chave: "contrato_vencendo", imovelId: im.id, nivel: v.nivel === "critico" ? "critico" : "atencao", titulo: "Contrato perto do fim", detalhe: `${v.texto} (${formatarData(im.vigencia_fim)}). Renovar ou iniciar a entrega do imóvel.` });
      }
      if (im.proximo_reajuste) {
        const d = diasEntre(hoje, im.proximo_reajuste);
        if (d >= 0 && d <= 30) {
          add({ chave: "reajuste", imovelId: im.id, nivel: "atencao", titulo: "Reajuste do aluguel próximo", detalhe: `Reajuste${im.indice_reajuste ? ` ${im.indice_reajuste}` : ""} em ${formatarData(im.proximo_reajuste)}.` });
        }
      }
    }

    for (const u of unids) {
      const cs = contasDaUnidade.get(u.id) ?? [];
      const nome = ROTULO_TIPO[u.tipo];
      const un = UNIDADE_DE_MEDIDA[u.tipo];
      if (im.situacao === "ativo" && u.ativa) {
        const historico = cs.filter((c) => c.referencia <= mesAtual).map((c) => ({ referencia: c.referencia, consumo: c.consumo, valor: c.valor }));
        for (const a of analisarConsumo(historico, par, un)) {
          const chave = a.tipo === "valor_unitario" ? `valor_${u.tipo}` : `consumo_${u.tipo}`;
          const ultima = historico.sort((x, y) => x.referencia.localeCompare(y.referencia)).at(-1);
          add({ chave: a.base === "valor" && a.tipo !== "valor_unitario" ? `valor_conta_${u.tipo}` : chave, imovelId: im.id, nivel: a.nivel, titulo: a.base === "valor" ? `Valor da conta de ${nome.toLowerCase()} fora do padrão` : `Consumo de ${nome.toLowerCase()} fora do padrão`, detalhe: `${rotuloMes(ultima!.referencia)}: ${a.texto}.`, assinatura: `${ultima!.referencia}|${ultima!.consumo}|${ultima!.valor}` });
        }
        if (diaDoMes >= par.dia_lancamento && !cs.some((c) => c.referencia === mesAtual) && !cs.some((c) => c.referencia === somarMeses(mesAtual, 1))) {
          add({ chave: `sem_conta_${u.tipo}`, imovelId: im.id, nivel: "atencao", titulo: `Conta de ${nome.toLowerCase()} do mês sem lançamento`, detalhe: `${u.numero}: nenhuma conta de ${rotuloMes(mesAtual)} até o dia ${par.dia_lancamento}.`, assinatura: mesAtual });
        }
      }
      for (const c of cs) {
        if (!c.pago_em && c.vencimento && diasEntre(c.vencimento, hoje) > par.dias_atraso) {
          add({ chave: `atraso_${c.id}`, imovelId: im.id, nivel: "atencao", titulo: `Conta de ${nome.toLowerCase()} em atraso`, detalhe: `${rotuloMes(c.referencia)} (${u.numero}): venceu em ${formatarData(c.vencimento)}, ${diasEntre(c.vencimento, hoje)} dias sem pagamento.` });
        }
      }
      // Imóvel entregue (chaves devolvidas) e a conta continua chegando: ligação ainda ativa.
      const desde = ent?.chaves_entregues_em ?? (im.situacao === "entregue" ? im.vigencia_fim : null);
      if (desde) {
        const refDesde = referenciaDe(desde);
        const depois = cs.filter((c) => c.referencia > refDesde && c.valor > 0).sort((a, b) => b.referencia.localeCompare(a.referencia));
        if (depois.length > 0) {
          add({ chave: `ligacao_ativa_${u.tipo}`, imovelId: im.id, nivel: "critico", titulo: `Imóvel entregue com ${nome.toLowerCase()} ainda ligada`, detalhe: `Chaves entregues em ${formatarData(desde)} e a conta de ${rotuloMes(depois[0].referencia)} (${brl(depois[0].valor)}) continua chegando em ${u.numero}.`, assinatura: `${depois[0].referencia}|${depois[0].valor}` });
        }
      }
    }

    // Etapas da entrega que o setor precisa garantir.
    if (ent?.chaves_entregues_em && !ent.encerrado_em) {
      const faltas: string[] = [];
      if (!ent.agua_desligada_em) faltas.push("água");
      if (!ent.luz_desligada_em) faltas.push("luz");
      if (faltas.length) add({ chave: "entrega_sem_desligamento", imovelId: im.id, nivel: "critico", titulo: "Chaves entregues sem desligamento confirmado", detalhe: `Falta confirmar o desligamento de ${faltas.join(" e ")}.`, assinatura: faltas.join(",") });
      if (!ent.vistoria_agendada_em && diasEntre(ent.chaves_entregues_em, hoje) > 7) {
        add({ chave: "vistoria_pendente", imovelId: im.id, nivel: "atencao", titulo: "Vistoria ainda não agendada", detalhe: `Chaves entregues há ${diasEntre(ent.chaves_entregues_em, hoje)} dias.`, assinatura: ent.chaves_entregues_em });
      }
      if (ent.vistoria_concluida_em && (!ent.titularidade_agua_em || !ent.titularidade_luz_em)) {
        const d = diasEntre(ent.vistoria_concluida_em, hoje);
        add({ chave: "titularidade_pendente", imovelId: im.id, nivel: d > 30 ? "critico" : "atencao", titulo: "Troca de titularidade de água e luz pendente", detalhe: `Vistoria concluída há ${d} dias sem o comprovante de troca.`, assinatura: ent.vistoria_concluida_em });
      }
    } else if (im.situacao === "em_entrega" && ent && !ent.chaves_entregues_em && ent.aviso_saida_em) {
      const d = diasEntre(ent.aviso_saida_em, hoje);
      if (d > 30) add({ chave: "entrega_demorada", imovelId: im.id, nivel: "atencao", titulo: "Entrega em andamento há mais de 30 dias", detalhe: `Aviso de saída em ${formatarData(ent.aviso_saida_em)}; chaves ainda não entregues.`, assinatura: ent.aviso_saida_em });
    }
  }
  const peso = { critico: 0, atencao: 1 } as const;
  return out.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}

/** Tira as justificadas cuja assinatura ainda é a mesma (mudou o dado, volta a contar). */
export function semJustificadas(pendencias: Pendencia[], justificadas: { imovel_id: string; chave: string; assinatura: string }[]): Pendencia[] {
  const chaves = new Set(justificadas.map((j) => `${j.imovel_id}|${j.chave}|${j.assinatura}`));
  return pendencias.filter((p) => !chaves.has(`${p.imovelId}|${p.chave}|${p.assinatura}`));
}

// ------------------------------------------------------------------ totais

export type TotalMensal = { referencia: string; aluguel: number; agua: number; luz: number };

/** Gasto dos últimos `n` meses: aluguel dos imóveis não entregues na época (aproximação: situação atual) + contas lançadas. */
export function totaisMensais(imoveis: Imovel[], unidades: Unidade[], contas: Conta[], ref: string, n = 12): TotalMensal[] {
  const tipoDe = new Map(unidades.map((u) => [u.id, u.tipo]));
  const aluguel = imoveis.filter((i) => i.situacao !== "entregue").reduce((a, i) => a + i.valor_aluguel, 0);
  return ultimosMeses(ref, n).map((r) => {
    const doMes = contas.filter((c) => c.referencia === r);
    const soma = (t: TipoUnidade) => doMes.filter((c) => tipoDe.get(c.unidade_id) === t).reduce((a, c) => a + c.valor, 0);
    return { referencia: r, aluguel, agua: soma("agua"), luz: soma("luz") };
  });
}

// ------------------------------------------------------------------ privacidade

/** CPF/CNPJ mascarado para a tela (o dado completo só fica no cadastro, para quem edita). */
export function mascararDocumento(doc: string | null | undefined): string {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length === 11) return `***.${d.slice(3, 6)}.***-${d.slice(9)}`;
  if (d.length === 14) return `**.***.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  return d ? "***" : "—";
}
