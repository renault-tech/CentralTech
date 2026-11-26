import { consolidarFases, indiceDaProxima, NOME_MACRO, type ChaveMacro } from "@/lib/emendas/fases-resumo";
import { combinaSituacaoFinanceira } from "@/lib/emendas/regras";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import type { EmendaResumo } from "@/types/emendas";

/**
 * Cálculos do Painel de abertura do módulo Emendas (tudo puro, sobre o que a RLS já liberou para a pessoa): totais do exercício
 * partidos em pago / empenhado a pagar / sem empenhar, situação das emendas, cartões por tipo, ritmo dos pagamentos, funil por
 * macro-etapa, vereadores, Saúde, secretarias, atividade recente e prazos. A página só carrega os dados e o componente só desenha.
 */

export type EntradaPainel = {
  ano: number;
  /** Data de hoje, AAAA-MM-DD, no fuso da Prefeitura. */
  hoje: string;
  emendas: EmendaResumo[];
  resumos: Record<string, ResumoLinha>;
  movimentos: { emenda_id: string; tipo: string; data: string | null; valor: number | string | null }[];
  vereadores: { id: string; numero: number; nome: string }[];
  cotaPorVereador: number;
  saudeMinimoPct: number;
  /** Teto de restos a pagar do exercício (R$); null = não informado. */
  tetoRestos?: number | null;
  /** De onde veio o teto ("0,5% da RCL"…), para a tela. */
  tetoRestosDescricao?: string | null;
  prazoExequibilidade: string | null;
  execucoes: { emenda_id: string; vigencia_fim: string | null }[];
  contagens: {
    propostasPendentes: number;
    /** Emendas já empenhadas ou pagas com algum item do art. 7º ainda sem divulgação. */
    executadasIncompletas: number;
    relatoriosGestao: number;
    /** Emendas sem situação de encerramento definida (Panorama). */
    semSituacao: number;
    /** Emendas sem mudança há muito tempo (alerta "paradas"). */
    paradas: number;
  };
  /** `null` = não mostrar (quem não publica o portal). */
  portalPublicado: boolean | null;
  gestor: boolean;
};

export type Gravidade = "alta" | "media" | "info";
export type ItemAtencao = { chave: string; titulo: string; detalhe: string; quantidade: number; gravidade: Gravidade; href: string; rotuloQuantidade?: string };
export type SituacaoFinanceira = { chave: "paga" | "paga_parcial" | "empenhada_sem_pagamento" | "sem_empenho"; nome: string; quantidade: number; valor: number };
export type CartaoTipo = { tipo: "direta" | "osc" | "ente"; quantidade: number; valor: number; empenhado: number; pago: number; comPendencia: number; altas: number };
export type PontoCurva = { mes: number; fracao: number };
export type LinhaVereadorPainel = { id: string; numero: number; nome: string; cota: number; pago: number; empenhadoAPagar: number; semEmpenhar: number; saudeOk: boolean };
export type LinhaSecretariaPainel = { nome: string; total: number; pago: number };
export type ItemAtividade = { tipo: "pagamento" | "empenho" | "anulacao" | "outro"; texto: string; numeroEmenda: number; secretaria: string; data: string; quando: string };
export type ItemPrazo = { dias: number; titulo: string; detalhe: string };

/**
 * Meta legal do exercício: o valor aprovado tem de estar PAGO ou, no mínimo, EMPENHADO até 31/12 (o empenhado e não pago vira restos a
 * pagar, Lei 4.320, art. 36, e continua dentro da lei). O que não foi empenhado volta ao caixa e é o que ainda põe a meta em risco.
 */
export type MetaExercicio = {
  aprovado: number;
  pago: number;
  /** Empenhado e ainda não pago: se não for pago até o fim do ano, fica em restos a pagar. */
  restosAPagar: number;
  /** Ainda sem empenho: é o que falta para estar dentro da lei. */
  semEmpenho: number;
  /** Quanto falta PAGAR do aprovado (restos + sem empenho). */
  faltaPagar: number;
  /** Pago + restos (o que já está dentro da lei). */
  dentroDaLei: number;
  fracaoPago: number;
  fracaoDentroDaLei: number;
  atingida: boolean;
  /** Teto de restos a pagar informado no exercício (null = não informado). */
  tetoRestos: number | null;
  tetoRestosDescricao: string | null;
  /** Mínimo que ainda falta PAGAR para que o que sobrar em restos a pagar caiba no teto (null = teto não informado). */
  minimoAPagar: number | null;
  /** Vereadores que ainda têm valor sem empenho. */
  pendentes: { id: string; numero: number; nome: string; semEmpenho: number }[];
  vereadoresOk: number;
  vereadoresTotal: number;
};

export type Painel = {
  meta: MetaExercicio;
  quantidade: number;
  total: number;
  empenhado: number;
  pago: number;
  aPagar: number;
  semEmpenhar: number;
  situacoes: SituacaoFinanceira[];
  comPendencia: number;
  impedidas: number;
  remanejadas: number;
  tipos: CartaoTipo[];
  atencao: ItemAtencao[];
  curva: { pontos: PontoCurva[]; hojeMes: number; fracaoHoje: number; semanasRestantes: number; mediaSemanal: number; necessarioSemanal: number | null; projecaoFim: number | null };
  funil: { chave: ChaveMacro; nome: string; quantidade: number }[];
  gargalo: { nome: string; quantidade: number } | null;
  vereadores: LinhaVereadorPainel[];
  saude: { valor: number; fracao: number; minimoPct: number; ok: boolean };
  secretarias: LinhaSecretariaPainel[];
  atividade: ItemAtividade[];
  prazos: ItemPrazo[];
};

const ORDEM_MACROS: ChaveMacro[] = ["planejamento", "formalizacao", "empenho", "pagamento", "prestacao", "encerramento"];
const DIA = 86400000;

function utc(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}
/** Dias de `de` até `ate` (negativo se já passou). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / DIA);
}

/** "hoje", "ontem" ou "há N dias" a partir de duas datas ISO. */
export function quandoFoi(hoje: string, data: string): string {
  const d = diasEntre(data, hoje);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 31) return `há ${d} dias`;
  const m = Math.floor(d / 30);
  return m === 1 ? "há 1 mês" : `há ${m} meses`;
}

const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

export function montarPainel(e: EntradaPainel): Painel {
  const ativas = e.emendas.filter((r) => r.situacao !== "cancelada");
  const porId = new Map(ativas.map((r) => [r.id, r]));

  // ---- dinheiro
  let total = 0, empenhado = 0, pago = 0, aPagar = 0, semEmpenhar = 0;
  for (const r of ativas) {
    total += r.valor;
    empenhado += r.empenhado;
    pago += r.pago;
    aPagar += Math.max(0, r.empenhado - r.pago);
    semEmpenhar += Math.max(0, r.valor - r.empenhado);
  }

  // ---- situação financeira (as mesmas classes do filtro "Situação financeira" da lista)
  const classes: Pick<SituacaoFinanceira, "chave" | "nome">[] = [
    { chave: "paga", nome: "Pagas" },
    { chave: "paga_parcial", nome: "Pagas em parte" },
    { chave: "empenhada_sem_pagamento", nome: "Empenhadas, sem pagamento" },
    { chave: "sem_empenho", nome: "Sem empenho" },
  ];
  const situacoes = classes.map((c) => {
    const doGrupo = ativas.filter((r) => combinaSituacaoFinanceira(c.chave, r));
    return { ...c, quantidade: doGrupo.length, valor: doGrupo.reduce((s, r) => s + r.valor, 0) };
  });

  const comPendencia = ativas.filter((r) => (e.resumos[r.id]?.abertas ?? 0) > 0).length;
  const impedidas = ativas.filter((r) => r.situacao === "impedida").length;
  const remanejadas = ativas.filter((r) => r.remanejada).length;

  // ---- tipos
  const tipoDe = (r: EmendaResumo): CartaoTipo["tipo"] => {
    const t = (r as { tipo_execucao?: string | null }).tipo_execucao;
    if (t === "direta" || t === "osc" || t === "ente") return t;
    return r.modalidade === "direta" ? "direta" : "osc";
  };
  const tipos = (["direta", "osc", "ente"] as const).map((tipo) => {
    const doTipo = ativas.filter((r) => tipoDe(r) === tipo);
    return {
      tipo,
      quantidade: doTipo.length,
      valor: doTipo.reduce((s, r) => s + r.valor, 0),
      empenhado: doTipo.reduce((s, r) => s + r.empenhado, 0),
      pago: doTipo.reduce((s, r) => s + r.pago, 0),
      comPendencia: doTipo.filter((r) => (e.resumos[r.id]?.abertas ?? 0) > 0).length,
      altas: doTipo.filter((r) => e.resumos[r.id]?.gravidade === "alta").length,
    };
  });

  // ---- atenção (só o que tem quantidade; mais grave primeiro)
  const altas = ativas.filter((r) => e.resumos[r.id]?.gravidade === "alta").length;
  const anoQ = `ano=${e.ano}`;
  const atencao: ItemAtencao[] = [];
  const add = (i: ItemAtencao) => i.quantidade > 0 && atencao.push(i);
  add({ chave: "altas", titulo: "Pendências de gravidade alta", detalhe: "emendas que pedem providência já", quantidade: altas, gravidade: "alta", href: `/emendas/pendencias?g=alta&${anoQ}` });
  add({ chave: "publicidade", titulo: "Executadas sem a divulgação completa", detalhe: "art. 7º da IN TCE-MG 05/2025", quantidade: e.contagens.executadasIncompletas, gravidade: "alta", href: `/emendas/conformidade?x=1&${anoQ}` });
  add({ chave: "propostas", titulo: e.gestor ? "Propostas aguardando a sua aprovação" : "Suas propostas aguardam aprovação", detalhe: "alterações em dado já preenchido", quantidade: e.contagens.propostasPendentes, gravidade: "media", href: `/emendas/aprovacoes` });
  add({ chave: "paradas", titulo: "Emendas paradas há muito tempo", detalhe: "sem andamento nem lançamento", quantidade: e.contagens.paradas, gravidade: "media", href: `/emendas/lista?ordem=parada&${anoQ}` });
  add({ chave: "situacao", titulo: "Empenhos sem situação de encerramento", detalhe: "restos a pagar a decidir até 31/12", quantidade: e.contagens.semSituacao, gravidade: "media", href: `/emendas/panorama?c=sem_situacao&${anoQ}` });
  add({ chave: "relatorios", titulo: "Relatórios de gestão a vencer ou vencidos", detalhe: "prazo próprio, depois do pagamento", quantidade: e.contagens.relatoriosGestao, gravidade: "info", href: `/emendas/pendencias?a=relatorio_gestao&${anoQ}` });
  if (e.portalPublicado === false) {
    atencao.push({ chave: "portal", titulo: "Portal da transparência", detalhe: "ainda em preparação: o público não vê os dados", quantidade: 1, gravidade: "info", href: `/emendas/portal`, rotuloQuantidade: "Publicar" });
  }

  // ---- curva do ano
  const hojeAno = Number(e.hoje.slice(0, 4));
  const hojeMes = hojeAno === e.ano ? Number(e.hoje.slice(5, 7)) : hojeAno > e.ano ? 12 : 0;
  const pagamentos = e.movimentos.filter((m) => m.tipo === "pagamento" && m.data);
  const porMes = new Array(12).fill(0) as number[];
  for (const m of pagamentos) {
    const [a, mes] = (m.data as string).split("-").map(Number);
    if (a === e.ano && mes >= 1 && mes <= 12) porMes[mes - 1] += num(m.valor);
  }
  let ac = 0;
  const pontos: PontoCurva[] = porMes.slice(0, Math.max(hojeMes, 0)).map((v, i) => {
    ac += v;
    return { mes: i + 1, fracao: total > 0 ? Math.min(1, ac / total) : 0 };
  });
  const fim = `${e.ano}-12-31`;
  const semanasRestantes = Math.max(0, diasEntre(e.hoje, fim)) / 7;
  const desde = new Date(utc(e.hoje) - 56 * DIA).toISOString().slice(0, 10);
  const ultimas8 = pagamentos.filter((m) => (m.data as string) > desde && (m.data as string) <= e.hoje).reduce((s, m) => s + num(m.valor), 0);
  const mediaSemanal = ultimas8 / 8;
  const falta = Math.max(0, total - pago);
  const emCurso = hojeAno === e.ano && semanasRestantes > 0;
  const curva = {
    pontos,
    hojeMes,
    fracaoHoje: total > 0 ? Math.min(1, pago / total) : 0,
    semanasRestantes,
    mediaSemanal,
    necessarioSemanal: emCurso ? falta / semanasRestantes : null,
    projecaoFim: emCurso && total > 0 ? Math.min(1, (pago + mediaSemanal * semanasRestantes) / total) : null,
  };

  // ---- funil por macro-etapa (onde cada emenda está: a primeira macro ainda não concluída)
  const contagem = new Map<ChaveMacro, number>();
  for (const r of ativas) {
    const fases = e.resumos[r.id]?.fases;
    if (!fases || fases.length === 0) continue;
    const macros = consolidarFases(fases);
    const i = indiceDaProxima(macros);
    const chave = i < 0 ? "encerramento" : macros[i].chave;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  const funil = ORDEM_MACROS.map((chave) => ({ chave, nome: NOME_MACRO[chave], quantidade: contagem.get(chave) ?? 0 }));
  // O gargalo ignora o Encerramento (é onde terminam) e o Planejamento sozinho não é problema se for o maior no começo do ano.
  const candidatos = funil.filter((f) => f.chave !== "encerramento");
  const maior = candidatos.reduce((a, b) => (b.quantidade > a.quantidade ? b : a), candidatos[0]);
  const gargalo = maior && maior.quantidade > 0 ? { nome: maior.nome, quantidade: maior.quantidade } : null;

  // ---- vereadores (cota = base da barra; a barra mostra o que falta)
  const vereadores = e.vereadores
    .map((v) => {
      const dele = ativas.filter((r) => r.vereador_id === v.id);
      if (dele.length === 0) return null;
      const valor = dele.reduce((s, r) => s + r.valor, 0);
      const pg = dele.reduce((s, r) => s + r.pago, 0);
      const ap = dele.reduce((s, r) => s + Math.max(0, r.empenhado - r.pago), 0);
      const saude = dele.filter((r) => r.saude).reduce((s, r) => s + r.valor, 0);
      return {
        id: v.id,
        numero: v.numero,
        nome: v.nome,
        cota: valor,
        pago: pg,
        empenhadoAPagar: ap,
        semEmpenhar: Math.max(0, valor - pg - ap),
        saudeOk: saude + 0.005 >= e.cotaPorVereador * (e.saudeMinimoPct / 100),
      };
    })
    .filter((v): v is LinhaVereadorPainel => v !== null);

  // ---- Saúde
  const valorSaude = ativas.filter((r) => r.saude).reduce((s, r) => s + r.valor, 0);
  const fracaoSaude = total > 0 ? valorSaude / total : 0;
  const saude = { valor: valorSaude, fracao: fracaoSaude, minimoPct: e.saudeMinimoPct, ok: fracaoSaude * 100 + 0.0001 >= e.saudeMinimoPct };

  // ---- secretarias
  const mapa = new Map<string, LinhaSecretariaPainel>();
  for (const r of ativas) {
    const l = mapa.get(r.secretaria_nome) ?? { nome: r.secretaria_nome, total: 0, pago: 0 };
    l.total += r.valor;
    l.pago += r.pago;
    mapa.set(r.secretaria_nome, l);
  }
  const secretarias = Array.from(mapa.values()).sort((a, b) => b.total - a.total);

  // ---- atividade recente (lançamentos mais novos)
  const rotulo = { pagamento: "Pagamento", empenho: "Empenho", anulacao: "Anulação de empenho" } as const;
  const atividade: ItemAtividade[] = e.movimentos
    .filter((m): m is typeof m & { data: string } => !!m.data && m.data <= e.hoje && (m.tipo === "pagamento" || m.tipo === "empenho" || m.tipo === "anulacao"))
    .filter((m) => porId.has(m.emenda_id))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
    .slice(0, 6)
    .map((m) => {
      const r = porId.get(m.emenda_id)!;
      const tipo = m.tipo as "pagamento" | "empenho" | "anulacao";
      return { tipo, texto: `${rotulo[tipo]} de ${num(m.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, numeroEmenda: r.numero, secretaria: r.secretaria_nome, data: m.data, quando: quandoFoi(e.hoje, m.data) };
    });

  // ---- prazos (próximos 60 dias; o fim do exercício sempre entra)
  const prazos: ItemPrazo[] = [];
  const vigencias = new Map<string, number[]>();
  for (const x of e.execucoes) {
    if (!x.vigencia_fim || !porId.has(x.emenda_id)) continue;
    const d = diasEntre(e.hoje, x.vigencia_fim);
    if (d < 0 || d > 60) continue;
    vigencias.set(x.vigencia_fim, [...(vigencias.get(x.vigencia_fim) ?? []), porId.get(x.emenda_id)!.numero]);
  }
  for (const [data, numeros] of vigencias) {
    const ns = numeros.sort((a, b) => a - b);
    prazos.push({ dias: diasEntre(e.hoje, data), titulo: ns.length === 1 ? "Vigência do termo termina" : `Vigência de ${ns.length} termos termina`, detalhe: `Emenda${ns.length > 1 ? "s" : ""} ${ns.slice(0, 4).join(", ")}${ns.length > 4 ? "…" : ""}` });
  }
  if (e.prazoExequibilidade) {
    const d = diasEntre(e.hoje, e.prazoExequibilidade);
    if (d >= 0 && d <= 60) prazos.push({ dias: d, titulo: "Prazo de exequibilidade", detalhe: "pareceres das secretarias sobre as emendas" });
  }
  const diasFim = diasEntre(e.hoje, fim);
  if (diasFim >= 0) prazos.push({ dias: diasFim, titulo: `Fim do exercício de ${e.ano}`, detalhe: "o que não for pago vira restos a pagar" });
  prazos.sort((a, b) => a.dias - b.dias);

  const centavo = 0.005;
  const semEmp = Math.max(0, total - empenhado);
  const meta: MetaExercicio = {
    aprovado: total,
    pago,
    restosAPagar: aPagar,
    semEmpenho: semEmp,
    faltaPagar: Math.max(0, total - pago),
    dentroDaLei: Math.min(total, pago + aPagar),
    fracaoPago: total > 0 ? Math.min(1, pago / total) : 0,
    fracaoDentroDaLei: total > 0 ? Math.min(1, (pago + aPagar) / total) : 0,
    atingida: total > 0 && semEmp < centavo,
    tetoRestos: e.tetoRestos ?? null,
    tetoRestosDescricao: e.tetoRestosDescricao ?? null,
    minimoAPagar: e.tetoRestos == null ? null : Math.max(0, Math.max(0, total - pago) - e.tetoRestos),
    pendentes: vereadores.filter((v) => v.semEmpenhar >= centavo).map((v) => ({ id: v.id, numero: v.numero, nome: v.nome, semEmpenho: v.semEmpenhar })).sort((a, b) => b.semEmpenho - a.semEmpenho),
    vereadoresOk: vereadores.filter((v) => v.semEmpenhar < centavo).length,
    vereadoresTotal: vereadores.length,
  };

  return {
    meta,
    quantidade: ativas.length,
    total,
    empenhado,
    pago,
    aPagar,
    semEmpenhar,
    situacoes,
    comPendencia,
    impedidas,
    remanejadas,
    tipos,
    atencao,
    curva,
    funil,
    gargalo,
    vereadores,
    saude,
    secretarias,
    atividade,
    prazos: prazos.slice(0, 5),
  };
}
