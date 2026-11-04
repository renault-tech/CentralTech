/**
 * Análise da frota e painel de pendências — funções puras sobre as listas que
 * a RLS liberou. Os limites (dias, percentuais) vêm de `frotas.parametros`.
 */

import {
  chaveServico,
  custoManutencao,
  dataDoCusto,
  diasEntre,
  nivelPorDias,
  nivelPorPercentual,
  quinzenaAnterior,
  quinzenaDe,
  quinzenasRecentes,
  situacaoManutencao,
  situacaoNota,
  somarDias,
  subtrairMeses,
  type NivelAlerta,
} from "@/lib/frotas/regras";
import type { Manutencao, NotaCombustivel, ParametrosFrotas, SecretariaFrotas, Veiculo } from "@/types/frotas";

type Entrada = {
  hoje: string;
  veiculos: Veiculo[];
  manutencoes: Manutencao[];
  notas: NotaCombustivel[];
  secretarias: SecretariaFrotas[];
  params: ParametrosFrotas;
};

// ------------------------------------------------------------- custo × valor do veículo

export type Parecer = "normal" | "atencao" | "avaliar_baixa";

export type LinhaCusto = {
  veiculo: Veiculo;
  valor: number;
  custo12m: number;
  custoTotal: number;
  pct12m: number;
  nivel: NivelAlerta;
  parecer: Parecer;
};

export const ROTULO_PARECER: Record<Parecer, string> = {
  normal: "Normal",
  atencao: "Atenção",
  avaliar_baixa: "Avaliar baixa ou troca",
};

/** Só entra quem tem valor de referência e não é alugado (o valor de um alugado não é da Prefeitura). */
export function custoPorVeiculo({ hoje, veiculos, manutencoes, params }: Entrada): LinhaCusto[] {
  const limite = subtrairMeses(hoje, 12);
  const totais = new Map<string, { total: number; ano: number }>();
  for (const m of manutencoes) {
    const custo = custoManutencao(m);
    if (custo === null) continue;
    const t = totais.get(m.veiculo_id) ?? { total: 0, ano: 0 };
    t.total += custo;
    if (dataDoCusto(m) >= limite) t.ano += custo;
    totais.set(m.veiculo_id, t);
  }

  const linhas: LinhaCusto[] = [];
  for (const v of veiculos) {
    if (v.vinculo === "alugado" || !v.valor_referencia || v.valor_referencia <= 0) continue;
    const t = totais.get(v.id);
    if (!t || t.total === 0) continue;
    const pct12m = (t.ano / v.valor_referencia) * 100;
    const nivel = nivelPorPercentual(pct12m, params);
    linhas.push({
      veiculo: v,
      valor: v.valor_referencia,
      custo12m: t.ano,
      custoTotal: t.total,
      pct12m,
      nivel,
      parecer: nivel === "critico" ? "avaliar_baixa" : nivel === "atencao" ? "atencao" : "normal",
    });
  }
  return linhas.sort((a, b) => b.pct12m - a.pct12m);
}

// ------------------------------------------------------------- gasto por secretaria

export type GastoSecretaria = { id: string; nome: string; manutencao: number; combustivel: number };

export function gastoPorSecretaria({ hoje, manutencoes, notas, secretarias }: Entrada): GastoSecretaria[] {
  const limite = subtrairMeses(hoje, 12);
  const mapa = new Map<string, GastoSecretaria>(secretarias.map((s) => [s.id, { id: s.id, nome: s.nome, manutencao: 0, combustivel: 0 }]));
  for (const n of notas) {
    if (n.periodo_inicio < limite) continue;
    const g = mapa.get(n.secretaria_id);
    if (g) g.combustivel += n.valor;
  }
  for (const m of manutencoes) {
    const custo = custoManutencao(m);
    if (custo === null || dataDoCusto(m) < limite) continue;
    const g = mapa.get(m.secretaria_id);
    if (g) g.manutencao += custo;
  }
  return [...mapa.values()].filter((g) => g.manutencao + g.combustivel > 0).sort((a, b) => b.manutencao + b.combustivel - (a.manutencao + a.combustivel));
}

// ------------------------------------------------------------- alertas automáticos

export type Alerta = {
  codigo:
    | "pct_atencao"
    | "pct_critico"
    | "inativo_com_gasto"
    | "orcamento_acima_media"
    | "reincidencia"
    | "sem_nf_quinzena"
    | "combustivel_acima_media";
  texto: string;
  nivel: Exclude<NivelAlerta, "ok">;
  itens: string[];
};

const nomeVeiculo = (v: Veiculo | undefined) => v?.placa ?? v?.modelo ?? "veículo";

export function calcularAlertas(entrada: Entrada): Alerta[] {
  const { hoje, veiculos, manutencoes, notas, secretarias, params } = entrada;
  const porId = new Map(veiculos.map((v) => [v.id, v]));
  const alertas: Alerta[] = [];

  // Manutenção acima de X% / Y% do valor do veículo.
  const custos = custoPorVeiculo(entrada);
  const critico = custos.filter((c) => c.nivel === "critico");
  const atencao = custos.filter((c) => c.nivel === "atencao");
  if (atencao.length + critico.length > 0) {
    alertas.push({
      codigo: "pct_atencao",
      texto: `Manutenção acima de ${params.pct_atencao}% do valor do veículo`,
      nivel: "atencao",
      itens: [...critico, ...atencao].map((c) => nomeVeiculo(c.veiculo)),
    });
  }
  if (critico.length > 0) {
    alertas.push({
      codigo: "pct_critico",
      texto: `Manutenção acima de ${params.pct_critico}% do valor do veículo`,
      nivel: "critico",
      itens: critico.map((c) => nomeVeiculo(c.veiculo)),
    });
  }

  // Veículo inativo/baixado com gasto recente.
  const desde = somarDias(hoje, -params.inativo_dias);
  const inativosComGasto = new Set<string>();
  for (const m of manutencoes) {
    const v = porId.get(m.veiculo_id);
    if (!v || (v.situacao !== "inativo" && v.situacao !== "baixado")) continue;
    if (custoManutencao(m) !== null && dataDoCusto(m) >= desde) inativosComGasto.add(nomeVeiculo(v));
  }
  if (inativosComGasto.size > 0) {
    alertas.push({
      codigo: "inativo_com_gasto",
      texto: `Veículo inativo com gasto nos últimos ${params.inativo_dias} dias`,
      nivel: "atencao",
      itens: [...inativosComGasto],
    });
  }

  // Orçamento acima da média de serviços parecidos (mesmo serviço, últimos 12 meses, ao menos 2 amostras).
  const limite12 = subtrairMeses(hoje, 12);
  const amostras = new Map<string, number[]>();
  for (const m of manutencoes) {
    const custo = custoManutencao(m);
    if (custo === null || dataDoCusto(m) < limite12) continue;
    const k = chaveServico(m.servico);
    amostras.set(k, [...(amostras.get(k) ?? []), custo]);
  }
  const acimaDaMedia: string[] = [];
  for (const m of manutencoes) {
    if (m.status_analise !== "a_analisar") continue;
    const lista = amostras.get(chaveServico(m.servico));
    if (!lista || lista.length < 2) continue;
    const media = lista.reduce((a, b) => a + b, 0) / lista.length;
    if (m.orcamento_valor > media * (1 + params.orcamento_acima_pct / 100)) acimaDaMedia.push(`${nomeVeiculo(porId.get(m.veiculo_id))} · ${m.servico}`);
  }
  if (acimaDaMedia.length > 0) {
    alertas.push({
      codigo: "orcamento_acima_media",
      texto: `Orçamento ${params.orcamento_acima_pct}% acima da média de serviços parecidos`,
      nivel: "atencao",
      itens: acimaDaMedia,
    });
  }

  // Muitas manutenções do mesmo veículo em pouco tempo.
  const desdeReincidencia = subtrairMeses(hoje, params.reincidencia_meses);
  const contagem = new Map<string, number>();
  for (const m of manutencoes) {
    if (custoManutencao(m) === null || dataDoCusto(m) < desdeReincidencia) continue;
    contagem.set(m.veiculo_id, (contagem.get(m.veiculo_id) ?? 0) + 1);
  }
  const reincidentes = [...contagem].filter(([, n]) => n >= params.reincidencia_qtd).map(([id]) => nomeVeiculo(porId.get(id)));
  if (reincidentes.length > 0) {
    alertas.push({
      codigo: "reincidencia",
      texto: `Veículo com ${params.reincidencia_qtd} ou mais manutenções em ${params.reincidencia_meses} meses`,
      nivel: "atencao",
      itens: reincidentes,
    });
  }

  // Secretaria sem NF na quinzena anterior.
  const anterior = quinzenaAnterior(quinzenaDe(hoje));
  const semNf = secretariasSemNf(secretarias, notas, anterior.inicio);
  if (semNf.length > 0) {
    alertas.push({
      codigo: "sem_nf_quinzena",
      texto: "Secretaria sem NF de combustível na quinzena",
      nivel: "critico",
      itens: semNf.map((s) => s.nome),
    });
  }

  // Combustível da secretaria bem acima da média das quinzenas anteriores.
  const acima = secretariasComCombustivelAlto(entrada);
  if (acima.length > 0) {
    alertas.push({
      codigo: "combustivel_acima_media",
      texto: `Combustível ${params.combustivel_acima_pct}% acima da média das últimas quinzenas`,
      nivel: "atencao",
      itens: acima,
    });
  }

  return alertas;
}

/** Secretarias que deveriam ter NF na quinzena que começa em `inicio` e não têm. */
export function secretariasSemNf(secretarias: SecretariaFrotas[], notas: NotaCombustivel[], inicio: string): SecretariaFrotas[] {
  const comNf = new Set(notas.filter((n) => n.periodo_inicio === inicio).map((n) => n.secretaria_id));
  return secretarias.filter((s) => s.ativa && s.controla_combustivel && !comNf.has(s.id));
}

function secretariasComCombustivelAlto({ hoje, notas, secretarias, params }: Entrada): string[] {
  const quinzenas = quinzenasRecentes(quinzenaAnterior(quinzenaDe(hoje)).inicio, 7); // a última fechada + 6 antes
  const alvo = quinzenas[0];
  const anteriores = quinzenas.slice(1);
  const nomes: string[] = [];
  for (const s of secretarias) {
    if (!s.ativa || !s.controla_combustivel) continue;
    const total = (inicio: string) => notas.filter((n) => n.secretaria_id === s.id && n.periodo_inicio === inicio).reduce((a, n) => a + n.valor, 0);
    const atual = total(alvo.inicio);
    const historico = anteriores.map((q) => total(q.inicio)).filter((t) => t > 0);
    if (atual === 0 || historico.length < 3) continue;
    const media = historico.reduce((a, b) => a + b, 0) / historico.length;
    if (atual > media * (1 + params.combustivel_acima_pct / 100)) nomes.push(s.nome);
  }
  return nomes;
}

// ------------------------------------------------------------- indicadores

export type Indicadores = {
  manutencao12m: number;
  combustivel12m: number;
  acimaAtencao: number;
  acimaCritico: number;
  idadeMedia: number | null;
};

export function calcularIndicadores(entrada: Entrada): Indicadores {
  const { hoje, veiculos } = entrada;
  const gastos = gastoPorSecretaria(entrada);
  const custos = custoPorVeiculo(entrada);
  const ano = Number(hoje.slice(0, 4));
  const idades = veiculos
    .filter((v) => v.vinculo === "proprio" && (v.ano_modelo ?? v.ano_fabricacao) !== null)
    .map((v) => ano - (v.ano_modelo ?? v.ano_fabricacao ?? ano));
  return {
    manutencao12m: gastos.reduce((a, g) => a + g.manutencao, 0),
    combustivel12m: gastos.reduce((a, g) => a + g.combustivel, 0),
    acimaAtencao: custos.filter((c) => c.nivel !== "ok").length,
    acimaCritico: custos.filter((c) => c.nivel === "critico").length,
    idadeMedia: idades.length ? idades.reduce((a, b) => a + b, 0) / idades.length : null,
  };
}

// ------------------------------------------------------------- painel de pendências

export type ItemPendencia = {
  id: string;
  secretaria: string;
  referencia: string;
  veiculo?: string;
  data: string;
  dias: number;
  nivel: NivelAlerta;
  rotulo?: string;
  etapa?: string;
  valor?: number;
};

export type Painel = {
  cartoes: { nfsEmAndamento: number; nfsAguardando: number; nfsAguardandoComAlerta: number; manutComOc: number; manutAguardandoNf: number; manutAguardandoNfComAlerta: number; orcamentos: number; orcamentoMaisAntigo: number | null; paraContabilidade: number };
  nfsAguardando: ItemPendencia[];
  manutencoesAguardando: ItemPendencia[];
  orcamentos: ItemPendencia[];
  quinzena: { rotulo: string; recebidas: number; esperadas: number; semNf: string[] };
  alertasCusto: LinhaCusto[];
};

export function calcularPainel(entrada: Entrada): Painel {
  const { hoje, veiculos, manutencoes, notas, secretarias, params } = entrada;
  const nomeSecretaria = new Map(secretarias.map((s) => [s.id, s.nome]));
  const porVeiculo = new Map(veiculos.map((v) => [v.id, v]));
  const descreveVeiculo = (id: string) => {
    const v = porVeiculo.get(id);
    return v ? `${v.placa ?? "Sem placa"} · ${v.modelo}` : "Veículo removido";
  };

  const comSituacao = notas.map((n) => ({ n, s: situacaoNota(n) }));
  const nfsAguardando: ItemPendencia[] = comSituacao
    .filter(({ s }) => s.etapa === "com_secretaria")
    .map(({ n, s }) => {
      const dias = diasEntre(s.desde, hoje);
      return { id: n.id, secretaria: nomeSecretaria.get(n.secretaria_id) ?? "—", referencia: n.numero_nf, data: s.desde, dias, nivel: nivelPorDias(dias, params) };
    })
    .sort((a, b) => b.dias - a.dias);

  const emAndamento = manutencoes.map((m) => ({ m, s: situacaoManutencao(m) })).filter(({ s }) => s.emAndamento);
  const manutencoesAguardando: ItemPendencia[] = emAndamento
    .filter(({ s }) => s.etapa === "aguardando_nf" || s.etapa === "aguardando_docs")
    .map(({ m, s }) => {
      const dias = diasEntre(s.desde, hoje);
      return {
        id: m.id,
        secretaria: nomeSecretaria.get(m.secretaria_id) ?? "—",
        referencia: m.oc_numero ?? "—",
        veiculo: descreveVeiculo(m.veiculo_id),
        data: s.desde,
        dias,
        nivel: nivelPorDias(dias, params),
        rotulo: s.rotulo,
        etapa: s.etapa,
      };
    })
    .sort((a, b) => b.dias - a.dias);

  const orcamentos: ItemPendencia[] = emAndamento
    .filter(({ s }) => s.etapa === "a_analisar")
    .map(({ m, s }) => {
      const dias = diasEntre(s.desde, hoje);
      return {
        id: m.id,
        secretaria: nomeSecretaria.get(m.secretaria_id) ?? "—",
        referencia: m.servico,
        veiculo: descreveVeiculo(m.veiculo_id),
        data: s.desde,
        dias,
        nivel: nivelPorDias(dias, params),
        valor: m.orcamento_valor,
      };
    })
    .sort((a, b) => b.dias - a.dias);

  const anterior = quinzenaAnterior(quinzenaDe(hoje));
  const esperadas = secretarias.filter((s) => s.ativa && s.controla_combustivel);
  const semNf = secretariasSemNf(secretarias, notas, anterior.inicio);

  return {
    cartoes: {
      nfsEmAndamento: comSituacao.filter(({ s }) => s.etapa !== "na_contabilidade").length,
      nfsAguardando: nfsAguardando.length,
      nfsAguardandoComAlerta: nfsAguardando.filter((i) => i.nivel !== "ok").length,
      manutComOc: emAndamento.filter(({ m }) => !!m.oc_numero).length,
      manutAguardandoNf: emAndamento.filter(({ s }) => s.etapa === "aguardando_nf").length,
      manutAguardandoNfComAlerta: manutencoesAguardando.filter((i) => i.nivel !== "ok" && i.etapa === "aguardando_nf").length,
      orcamentos: orcamentos.length,
      orcamentoMaisAntigo: orcamentos.length ? orcamentos[0].dias : null,
      paraContabilidade:
        comSituacao.filter(({ s }) => s.etapa === "assinada").length + emAndamento.filter(({ s }) => s.etapa === "docs_retornaram").length,
    },
    nfsAguardando,
    manutencoesAguardando,
    orcamentos,
    quinzena: { rotulo: anterior.rotulo, recebidas: esperadas.length - semNf.length, esperadas: esperadas.length, semNf: semNf.map((s) => s.nome) },
    alertasCusto: custoPorVeiculo(entrada).filter((c) => c.nivel !== "ok").slice(0, 3),
  };
}

// ------------------------------------------------------------- análise de um orçamento

export type AnaliseOrcamento = {
  valorReferencia: number | null;
  fonteValor: "fipe" | "manual" | null;
  gasto12m: number;
  /** Gasto dos últimos 12 meses + este orçamento, em % do valor de referência. */
  pctComEste: number | null;
  pctEste: number | null;
  nivel: NivelAlerta;
  historico: { id: string; data: string; servico: string; valor: number }[];
  parecidos: { id: string; data: string; servico: string; valor: number; veiculo: string }[];
  mediaParecidos: number | null;
  /** % acima da média de serviços parecidos (negativo = abaixo); nulo sem amostras suficientes. */
  acimaDaMediaPct: number | null;
};

/** Os números da tela de análise de um orçamento: histórico do veículo, valor de referência e serviços parecidos na frota. */
export function analisarOrcamento(m: Manutencao, entrada: Entrada): AnaliseOrcamento {
  const { hoje, veiculos, manutencoes, params } = entrada;
  const veiculo = veiculos.find((v) => v.id === m.veiculo_id);
  const porId = new Map(veiculos.map((v) => [v.id, v]));
  const limite = subtrairMeses(hoje, 12);
  const liberadas = manutencoes.filter((x) => x.id !== m.id && custoManutencao(x) !== null && dataDoCusto(x) >= limite);

  const historico = liberadas
    .filter((x) => x.veiculo_id === m.veiculo_id)
    .map((x) => ({ id: x.id, data: dataDoCusto(x), servico: x.servico, valor: custoManutencao(x) as number }))
    .sort((a, b) => b.data.localeCompare(a.data));
  const gasto12m = historico.reduce((a, h) => a + h.valor, 0);

  const chave = chaveServico(m.servico);
  const parecidos = liberadas
    .filter((x) => x.id !== m.id && chaveServico(x.servico) === chave)
    .map((x) => ({
      id: x.id,
      data: dataDoCusto(x),
      servico: x.servico,
      valor: custoManutencao(x) as number,
      veiculo: porId.get(x.veiculo_id)?.placa ?? porId.get(x.veiculo_id)?.modelo ?? "veículo",
    }))
    .sort((a, b) => b.data.localeCompare(a.data));
  const media = parecidos.length >= 2 ? parecidos.reduce((a, p) => a + p.valor, 0) / parecidos.length : null;

  const valor = veiculo && veiculo.vinculo !== "alugado" && veiculo.valor_referencia && veiculo.valor_referencia > 0 ? veiculo.valor_referencia : null;
  const pctComEste = valor ? ((gasto12m + m.orcamento_valor) / valor) * 100 : null;
  return {
    valorReferencia: valor,
    fonteValor: valor ? (veiculo?.valor_fonte ?? null) : null,
    gasto12m,
    pctComEste,
    pctEste: valor ? (m.orcamento_valor / valor) * 100 : null,
    nivel: pctComEste === null ? "ok" : nivelPorPercentual(pctComEste, params),
    historico: historico.slice(0, 6),
    parecidos: parecidos.slice(0, 6),
    mediaParecidos: media,
    acimaDaMediaPct: media ? (m.orcamento_valor / media - 1) * 100 : null,
  };
}
