/**
 * Cálculos do Painel de abertura do módulo Imóveis e Consumo (tudo puro, sobre o que a RLS já liberou para a pessoa): gasto do
 * mês em aluguel, luz e água comparado com a média dos meses anteriores, o que precisa de atenção (pendências agrupadas), contas
 * lançadas, contratos, entregas em andamento, gasto dos últimos 12 meses, ranking por secretaria, contas fora do padrão e o que
 * vence nas próximas semanas. A página só carrega os dados e o componente só desenha. Todos os limites vêm de `imoveis.parametros`.
 */

import {
  analisarConsumo,
  diasEntre,
  etapasDaEntrega,
  referenciaDe,
  rotuloMes,
  situacaoVigencia,
  somarMeses,
  totaisMensais,
  UNIDADE_DE_MEDIDA,
  type Pendencia,
  type TotalMensal,
} from "@/lib/imoveis/regras";
import type { Conta, Entrega, Imovel, ParametrosImoveis, SecretariaImoveis, TipoUnidade, Unidade } from "@/types/imoveis";

export type EntradaPainelImoveis = {
  hoje: string;
  imoveis: Imovel[];
  unidades: Unidade[];
  contas: Conta[];
  entregas: Entrega[];
  secretarias: SecretariaImoveis[];
  /** Pendências já sem as justificadas. */
  pendencias: Pendencia[];
  par: ParametrosImoveis;
};

export type Gravidade = "alta" | "media" | "info";
export type ItemAtencao = { chave: string; titulo: string; detalhe: string; quantidade: number; gravidade: Gravidade; href: string };
export type Variacao = { fracao: number; texto: string } | null;

export type LinhaSecretariaGasto = { id: string; nome: string; aluguel: number; luz: number; agua: number; total: number };
export type LinhaForaPadrao = { chave: string; imovelId: string; imovel: string; secretaria: string; tipo: TipoUnidade; referencia: string; variacao: number; valor: number; media: number; base: "consumo" | "valor"; unidade: string };
export type EntregaAndamento = { id: string; nome: string; secretaria: string; feitas: number; total: number; proxima: string; alerta: boolean };
export type Prazo = { dias: number; titulo: string; detalhe: string; href: string };

export type PainelImoveis = {
  /** Mês (AAAA-MM-01) a que os números se referem: o da conta mais recente, sem passar do corrente. */
  referencia: string;
  rotuloReferencia: string;
  totais: { aluguel: number; luz: number; agua: number; total: number };
  /** Comparação com a média dos meses anteriores (consumo lançado). */
  variacaoTotal: Variacao;
  variacaoLuz: Variacao;
  variacaoAgua: Variacao;
  imoveis: { total: number; alugados: number; proprios: number; cedidos: number; emEntrega: number; revisar: number };
  contasDoMes: { tipo: TipoUnidade; total: number; lancadas: number }[];
  semLancamento: { total: number; unidades: number; porSecretaria: { id: string; nome: string; faltam: number }[] };
  atencao: ItemAtencao[];
  contratos: { vencidos: number; ate30: number; ateLimite: number; vigentes: number; semFim: number; limiteDias: number };
  entregas: EntregaAndamento[];
  mensais: TotalMensal[];
  porSecretaria: LinhaSecretariaGasto[];
  foraDoPadrao: LinhaForaPadrao[];
  foraDoPadraoTotal: number;
  prazos: Prazo[];
  /** Secretarias com a luz acima do limite sobre a média dos 3 meses anteriores (insight do cartão escuro). */
  luzAlta: { nome: string; fracao: number }[];
  ultimoLancamento: string | null;
  limites: { pctAcima: number; pctSecretaria: number; diaLancamento: number; diasFimContrato: number };
};

const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

function comparar(atual: number, anteriores: number[], rotulo: string, minimo = 3): Variacao {
  const base = anteriores.filter((v) => v > 0);
  if (atual <= 0 || base.length < minimo) return null;
  const m = media(base);
  if (m <= 0) return null;
  const fracao = atual / m - 1;
  const pct = Math.round(Math.abs(fracao) * 100);
  return { fracao, texto: pct === 0 ? `na média ${rotulo}` : `${pct}% ${fracao > 0 ? "acima" : "abaixo"} ${rotulo}` };
}

export function montarPainelImoveis(entrada: EntradaPainelImoveis): PainelImoveis {
  const { hoje, imoveis, unidades, contas, entregas, secretarias, pendencias, par } = entrada;
  const mesAtual = referenciaDe(hoje);
  const referencia = contas.map((c) => c.referencia).filter((r) => r <= mesAtual).sort().at(-1) ?? mesAtual;
  const nomeSecretaria = new Map(secretarias.map((s) => [s.id, s.nome]));
  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));
  const imovelPorId = new Map(imoveis.map((i) => [i.id, i]));

  const emUso = imoveis.filter((i) => i.situacao !== "entregue");
  const aluguel = emUso.reduce((a, i) => a + i.valor_aluguel, 0);
  const doMes = contas.filter((c) => c.referencia === referencia);
  const somaTipo = (t: TipoUnidade) => doMes.filter((c) => unidadePorId.get(c.unidade_id)?.tipo === t).reduce((a, c) => a + c.valor, 0);
  const luz = somaTipo("luz");
  const agua = somaTipo("agua");

  // ------------------------------------------------------------------ comparação com os meses anteriores
  const mensais = totaisMensais(imoveis, unidades, contas, referencia, 12);
  const anteriores = mensais.slice(0, -1);
  const tres = anteriores.slice(-3);
  const variacaoLuz = comparar(luz, tres.map((m) => m.luz), "da média dos 3 meses anteriores");
  const variacaoAgua = comparar(agua, tres.map((m) => m.agua), "da média dos 3 meses anteriores");
  const consumoAnterior = anteriores.filter((m) => m.luz + m.agua > 0).map((m) => m.aluguel + m.luz + m.agua);
  const variacaoTotal = comparar(aluguel + luz + agua, consumoAnterior, "da média dos meses anteriores");

  // ------------------------------------------------------------------ imóveis
  const conta = (f: (i: Imovel) => boolean) => imoveis.filter(f).length;
  const revisar = pendencias.filter((p) => p.chave === "cadastro_revisar").length;

  // ------------------------------------------------------------------ contas do mês lançadas e o que falta
  const unidadesAtivas = unidades.filter((u) => u.ativa && imovelPorId.get(u.imovel_id)?.situacao === "ativo");
  const comContaNoMes = new Set(doMes.map((c) => c.unidade_id));
  const contasDoMes = (["luz", "agua"] as const).map((tipo) => {
    const todas = unidadesAtivas.filter((u) => u.tipo === tipo);
    return { tipo, total: todas.length, lancadas: todas.filter((u) => comContaNoMes.has(u.id)).length };
  });
  const faltamPorSec = new Map<string, number>();
  for (const u of unidadesAtivas) {
    if (comContaNoMes.has(u.id)) continue;
    const im = imovelPorId.get(u.imovel_id);
    if (im) faltamPorSec.set(im.secretaria_id, (faltamPorSec.get(im.secretaria_id) ?? 0) + 1);
  }
  const semLancamentoPorSec = [...faltamPorSec]
    .map(([id, faltam]) => ({ id, nome: nomeSecretaria.get(id) ?? "—", faltam }))
    .sort((a, b) => b.faltam - a.faltam);
  const semLancamento = { total: unidadesAtivas.length, unidades: semLancamentoPorSec.reduce((a, s) => a + s.faltam, 0), porSecretaria: semLancamentoPorSec };

  // ------------------------------------------------------------------ contratos
  const comFim = emUso.filter((i) => i.vigencia_fim);
  const situacoes = comFim.map((i) => ({ i, v: situacaoVigencia(i.vigencia_fim, hoje, par) }));
  const contratos = {
    vencidos: situacoes.filter(({ v }) => v.nivel === "vencido").length,
    ate30: situacoes.filter(({ v }) => v.nivel === "critico").length,
    ateLimite: situacoes.filter(({ v }) => v.nivel === "atencao").length,
    vigentes: situacoes.filter(({ v }) => v.nivel === "ok").length,
    semFim: emUso.length - comFim.length,
    limiteDias: par.dias_fim_contrato,
  };

  // ------------------------------------------------------------------ entregas em andamento
  const entregaPorId = new Map(entregas.map((e) => [e.id, e]));
  const entregasEmAndamento: EntregaAndamento[] = imoveis
    .filter((i) => i.situacao === "em_entrega")
    .map((i) => {
      const etapas = etapasDaEntrega(entregaPorId.get(i.id) ?? null);
      const feitas = etapas.filter((e) => e.estado === "feita").length;
      const alerta = etapas.find((e) => e.estado === "alerta");
      const agora = etapas.find((e) => e.estado === "agora");
      const falta = alerta ?? agora;
      return { id: i.id, nome: i.nome, secretaria: nomeSecretaria.get(i.secretaria_id) ?? "—", feitas, total: etapas.length, proxima: falta ? falta.nome : "tudo concluído", alerta: !!alerta };
    })
    .sort((a, b) => Number(b.alerta) - Number(a.alerta) || a.feitas - b.feitas);

  // ------------------------------------------------------------------ gasto por secretaria (no mês de referência)
  const porSec = new Map<string, LinhaSecretariaGasto>();
  const linhaSec = (id: string) => {
    let l = porSec.get(id);
    if (!l) {
      l = { id, nome: nomeSecretaria.get(id) ?? "—", aluguel: 0, luz: 0, agua: 0, total: 0 };
      porSec.set(id, l);
    }
    return l;
  };
  for (const i of emUso) linhaSec(i.secretaria_id).aluguel += i.valor_aluguel;
  for (const c of doMes) {
    const u = unidadePorId.get(c.unidade_id);
    const im = u ? imovelPorId.get(u.imovel_id) : undefined;
    if (!u || !im) continue;
    const l = linhaSec(im.secretaria_id);
    if (u.tipo === "agua") l.agua += c.valor;
    else l.luz += c.valor;
  }
  const porSecretaria = [...porSec.values()]
    .map((l) => ({ ...l, total: l.aluguel + l.luz + l.agua }))
    .filter((l) => l.total > 0)
    .sort((a, b) => b.total - a.total);

  // Secretarias com a luz bem acima da média dos 3 meses anteriores. Somando várias unidades a variação é mais suave que a de uma
  // conta isolada, por isso o limite é metade do limite das contas fora do padrão (`pct_acima / 2`).
  const luzSecretariaNoMes = (ref: string) => {
    const m = new Map<string, number>();
    for (const c of contas) {
      if (c.referencia !== ref) continue;
      const u = unidadePorId.get(c.unidade_id);
      const im = u && u.tipo === "luz" ? imovelPorId.get(u.imovel_id) : undefined;
      if (im) m.set(im.secretaria_id, (m.get(im.secretaria_id) ?? 0) + c.valor);
    }
    return m;
  };
  const luzAtual = luzSecretariaNoMes(referencia);
  const luzAnteriores = [1, 2, 3].map((k) => luzSecretariaNoMes(somarMeses(referencia, -k)));
  const luzAlta: { nome: string; fracao: number }[] = [];
  for (const [id, valor] of luzAtual) {
    const comparacao = comparar(valor, luzAnteriores.map((m) => m.get(id) ?? 0), "");
    if (comparacao && comparacao.fracao * 100 > par.pct_acima / 2) luzAlta.push({ nome: nomeSecretaria.get(id) ?? "—", fracao: comparacao.fracao });
  }
  luzAlta.sort((a, b) => b.fracao - a.fracao);

  // ------------------------------------------------------------------ contas fora do padrão (as que ainda são pendência)
  const chavesPendentes = new Set(pendencias.map((p) => `${p.imovelId}|${p.chave}`));
  const fora: LinhaForaPadrao[] = [];
  const contasPorUnidade = new Map<string, Conta[]>();
  for (const c of contas) {
    if (c.referencia > mesAtual) continue;
    const l = contasPorUnidade.get(c.unidade_id) ?? [];
    l.push(c);
    contasPorUnidade.set(c.unidade_id, l);
  }
  for (const u of unidades) {
    const im = imovelPorId.get(u.imovel_id);
    if (!im || im.situacao !== "ativo" || !u.ativa) continue;
    const historico = (contasPorUnidade.get(u.id) ?? []).map((c) => ({ referencia: c.referencia, consumo: c.consumo, valor: c.valor }));
    const ultima = [...historico].sort((a, b) => a.referencia.localeCompare(b.referencia)).at(-1);
    if (!ultima) continue;
    for (const a of analisarConsumo(historico, par, UNIDADE_DE_MEDIDA[u.tipo])) {
      if (a.tipo === "valor_unitario") continue;
      const chave = a.base === "valor" ? `valor_conta_${u.tipo}` : `consumo_${u.tipo}`;
      if (!chavesPendentes.has(`${im.id}|${chave}`)) continue;
      fora.push({
        chave: `${u.id}`,
        imovelId: im.id,
        imovel: im.nome,
        secretaria: nomeSecretaria.get(im.secretaria_id) ?? "—",
        tipo: u.tipo,
        referencia: ultima.referencia,
        variacao: a.variacao,
        valor: ultima.valor,
        media: a.media,
        base: a.base,
        unidade: UNIDADE_DE_MEDIDA[u.tipo],
      });
    }
  }
  fora.sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao));

  // ------------------------------------------------------------------ atenção (pendências agrupadas por assunto)
  const grupo = (teste: (chave: string) => boolean) => pendencias.filter((p) => teste(p.chave));
  const foraP = grupo((k) => k.startsWith("consumo_") || k.startsWith("valor_"));
  const luzF = foraP.filter((p) => p.chave.endsWith("luz")).length;
  const aguaF = foraP.filter((p) => p.chave.endsWith("agua")).length;
  const ligacao = grupo((k) => k.startsWith("ligacao_ativa_"));
  const semDeslig = grupo((k) => k === "entrega_sem_desligamento");
  const entregaParada = grupo((k) => k === "vistoria_pendente" || k === "titularidade_pendente" || k === "entrega_demorada");
  const venc = grupo((k) => k === "contrato_vencido");
  const vencendo = grupo((k) => k === "contrato_vencendo");
  const semConta = grupo((k) => k.startsWith("sem_conta_"));
  const atraso = grupo((k) => k.startsWith("atraso_"));
  const reajuste = grupo((k) => k === "reajuste");
  const critica = (l: Pendencia[]) => l.some((p) => p.nivel === "critico");

  const atencao: ItemAtencao[] = [];
  const add = (i: ItemAtencao) => {
    if (i.quantidade > 0) atencao.push(i);
  };
  add({ chave: "fora_padrao", titulo: "Contas fora do padrão", detalhe: [luzF && `${luzF} de luz`, aguaF && `${aguaF} de água`].filter(Boolean).join(" e ") + ", comparadas com a média", quantidade: foraP.length, gravidade: critica(foraP) ? "alta" : "media", href: "/imoveis/pendencias" });
  add({ chave: "ligacao_ativa", titulo: "Imóvel entregue com a ligação ativa", detalhe: "a conta continua chegando depois das chaves", quantidade: ligacao.length, gravidade: "alta", href: "/imoveis/pendencias" });
  add({ chave: "sem_desligamento", titulo: "Chaves entregues sem desligamento", detalhe: "falta confirmar água ou luz", quantidade: semDeslig.length, gravidade: "alta", href: "/imoveis/entregas" });
  add({ chave: "contratos", titulo: venc.length ? "Contratos vencidos ou vencendo" : "Contratos vencendo", detalhe: [venc.length && `${venc.length} ${venc.length === 1 ? "vencido" : "vencidos"}`, vencendo.length && `${vencendo.length} em até ${par.dias_fim_contrato} dias`].filter(Boolean).join(", "), quantidade: venc.length + vencendo.length, gravidade: venc.length || critica(vencendo) ? "alta" : "media", href: "/imoveis/vencimentos" });
  add({ chave: "sem_conta", titulo: "Contas do mês sem lançamento", detalhe: `passou do dia ${par.dia_lancamento}`, quantidade: semConta.length, gravidade: "media", href: "/imoveis/luz" });
  add({ chave: "atraso", titulo: "Contas em atraso", detalhe: `vencidas há mais de ${par.dias_atraso} dias sem pagamento`, quantidade: atraso.length, gravidade: "media", href: "/imoveis/pendencias" });
  add({ chave: "entregas_paradas", titulo: "Entregas com etapa pendente", detalhe: "vistoria, titularidade ou demora nas chaves", quantidade: entregaParada.length, gravidade: "media", href: "/imoveis/entregas" });
  add({ chave: "reajuste", titulo: "Reajuste de aluguel próximo", detalhe: "aniversário do contrato nos próximos 30 dias", quantidade: reajuste.length, gravidade: "info", href: "/imoveis/vencimentos" });
  add({ chave: "revisar", titulo: "Cadastro para revisar", detalhe: "endereço genérico, vínculo não informado…", quantidade: revisar, gravidade: "info", href: "/imoveis/pendencias" });
  const ordem = { alta: 0, media: 1, info: 2 } as const;
  atencao.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);

  // ------------------------------------------------------------------ o que vence nas próximas semanas
  const prazos: Prazo[] = [];
  for (const i of emUso) {
    if (i.vigencia_fim) {
      const d = diasEntre(hoje, i.vigencia_fim);
      if (d >= 0 && d <= par.dias_fim_contrato) prazos.push({ dias: d, titulo: `Fim do contrato: ${i.nome}`, detalhe: "renovar ou iniciar a entrega do imóvel", href: `/imoveis/imoveis/${i.id}` });
    }
    if (i.proximo_reajuste) {
      const d = diasEntre(hoje, i.proximo_reajuste);
      if (d >= 0 && d <= 60) prazos.push({ dias: d, titulo: `Reajuste do aluguel: ${i.nome}`, detalhe: i.indice_reajuste ? `índice ${i.indice_reajuste}` : "índice não informado", href: `/imoveis/imoveis/${i.id}` });
    }
  }
  for (const c of contas) {
    if (c.pago_em || !c.vencimento) continue;
    const d = diasEntre(hoje, c.vencimento);
    const u = unidadePorId.get(c.unidade_id);
    const im = u ? imovelPorId.get(u.imovel_id) : undefined;
    if (d >= 0 && d <= 14 && u && im) prazos.push({ dias: d, titulo: `Fatura de ${u.tipo === "luz" ? "luz" : "água"}: ${im.nome}`, detalhe: `${rotuloMes(c.referencia)} · vence em ${c.vencimento.split("-").reverse().join("/")}`, href: `/imoveis/imoveis/${im.id}` });
  }
  prazos.sort((a, b) => a.dias - b.dias);

  const ultimoLancamento = contas.map((c) => c.criado_em.slice(0, 10)).filter(Boolean).sort().at(-1) ?? null;

  return {
    referencia,
    rotuloReferencia: rotuloMes(referencia),
    totais: { aluguel, luz, agua, total: aluguel + luz + agua },
    variacaoTotal,
    variacaoLuz,
    variacaoAgua,
    imoveis: {
      total: imoveis.length,
      alugados: conta((i) => i.vinculo === "alugado" && i.situacao !== "entregue"),
      proprios: conta((i) => i.vinculo === "proprio" && i.situacao !== "entregue"),
      cedidos: conta((i) => i.vinculo === "cedido" && i.situacao !== "entregue"),
      emEntrega: conta((i) => i.situacao === "em_entrega"),
      revisar,
    },
    contasDoMes: contasDoMes,
    semLancamento,
    atencao,
    contratos,
    entregas: entregasEmAndamento,
    mensais,
    porSecretaria,
    foraDoPadrao: fora.slice(0, 5),
    foraDoPadraoTotal: fora.length,
    prazos: prazos.slice(0, 6),
    luzAlta: luzAlta.slice(0, 3),
    ultimoLancamento,
    limites: { pctAcima: par.pct_acima, pctSecretaria: par.pct_acima / 2, diaLancamento: par.dia_lancamento, diasFimContrato: par.dias_fim_contrato },
  };
}
