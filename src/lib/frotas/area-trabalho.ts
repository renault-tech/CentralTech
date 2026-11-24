/**
 * Linhas das áreas de trabalho de Frotas (Manutenção, Veículos, Combustível): tudo o que a lista e o resumo ao lado mostram já
 * vem calculado aqui (puro e testado), em objetos simples que atravessam do servidor para o navegador. A página só carrega os
 * dados e o componente só desenha.
 */

import { analisarOrcamento } from "@/lib/frotas/analise";
import { revisarVeiculos } from "@/lib/frotas/revisao";
import {
  custoManutencao,
  dataDoCusto,
  diasEntre,
  nfAcimaDaOc,
  nivelPorDias,
  nivelPorPercentual,
  passosManutencao,
  situacaoManutencao,
  situacaoNota,
  subtrairMeses,
  type EtapaManutencao,
  type EtapaNota,
  type NivelAlerta,
} from "@/lib/frotas/regras";
import type { Manutencao, NotaCombustivel, ParametrosFrotas, SecretariaFrotas, Veiculo } from "@/types/frotas";

type Base = {
  hoje: string;
  veiculos: Veiculo[];
  manutencoes: Manutencao[];
  notas: NotaCombustivel[];
  secretarias: SecretariaFrotas[];
  params: ParametrosFrotas;
};

const nomeDoVeiculo = (v: Veiculo | undefined) => (v ? `${v.placa ?? "Sem placa"} · ${v.modelo}${v.ano_modelo ? ` ${v.ano_modelo}` : ""}` : "Veículo removido");

// ------------------------------------------------------------------ manutenção

export type LinhaManutencao = {
  id: string;
  veiculoId: string;
  veiculo: string;
  secretariaId: string;
  secretaria: string;
  oficinaId: string;
  oficina: string;
  servico: string;
  descricao: string | null;
  ocNumero: string | null;
  ocValor: number | null;
  nfNumero: string | null;
  nfValor: number | null;
  nfEmissao: string | null;
  recebidoEm: string;
  analisadoEm: string | null;
  analiseObs: string | null;
  contabilidadeEm: string | null;
  etapa: EtapaManutencao;
  etapaRotulo: string;
  emAndamento: boolean;
  dias: number;
  nivel: NivelAlerta;
  orcamento: number;
  /** O que pesa nas contas: NF, senão OC, senão o orçamento. */
  valor: number;
  nfAcimaOc: number | null;
  passos: { nome: string; estado: "feito" | "atual" | "futuro"; data: string | null }[];
  analise: { valorReferencia: number | null; fonteValor: "fipe" | "manual" | null; gasto12m: number; pctComEste: number | null; nivelComEste: NivelAlerta; acimaDaMediaPct: number | null; mediaParecidos: number | null } | null;
};

export function montarLinhasManutencao(e: Base & { oficinas: { id: string; nome: string }[] }): LinhaManutencao[] {
  const veiculoPorId = new Map(e.veiculos.map((v) => [v.id, v]));
  const nomeSec = new Map(e.secretarias.map((s) => [s.id, s.nome]));
  const nomeOficina = new Map(e.oficinas.map((o) => [o.id, o.nome]));
  return e.manutencoes.map((m) => {
    const s = situacaoManutencao(m);
    const dias = diasEntre(s.desde, e.hoje);
    const a = analisarOrcamento(m, e);
    return {
      id: m.id,
      veiculoId: m.veiculo_id,
      veiculo: nomeDoVeiculo(veiculoPorId.get(m.veiculo_id)),
      secretariaId: m.secretaria_id,
      secretaria: nomeSec.get(m.secretaria_id) ?? "—",
      oficinaId: m.fornecedor_id ?? "",
      oficina: m.fornecedor_id ? (nomeOficina.get(m.fornecedor_id) ?? "Oficina") : "Não informada",
      servico: m.servico,
      descricao: m.descricao,
      ocNumero: m.oc_numero,
      ocValor: m.oc_valor,
      nfNumero: m.nf_numero,
      nfValor: m.nf_valor,
      nfEmissao: m.nf_emissao,
      recebidoEm: m.orcamento_recebido_em,
      analisadoEm: m.analisado_em,
      analiseObs: m.analise_obs,
      contabilidadeEm: m.enviada_contabilidade_em,
      etapa: s.etapa,
      etapaRotulo: s.rotulo,
      emAndamento: s.emAndamento,
      dias,
      nivel: s.emAndamento ? nivelPorDias(dias, e.params) : "ok",
      orcamento: m.orcamento_valor,
      valor: custoManutencao(m) ?? m.orcamento_valor,
      nfAcimaOc: nfAcimaDaOc(m),
      passos: passosManutencao(m).map((p) => ({ nome: p.nome, estado: p.estado, data: p.data })),
      analise: {
        valorReferencia: a.valorReferencia,
        fonteValor: a.fonteValor,
        gasto12m: a.gasto12m,
        pctComEste: a.pctComEste,
        nivelComEste: a.pctComEste === null ? "ok" : nivelPorPercentual(a.pctComEste, e.params),
        acimaDaMediaPct: a.acimaDaMediaPct,
        mediaParecidos: a.mediaParecidos,
      },
    };
  });
}

// ------------------------------------------------------------------ veículos

export type LinhaVeiculo = {
  id: string;
  placa: string;
  modelo: string;
  marca: string | null;
  ano: string | null;
  combustivel: Veiculo["combustivel"];
  classificacao: Veiculo["classificacao"];
  patrimonio: string | null;
  vinculo: Veiculo["vinculo"];
  secretariaId: string;
  secretaria: string;
  setor: string | null;
  situacao: Veiculo["situacao"];
  motivoSituacao: string | null;
  valorReferencia: number | null;
  valorFonte: Veiculo["valor_fonte"];
  semValor: boolean;
  avisos: string[];
  gasto12m: number;
  servicos12m: number;
  ultimas: { id: string; data: string; servico: string; valor: number }[];
};

export function montarLinhasVeiculos(e: Base): LinhaVeiculo[] {
  const nomeSec = new Map(e.secretarias.map((s) => [s.id, s.nome]));
  const avisos = revisarVeiculos(e.veiculos);
  const limite = subtrairMeses(e.hoje, 12);
  const porVeiculo = new Map<string, Manutencao[]>();
  for (const m of e.manutencoes) {
    if (custoManutencao(m) === null) continue;
    const l = porVeiculo.get(m.veiculo_id) ?? [];
    l.push(m);
    porVeiculo.set(m.veiculo_id, l);
  }
  return e.veiculos.map((v) => {
    const ms = (porVeiculo.get(v.id) ?? []).sort((a, b) => dataDoCusto(b).localeCompare(dataDoCusto(a)));
    const doAno = ms.filter((m) => dataDoCusto(m) >= limite);
    const fab = v.ano_fabricacao;
    const mod = v.ano_modelo;
    return {
      id: v.id,
      placa: v.placa ?? "Sem placa",
      modelo: v.modelo,
      marca: v.marca,
      ano: fab && mod && fab !== mod ? `${fab}/${mod}` : String(mod ?? fab ?? "") || null,
      combustivel: v.combustivel,
      classificacao: v.classificacao,
      patrimonio: v.patrimonio,
      vinculo: v.vinculo,
      secretariaId: v.secretaria_id,
      secretaria: nomeSec.get(v.secretaria_id) ?? "—",
      setor: v.setor,
      situacao: v.situacao,
      motivoSituacao: v.motivo_situacao,
      valorReferencia: v.valor_referencia,
      valorFonte: v.valor_fonte,
      semValor: v.vinculo !== "alugado" && (!v.valor_referencia || v.valor_referencia <= 0),
      avisos: (avisos.get(v.id) ?? []).map((a) => a.texto),
      gasto12m: doAno.reduce((a, m) => a + (custoManutencao(m) ?? 0), 0),
      servicos12m: doAno.length,
      ultimas: ms.slice(0, 3).map((m) => ({ id: m.id, data: dataDoCusto(m), servico: m.servico, valor: custoManutencao(m) ?? 0 })),
    };
  });
}

// ------------------------------------------------------------------ NFs de combustível

export type ChaveSituacaoNota = EtapaNota | "arquivada";

export type LinhaNota = {
  id: string;
  numero: string;
  secretariaId: string;
  secretaria: string;
  postoId: string;
  posto: string;
  quinzenaInicio: string;
  quinzenaFim: string;
  emissao: string;
  valor: number;
  enviadaEm: string | null;
  retornouEm: string | null;
  contabilidadeEm: string | null;
  observacoes: string | null;
  situacao: ChaveSituacaoNota;
  etapa: EtapaNota;
  etapaRotulo: string;
  dias: number;
  nivel: NivelAlerta;
  pendente: boolean;
};

/** NF que já foi à Contabilidade há mais de 30 dias: sai da visão padrão (continua na busca). */
export const DIAS_NF_ARQUIVADA = 30;

export function montarLinhasNotas(e: Base & { postos: { id: string; nome: string }[] }): LinhaNota[] {
  const nomeSec = new Map(e.secretarias.map((s) => [s.id, s.nome]));
  const nomePosto = new Map(e.postos.map((p) => [p.id, p.nome]));
  return e.notas.map((n) => {
    const s = situacaoNota(n);
    const dias = diasEntre(s.desde, e.hoje);
    return {
      id: n.id,
      numero: n.numero_nf,
      secretariaId: n.secretaria_id,
      secretaria: nomeSec.get(n.secretaria_id) ?? "—",
      postoId: n.fornecedor_id ?? "",
      posto: n.fornecedor_id ? (nomePosto.get(n.fornecedor_id) ?? "Posto") : "Não informado",
      quinzenaInicio: n.periodo_inicio,
      quinzenaFim: n.periodo_fim,
      emissao: n.data_emissao,
      valor: n.valor,
      enviadaEm: n.enviada_secretaria_em,
      retornouEm: n.retornou_em,
      contabilidadeEm: n.enviada_contabilidade_em,
      observacoes: n.observacoes,
      situacao: s.etapa === "na_contabilidade" && dias > DIAS_NF_ARQUIVADA ? "arquivada" : s.etapa,
      etapa: s.etapa,
      etapaRotulo: s.rotulo,
      dias,
      nivel: s.pendente && s.etapa !== "recebida" ? nivelPorDias(dias, e.params) : "ok",
      pendente: s.pendente,
    };
  });
}
