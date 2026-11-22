/**
 * Cálculos do Painel de abertura do módulo Frotas (tudo puro, sobre o que a RLS já liberou para a pessoa): quanto dinheiro está
 * parado em cada etapa da manutenção, NFs de combustível em andamento, o que precisa de atenção, etapas, quinzena, custo ×
 * valor do veículo, a frota por vínculo e secretaria, gasto por mês e os últimos movimentos. A página só carrega os dados e o
 * componente só desenha. Os limites (dias, percentuais) vêm de `frotas.parametros`.
 */

import { calcularAlertas, calcularPainel, custoPorVeiculo } from "@/lib/frotas/analise";
import { resumirRevisao, revisarVeiculos } from "@/lib/frotas/revisao";
import {
  custoManutencao,
  dataDoCusto,
  diasEntre,
  nivelPorDias,
  quinzenaAnterior,
  quinzenaDe,
  situacaoManutencao,
  situacaoNota,
  subtrairMeses,
  type NivelAlerta,
} from "@/lib/frotas/regras";
import type { Manutencao, NotaCombustivel, ParametrosFrotas, SecretariaFrotas, Veiculo } from "@/types/frotas";

export type EntradaPainelFrotas = {
  hoje: string;
  veiculos: Veiculo[];
  manutencoes: Manutencao[];
  notas: NotaCombustivel[];
  secretarias: SecretariaFrotas[];
  params: ParametrosFrotas;
};

export type Gravidade = "alta" | "media" | "info";
export type ItemAtencao = { chave: string; titulo: string; detalhe: string; quantidade: number; gravidade: Gravidade; href: string };
export type Segmento = { chave: string; nome: string; valor: number; quantidade: number; cor: string };
export type CartaoHero = { chave: string; nome: string; quantidade: number; apoio: string; cor: string; href: string; alerta: boolean };
export type LinhaEtapa = { chave: string; nome: string; sub: string; quantidade: number; valor: number | null; cor: string; alerta: boolean; nota: string; href: string };
export type LinhaCustoPainel = { id: string; placa: string; modelo: string; custo12m: number; valorFipe: number; pct: number; nivel: NivelAlerta };
export type MesGasto = { referencia: string; rotulo: string; manutencao: number; combustivel: number };
export type Movimento = { tipo: "nf" | "oc" | "liberado" | "orcamento" | "alerta" | "contabilidade"; texto: string; detalhe: string; data: string; quando: string; href: string };

export type PainelFrotas = {
  veiculos: { total: number; proprio: number; convenio: number; alugado: number; revisar: number; semValor: number };
  /** Dinheiro e quantidade das manutenções em aberto (orçamento a analisar até NF registrada). */
  emAberto: { valor: number; manutencoes: number; nfs: number; tempoMedio: number | null };
  segmentos: Segmento[];
  cartoes: CartaoHero[];
  atencao: ItemAtencao[];
  manutEtapas: LinhaEtapa[];
  combEtapas: LinhaEtapa[];
  quinzena: { rotulo: string; inicio: string; recebidas: number; esperadas: number; semNf: string[] };
  custos: LinhaCustoPainel[];
  acimaDoLimite: number;
  porSecretaria: { nome: string; quantidade: number; id: string }[];
  meses: MesGasto[];
  movimentos: Movimento[];
  limites: { diasAtencao: number; diasCritico: number; pctAtencao: number; pctCritico: number };
};

const COR = {
  analisar: "#8DB3FF",
  liberado: "#6B4FBB",
  oc: "#E9A63B",
  nf: "#34D399",
  concluida: "#94A3B8",
  secretaria: "#F2B35E",
} as const;

const ROTULO_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "hoje", "ontem" ou "há N dias" (o banco guarda a data, não a hora). */
export function quandoFoi(data: string, hoje: string): string {
  const d = diasEntre(data, hoje);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

function termoDias(n: number): string {
  return n === 1 ? "1 dia" : `${n} dias`;
}

export function montarPainelFrotas(entrada: EntradaPainelFrotas): PainelFrotas {
  const { hoje, veiculos, manutencoes, notas, secretarias, params } = entrada;
  const painel = calcularPainel(entrada);
  const nomeSecretaria = new Map(secretarias.map((s) => [s.id, s.nome]));
  const porVeiculo = new Map(veiculos.map((v) => [v.id, v]));
  const nomeVeiculo = (id: string) => porVeiculo.get(id)?.placa ?? porVeiculo.get(id)?.modelo ?? "veículo";

  // ------------------------------------------------------------------ manutenção em aberto, por etapa
  const comSituacao = manutencoes.map((m) => ({ m, s: situacaoManutencao(m) }));
  const valorDa = (m: Manutencao): number => custoManutencao(m) ?? m.orcamento_valor;
  type Chave = "a_analisar" | "liberada" | "oc_emitida" | "nf_registrada";
  const etapasAbertas: Chave[] = ["a_analisar", "liberada", "oc_emitida", "nf_registrada"];
  const nomeEtapa: Record<Chave, { nome: string; sub: string; cor: string }> = {
    a_analisar: { nome: "Orçamento", sub: "a analisar", cor: COR.analisar },
    liberada: { nome: "Liberado", sub: "sem OC no IPM", cor: COR.liberado },
    oc_emitida: { nome: "OC emitida", sub: "aguarda a NF", cor: COR.oc },
    nf_registrada: { nome: "NF registrada", sub: "a enviar", cor: COR.nf },
  };
  const abertas = comSituacao.filter(({ s }) => (etapasAbertas as string[]).includes(s.etapa));
  const porEtapa = (c: Chave) => abertas.filter(({ s }) => s.etapa === c);
  const soma = (l: { m: Manutencao }[]) => l.reduce((a, { m }) => a + valorDa(m), 0);
  const alertaEm = (l: { s: { desde: string } }[]) => l.filter(({ s }) => nivelPorDias(diasEntre(s.desde, hoje), params) !== "ok").length;

  const segmentos: Segmento[] = etapasAbertas.map((c) => ({
    chave: c,
    nome: c === "a_analisar" ? "Orçamento a analisar" : c === "liberada" ? "Liberado, sem OC" : c === "oc_emitida" ? "OC emitida, sem NF" : "NF, a enviar à Contabilidade",
    valor: soma(porEtapa(c)),
    quantidade: porEtapa(c).length,
    cor: nomeEtapa[c].cor,
  }));

  // ------------------------------------------------------------------ NFs de combustível
  const notasComSituacao = notas.map((n) => ({ n, s: situacaoNota(n) }));
  const nfsEmAndamento = notasComSituacao.filter(({ s }) => s.etapa !== "na_contabilidade");
  const diasParadas = [...abertas.map(({ s }) => diasEntre(s.desde, hoje)), ...nfsEmAndamento.map(({ s }) => diasEntre(s.desde, hoje))];
  const tempoMedio = diasParadas.length ? Math.round(diasParadas.reduce((a, b) => a + b, 0) / diasParadas.length) : null;

  const c = painel.cartoes;
  const nfsAssinadas = notasComSituacao.filter(({ s }) => s.etapa === "assinada").length;
  const cartoes: CartaoHero[] = [
    {
      chave: "orcamentos",
      nome: "Orçamentos a analisar",
      quantidade: c.orcamentos,
      apoio: c.orcamentoMaisAntigo !== null ? `o mais antigo espera há ${termoDias(c.orcamentoMaisAntigo)}` : "nenhum esperando",
      cor: COR.analisar,
      href: "/frotas/manutencao?sit=a_analisar",
      alerta: alertaEm(porEtapa("a_analisar")) > 0,
    },
    {
      chave: "aguardando_nf",
      nome: "Aguardando a NF",
      quantidade: c.manutAguardandoNf,
      apoio: c.manutAguardandoNfComAlerta ? `${c.manutAguardandoNfComAlerta} com ${params.dias_atencao} dias ou mais` : "nenhuma com alerta",
      cor: COR.oc,
      href: "/frotas/manutencao?sit=aguardando",
      alerta: c.manutAguardandoNfComAlerta > 0,
    },
    {
      chave: "nfs_secretaria",
      nome: "NFs com a secretaria",
      quantidade: c.nfsAguardando,
      apoio: c.nfsAguardandoComAlerta ? `${c.nfsAguardandoComAlerta} com ${params.dias_atencao} dias ou mais` : "nenhuma com alerta",
      cor: COR.secretaria,
      href: "/frotas/combustivel?sit=com_secretaria",
      alerta: c.nfsAguardandoComAlerta > 0,
    },
    {
      chave: "contabilidade",
      nome: "A enviar à Contabilidade",
      quantidade: c.paraContabilidade,
      apoio: `${nfsAssinadas} ${nfsAssinadas === 1 ? "NF" : "NFs"} · ${porEtapa("nf_registrada").length} ${porEtapa("nf_registrada").length === 1 ? "manutenção" : "manutenções"}`,
      cor: COR.nf,
      href: "/frotas/combustivel?sit=assinada",
      alerta: false,
    },
  ];

  // ------------------------------------------------------------------ etapas
  const concluidasRecentes = comSituacao.filter(({ s }) => s.etapa === "concluida" && diasEntre(s.desde, hoje) <= 30);
  const manutEtapas: LinhaEtapa[] = [
    ...etapasAbertas.map((ch): LinhaEtapa => {
      const l = porEtapa(ch);
      const alertas = alertaEm(l);
      return {
        chave: ch,
        nome: nomeEtapa[ch].nome,
        sub: nomeEtapa[ch].sub,
        quantidade: l.length,
        valor: soma(l),
        cor: nomeEtapa[ch].cor,
        alerta: alertas > 0,
        nota: alertas > 0 ? `${alertas} ${alertas === 1 ? "parada" : "paradas"} há ${params.dias_atencao} dias ou mais` : "",
        href: ch === "a_analisar" ? "/frotas/manutencao?sit=a_analisar" : ch === "oc_emitida" ? "/frotas/manutencao?sit=aguardando" : "/frotas/manutencao",
      };
    }),
    {
      chave: "concluida",
      nome: "Concluídas",
      sub: "últimos 30 dias",
      quantidade: concluidasRecentes.length,
      valor: soma(concluidasRecentes),
      cor: COR.concluida,
      alerta: false,
      nota: "",
      href: "/frotas/manutencao?sit=concluidas",
    },
  ];
  const nfDesde = (e: "recebida" | "com_secretaria" | "assinada") => notasComSituacao.filter(({ s }) => s.etapa === e);
  const alertaNf = (e: "recebida" | "com_secretaria" | "assinada") => nfDesde(e).filter(({ s }) => nivelPorDias(diasEntre(s.desde, hoje), params) !== "ok").length;
  const nfsNaContabilidade = notasComSituacao.filter(({ s }) => s.etapa === "na_contabilidade" && diasEntre(s.desde, hoje) <= 30);
  const valorNf = (l: { n: NotaCombustivel }[]) => l.reduce((a, { n }) => a + n.valor, 0);
  const linhaNf = (chave: "recebida" | "com_secretaria" | "assinada", nome: string, sub: string, cor: string, href: string): LinhaEtapa => ({
    chave,
    nome,
    sub,
    quantidade: nfDesde(chave).length,
    valor: valorNf(nfDesde(chave)),
    cor,
    alerta: alertaNf(chave) > 0,
    nota: alertaNf(chave) > 0 ? `${alertaNf(chave)} há ${params.dias_atencao} dias ou mais` : "",
    href,
  });
  const combEtapas: LinhaEtapa[] = [
    linhaNf("recebida", "Recebida", "a enviar à secretaria", "#B8C4D6", "/frotas/combustivel?sit=recebida"),
    linhaNf("com_secretaria", "Com a secretaria", "aguarda assinatura", COR.secretaria, "/frotas/combustivel?sit=com_secretaria"),
    linhaNf("assinada", "Assinada", "a enviar à Contabilidade", COR.nf, "/frotas/combustivel?sit=assinada"),
    {
      chave: "na_contabilidade",
      nome: "Na Contabilidade",
      sub: "últimos 30 dias",
      quantidade: nfsNaContabilidade.length,
      valor: valorNf(nfsNaContabilidade),
      cor: COR.concluida,
      alerta: false,
      nota: "",
      href: "/frotas/combustivel?sit=na_contabilidade",
    },
  ];

  // ------------------------------------------------------------------ revisão e cadastro
  const avisos = revisarVeiculos(veiculos);
  const revisar = resumirRevisao(veiculos, avisos).reduce((a, r) => a + r.n, 0);
  const semValor = veiculos.filter((v) => v.vinculo !== "alugado" && v.classificacao !== "maquina" && (!v.valor_referencia || v.valor_referencia <= 0)).length;
  const contaVinculo = (v: Veiculo["vinculo"]) => veiculos.filter((x) => x.vinculo === v).length;

  // ------------------------------------------------------------------ custo × valor
  const custos = custoPorVeiculo(entrada);
  const criticos = custos.filter((x) => x.nivel === "critico").length;
  const soAtencao = custos.filter((x) => x.nivel === "atencao").length;
  const alertas = calcularAlertas(entrada);
  const quantosDo = (codigo: string) => alertas.find((a) => a.codigo === codigo)?.itens.length ?? 0;
  const nfAcimaOc = quantosDo("nf_acima_oc");

  // ------------------------------------------------------------------ atenção
  const q = painel.quinzena;
  const atencao: ItemAtencao[] = [];
  const add = (i: ItemAtencao) => {
    if (i.quantidade > 0) atencao.push(i);
  };
  add({ chave: "nf_acima_oc", titulo: "NF acima do valor da OC", detalhe: "conferir a diferença com a oficina antes de pagar", quantidade: nfAcimaOc, gravidade: "alta", href: "/frotas/manutencao?sit=andamento" });
  add({ chave: "fipe_critico", titulo: "Veículos acima do limite do valor FIPE", detalhe: `manutenção acima de ${params.pct_critico}% do valor em 12 meses`, quantidade: criticos, gravidade: "alta", href: "/frotas/analise" });
  add({ chave: "sem_nf_quinzena", titulo: "Secretarias sem NF na quinzena", detalhe: q.esperadas ? `${q.rotulo}: ${q.semNf.length} de ${q.esperadas} não entregaram` : "", quantidade: q.semNf.length, gravidade: "media", href: `/frotas/combustivel?quinz=${painelQuinzenaInicio(entrada)}` });
  add({ chave: "nf_secretaria", titulo: "NFs há muito tempo com a secretaria", detalhe: `cobrar a devolução assinada (${params.dias_atencao} dias ou mais)`, quantidade: c.nfsAguardandoComAlerta, gravidade: "media", href: "/frotas/combustivel?sit=com_secretaria" });
  add({ chave: "manut_sem_nf", titulo: "Manutenção sem NF além do prazo", detalhe: `OC emitida há ${params.dias_atencao} dias ou mais`, quantidade: c.manutAguardandoNfComAlerta, gravidade: "media", href: "/frotas/manutencao?sit=aguardando" });
  add({ chave: "orcamento_parado", titulo: "Orçamentos esperando análise", detalhe: c.orcamentoMaisAntigo !== null ? `o mais antigo há ${termoDias(c.orcamentoMaisAntigo)}` : "", quantidade: alertaEm(porEtapa("a_analisar")), gravidade: "media", href: "/frotas/manutencao?sit=a_analisar" });
  add({ chave: "fipe_atencao", titulo: "Veículos perto do limite do valor FIPE", detalhe: `manutenção acima de ${params.pct_atencao}% do valor em 12 meses`, quantidade: soAtencao, gravidade: "media", href: "/frotas/analise" });
  add({ chave: "orcamento_acima_media", titulo: "Orçamento acima da média", detalhe: `${params.orcamento_acima_pct}% acima de serviços parecidos`, quantidade: quantosDo("orcamento_acima_media"), gravidade: "media", href: "/frotas/manutencao?sit=a_analisar" });
  add({ chave: "reincidencia", titulo: "Veículos que voltam à oficina", detalhe: `${params.reincidencia_qtd} ou mais manutenções em ${params.reincidencia_meses} meses`, quantidade: quantosDo("reincidencia"), gravidade: "info", href: "/frotas/analise" });
  add({ chave: "combustivel_alto", titulo: "Combustível acima da média", detalhe: `secretarias ${params.combustivel_acima_pct}% acima das últimas quinzenas`, quantidade: quantosDo("combustivel_acima_media"), gravidade: "info", href: "/frotas/analise" });
  add({ chave: "inativo_gasto", titulo: "Veículo inativo com gasto", detalhe: `nos últimos ${params.inativo_dias} dias`, quantidade: quantosDo("inativo_com_gasto"), gravidade: "info", href: "/frotas/analise" });
  add({ chave: "sem_fipe", titulo: "Veículos sem valor de referência", detalhe: "vincular à FIPE ou digitar o valor", quantidade: semValor, gravidade: "info", href: "/frotas/custos" });
  add({ chave: "revisar", titulo: "Cadastro para revisar", detalhe: "placa repetida, patrimônio fora do padrão…", quantidade: revisar, gravidade: "info", href: "/frotas/veiculos?rev=1" });
  const ordem = { alta: 0, media: 1, info: 2 } as const;
  atencao.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);

  // ------------------------------------------------------------------ frota por secretaria
  const contagemSec = new Map<string, number>();
  for (const v of veiculos) contagemSec.set(v.secretaria_id, (contagemSec.get(v.secretaria_id) ?? 0) + 1);
  const porSecretaria = [...contagemSec]
    .map(([id, quantidade]) => ({ id, nome: nomeSecretaria.get(id) ?? "—", quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);

  // ------------------------------------------------------------------ gasto por mês (12 meses, até o mês corrente)
  const refAtual = `${hoje.slice(0, 7)}-01`;
  const meses: MesGasto[] = Array.from({ length: 12 }, (_, i) => {
    const ref = subtrairMeses(refAtual, 11 - i).slice(0, 7);
    return { referencia: ref, rotulo: ROTULO_MES[Number(ref.slice(5, 7)) - 1], manutencao: 0, combustivel: 0 };
  });
  const mes = new Map(meses.map((m) => [m.referencia, m]));
  for (const m of manutencoes) {
    const custo = custoManutencao(m);
    if (custo === null) continue;
    const alvo = mes.get(dataDoCusto(m).slice(0, 7));
    if (alvo) alvo.manutencao += custo;
  }
  for (const n of notas) {
    const alvo = mes.get(n.periodo_inicio.slice(0, 7));
    if (alvo) alvo.combustivel += n.valor;
  }

  // ------------------------------------------------------------------ últimos movimentos (vêm das datas gravadas em cada registro)
  const mov: Movimento[] = [];
  const addMov = (tipo: Movimento["tipo"], data: string | null | undefined, texto: string, detalhe: string, href: string) => {
    if (data) mov.push({ tipo, texto, detalhe, data, quando: quandoFoi(data, hoje), href });
  };
  for (const n of notas) {
    const sec = nomeSecretaria.get(n.secretaria_id) ?? "—";
    const href = `/frotas/combustivel?editar=${n.id}`;
    addMov("nf", n.data_emissao, `NF ${n.numero_nf} recebida`, `${sec} · combustível ${formatarValor(n.valor)}`, href);
    addMov("nf", n.enviada_secretaria_em, `NF ${n.numero_nf} enviada à secretaria`, sec, href);
    addMov("liberado", n.retornou_em, `NF ${n.numero_nf} devolvida assinada`, sec, href);
    addMov("contabilidade", n.enviada_contabilidade_em, `NF ${n.numero_nf} enviada à Contabilidade`, sec, href);
  }
  for (const m of manutencoes) {
    const sec = nomeSecretaria.get(m.secretaria_id) ?? "—";
    const href = `/frotas/manutencao?id=${m.id}`;
    const base = `${nomeVeiculo(m.veiculo_id)} · ${m.servico}`;
    addMov("orcamento", m.orcamento_recebido_em, "Orçamento recebido", `${base} · ${sec} · ${formatarValor(m.orcamento_valor)}`, href);
    if (m.status_analise === "liberado") addMov("liberado", m.analisado_em, "Orçamento liberado", `${base} · ${sec}`, href);
    if (m.status_analise === "recusado") addMov("alerta", m.analisado_em, "Orçamento recusado", `${base} · ${sec}`, href);
    addMov("oc", m.oc_emitida_em, `OC ${m.oc_numero ?? ""} emitida`.replace("  ", " "), `${base} · ${sec}`, href);
    addMov("nf", m.nf_emissao, `NF ${m.nf_numero ?? ""} da oficina registrada`.replace("  ", " "), `${base} · ${sec}`, href);
    addMov("contabilidade", m.enviada_contabilidade_em, "Manutenção enviada à Contabilidade", `${base} · ${sec}`, href);
  }
  mov.sort((a, b) => b.data.localeCompare(a.data));

  return {
    veiculos: { total: veiculos.length, proprio: contaVinculo("proprio"), convenio: contaVinculo("convenio"), alugado: contaVinculo("alugado"), revisar, semValor },
    emAberto: { valor: segmentos.reduce((a, s) => a + s.valor, 0), manutencoes: abertas.length, nfs: nfsEmAndamento.length, tempoMedio },
    segmentos,
    cartoes,
    atencao,
    manutEtapas,
    combEtapas,
    quinzena: { rotulo: q.rotulo, inicio: painelQuinzenaInicio(entrada), recebidas: q.recebidas, esperadas: q.esperadas, semNf: q.semNf },
    custos: custos.slice(0, 6).map((l) => ({ id: l.veiculo.id, placa: l.veiculo.placa ?? "Sem placa", modelo: l.veiculo.modelo, custo12m: l.custo12m, valorFipe: l.valor, pct: l.pct12m, nivel: l.nivel })),
    acimaDoLimite: criticos + soAtencao,
    porSecretaria,
    meses,
    movimentos: mov.slice(0, 6),
    limites: { diasAtencao: params.dias_atencao, diasCritico: params.dias_critico, pctAtencao: params.pct_atencao, pctCritico: params.pct_critico },
  };
}

function formatarValor(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Início (AAAA-MM-DD) da quinzena anterior, a que o painel confere. */
function painelQuinzenaInicio({ hoje }: EntradaPainelFrotas): string {
  return quinzenaAnterior(quinzenaDe(hoje)).inicio;
}
