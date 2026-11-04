/**
 * Relatórios do Frotas como tabelas simples (título, colunas, linhas) — funções
 * puras, que alimentam Excel, PDF e CSV (`/frotas/exportar`). As listas chegam
 * já filtradas pela RLS de quem pede (e pelos filtros da tela, quando houver).
 */

import {
  ROTULO_PARECER,
  calcularPainel,
  custoPorVeiculo,
  gastoPorSecretaria,
} from "@/lib/frotas/analise";
import { neutralizarFormula } from "@/lib/emendas/relatorios";
import type { AvisoRevisao } from "@/lib/frotas/revisao";
import { diasEntre, formatarData, pct, situacaoManutencao, situacaoNota } from "@/lib/frotas/regras";
import type { Fornecedor, Manutencao, NotaCombustivel, ParametrosFrotas, SecretariaFrotas, Veiculo } from "@/types/frotas";

export type Tabela = {
  titulo: string;
  /** Nome da aba no Excel (até 31 caracteres); sem ele, usa o título. */
  aba?: string;
  colunas: string[];
  linhas: (string | number)[][];
  /** Colunas em reais (número; o PDF formata, o Excel aplica o formato de moeda). */
  monetarias: number[];
  total?: (string | number)[];
};

export const RELATORIOS = ["veiculos", "combustivel", "manutencoes", "custo", "gasto-secretaria", "contabilidade", "pendencias"] as const;
export type IdRelatorio = (typeof RELATORIOS)[number];

export const ROTULO_RELATORIO: Record<IdRelatorio, string> = {
  veiculos: "Veículos",
  combustivel: "NFs de combustível",
  manutencoes: "Manutenções",
  custo: "Custo de manutenção × valor do veículo",
  "gasto-secretaria": "Gasto por secretaria",
  contabilidade: "Remessa à Contabilidade",
  pendencias: "Pendências",
};

/** Relatórios que são uma única tabela (os únicos que saem em CSV). */
export const RELATORIOS_UMA_TABELA: IdRelatorio[] = ["veiculos", "combustivel", "manutencoes", "custo", "gasto-secretaria", "pendencias"];

export type DadosRelatorio = {
  hoje: string;
  veiculos: Veiculo[];
  manutencoes: Manutencao[];
  notas: NotaCombustivel[];
  secretarias: SecretariaFrotas[];
  fornecedores: Fornecedor[];
  params: ParametrosFrotas;
};

const VINCULO = { proprio: "Próprio", convenio: "Convênio", alugado: "Alugado" } as const;
const COMBUSTIVEL = { gasolina: "Gasolina", flex: "Flex", diesel: "Diesel", diesel_s10: "Diesel S10" } as const;
const CLASSIFICACAO = { leve: "Leve", pesado: "Pesado", maquina: "Máquina", moto: "Moto" } as const;
const SITUACAO = { ativo: "Ativo", em_manutencao: "Em manutenção", inativo: "Inativo", baixado: "Baixado" } as const;

function nomes(d: DadosRelatorio) {
  return {
    secretaria: new Map(d.secretarias.map((s) => [s.id, s.nome])),
    fornecedor: new Map(d.fornecedores.map((f) => [f.id, f.nome])),
    veiculo: new Map(d.veiculos.map((v) => [v.id, v])),
  };
}

const descreveVeiculo = (v: Veiculo | undefined) => (v ? `${v.placa ?? "Sem placa"} - ${v.modelo}${v.ano_modelo ? ` ${v.ano_modelo}` : ""}` : "Veículo removido");
const quinzena = (n: Pick<NotaCombustivel, "periodo_inicio" | "periodo_fim">) => `${formatarData(n.periodo_inicio).slice(0, 5)} a ${formatarData(n.periodo_fim)}`;
const soma = (valores: number[]) => valores.reduce((a, b) => a + b, 0);

export function relatorioVeiculos(d: DadosRelatorio, lista: Veiculo[], avisos: Map<string, AvisoRevisao[]>): Tabela[] {
  const n = nomes(d);
  return [
    {
      titulo: "Veículos",
      colunas: ["Placa", "Modelo", "Marca", "Ano", "Combustível", "Classificação", "Vínculo", "Secretaria", "Setor", "Situação", "Motivo da situação", "Patrimônio", "Valor de referência", "Fonte do valor", "Dados a revisar"],
      monetarias: [12],
      linhas: lista.map((v) => [
        v.placa ?? "Sem placa",
        v.modelo,
        v.marca ?? "",
        v.ano_fabricacao && v.ano_modelo && v.ano_fabricacao !== v.ano_modelo ? `${v.ano_fabricacao}/${v.ano_modelo}` : String(v.ano_modelo ?? v.ano_fabricacao ?? ""),
        v.combustivel ? COMBUSTIVEL[v.combustivel] : "",
        v.classificacao ? CLASSIFICACAO[v.classificacao] : "",
        VINCULO[v.vinculo],
        n.secretaria.get(v.secretaria_id) ?? "",
        v.setor ?? "",
        SITUACAO[v.situacao],
        v.motivo_situacao ?? "",
        v.patrimonio ?? "",
        v.valor_referencia ?? "",
        v.valor_fonte === "fipe" ? "Tabela FIPE" : v.valor_fonte === "manual" ? "Informado pelo setor" : "",
        (avisos.get(v.id) ?? []).map((a) => a.texto).join("; "),
      ]),
    },
  ];
}

export function relatorioCombustivel(d: DadosRelatorio, lista: NotaCombustivel[]): Tabela[] {
  const n = nomes(d);
  return [
    {
      titulo: "NFs de combustível",
      colunas: ["Secretaria", "NF", "Posto", "Quinzena", "Emissão", "Valor", "Enviada à secretaria", "Retornou", "Enviada à Contabilidade", "Situação", "Dias na etapa", "Observações"],
      monetarias: [5],
      linhas: lista.map((nf) => {
        const s = situacaoNota(nf);
        return [
          n.secretaria.get(nf.secretaria_id) ?? "",
          nf.numero_nf,
          nf.fornecedor_id ? (n.fornecedor.get(nf.fornecedor_id) ?? "") : "",
          quinzena(nf),
          formatarData(nf.data_emissao),
          nf.valor,
          nf.enviada_secretaria_em ? formatarData(nf.enviada_secretaria_em) : "",
          nf.retornou_em ? formatarData(nf.retornou_em) : "",
          nf.enviada_contabilidade_em ? formatarData(nf.enviada_contabilidade_em) : "",
          s.rotulo,
          s.pendente ? diasEntre(s.desde, d.hoje) : "",
          nf.observacoes ?? "",
        ];
      }),
      total: ["", "Total", "", "", "", soma(lista.map((x) => x.valor)), "", "", "", "", "", ""],
    },
  ];
}

export function relatorioManutencoes(d: DadosRelatorio, lista: Manutencao[]): Tabela[] {
  const n = nomes(d);
  return [
    {
      titulo: "Manutenções",
      colunas: ["Secretaria", "Veículo", "Serviço", "Oficina", "Orçamento recebido", "Orçamento", "Situação", "OC (IPM)", "Valor da OC", "OC enviada à secretaria", "NF", "Emissão da NF", "Valor da NF", "Documentos voltaram", "Enviada à Contabilidade", "Observações"],
      monetarias: [5, 8, 12],
      linhas: lista.map((m) => [
        n.secretaria.get(m.secretaria_id) ?? "",
        descreveVeiculo(n.veiculo.get(m.veiculo_id)),
        m.servico,
        m.fornecedor_id ? (n.fornecedor.get(m.fornecedor_id) ?? "") : "",
        formatarData(m.orcamento_recebido_em),
        m.orcamento_valor,
        situacaoManutencao(m).rotulo,
        m.oc_numero ?? "",
        m.oc_valor ?? "",
        m.oc_enviada_em ? formatarData(m.oc_enviada_em) : "",
        m.nf_numero ?? "",
        m.nf_emissao ? formatarData(m.nf_emissao) : "",
        m.nf_valor ?? "",
        m.docs_retornaram_em ? formatarData(m.docs_retornaram_em) : "",
        m.enviada_contabilidade_em ? formatarData(m.enviada_contabilidade_em) : "",
        m.observacoes ?? "",
      ]),
    },
  ];
}

export function relatorioCusto(d: DadosRelatorio): Tabela[] {
  const n = nomes(d);
  const linhas = custoPorVeiculo(d);
  return [
    {
      titulo: "Custo de manutenção × valor do veículo (últimos 12 meses)",
      aba: "Custo x valor (12 meses)",
      colunas: ["Veículo", "Secretaria", "Valor de referência", "Manutenção em 12 meses", "Manutenção total", "% do valor (12 meses)", "Parecer"],
      monetarias: [2, 3, 4],
      linhas: linhas.map((l) => [
        descreveVeiculo(l.veiculo),
        n.secretaria.get(l.veiculo.secretaria_id) ?? "",
        l.valor,
        l.custo12m,
        l.custoTotal,
        pct(l.pct12m),
        ROTULO_PARECER[l.parecer],
      ]),
    },
  ];
}

export function relatorioGastoSecretaria(d: DadosRelatorio): Tabela[] {
  const gastos = gastoPorSecretaria(d);
  return [
    {
      titulo: "Gasto por secretaria (últimos 12 meses)",
      aba: "Gasto por secretaria",
      colunas: ["Secretaria", "Manutenção", "Combustível (NFs)", "Total"],
      monetarias: [1, 2, 3],
      linhas: gastos.map((g) => [g.nome, g.manutencao, g.combustivel, g.manutencao + g.combustivel]),
      total: ["Total", soma(gastos.map((g) => g.manutencao)), soma(gastos.map((g) => g.combustivel)), soma(gastos.map((g) => g.manutencao + g.combustivel))],
    },
  ];
}

/** Relação do que o Frotas tem em mãos para mandar à Contabilidade (imprimível). */
export function relatorioContabilidade(d: DadosRelatorio): Tabela[] {
  const n = nomes(d);
  const notas = d.notas.filter((x) => situacaoNota(x).etapa === "assinada").sort((a, b) => (a.retornou_em ?? "").localeCompare(b.retornou_em ?? ""));
  const manutencoes = d.manutencoes.filter((m) => situacaoManutencao(m).etapa === "docs_retornaram").sort((a, b) => (a.docs_retornaram_em ?? "").localeCompare(b.docs_retornaram_em ?? ""));
  return [
    {
      titulo: "NFs de combustível assinadas, a enviar à Contabilidade",
      aba: "NFs a enviar à Contabilidade",
      colunas: ["Secretaria", "NF", "Posto", "Quinzena", "Valor", "Voltou assinada em", "Dias no Frotas"],
      monetarias: [4],
      linhas: notas.map((x) => [
        n.secretaria.get(x.secretaria_id) ?? "",
        x.numero_nf,
        x.fornecedor_id ? (n.fornecedor.get(x.fornecedor_id) ?? "") : "",
        quinzena(x),
        x.valor,
        formatarData(x.retornou_em),
        diasEntre(x.retornou_em as string, d.hoje),
      ]),
      total: ["", "Total", "", "", soma(notas.map((x) => x.valor)), "", ""],
    },
    {
      titulo: "Manutenções com os documentos no Frotas, a enviar à Contabilidade",
      aba: "Manutenções a enviar",
      colunas: ["Secretaria", "Veículo", "OC (IPM)", "NF", "Valor da NF", "Documentos voltaram em", "Dias no Frotas"],
      monetarias: [4],
      linhas: manutencoes.map((m) => [
        n.secretaria.get(m.secretaria_id) ?? "",
        descreveVeiculo(n.veiculo.get(m.veiculo_id)),
        m.oc_numero ?? "",
        m.nf_numero ?? "",
        m.nf_valor ?? "",
        formatarData(m.docs_retornaram_em),
        diasEntre(m.docs_retornaram_em as string, d.hoje),
      ]),
      total: ["", "", "", "Total", soma(manutencoes.map((m) => m.nf_valor ?? 0)), "", ""],
    },
  ];
}

const ROTULO_NIVEL = { ok: "", atencao: "Atenção", critico: "Crítico" } as const;

export function relatorioPendencias(d: DadosRelatorio): Tabela[] {
  const p = calcularPainel(d);
  const linha = (tipo: string, i: (typeof p.nfsAguardando)[number]) => [tipo, i.secretaria, i.referencia, i.veiculo ?? "", formatarData(i.data), i.dias, ROTULO_NIVEL[i.nivel]];
  const linhas = [
    ...p.nfsAguardando.map((i) => linha("NF aguardando retorno da secretaria", i)),
    ...p.manutencoesAguardando.map((i) => linha(i.rotulo ?? "Manutenção aguardando NF", i)),
    ...p.orcamentos.map((i) => linha("Orçamento a analisar", i)),
  ];
  return [
    {
      titulo: `Pendências em ${formatarData(d.hoje)} (atenção a partir de ${d.params.dias_atencao} dias, crítico a partir de ${d.params.dias_critico})`,
      aba: "Pendências",
      colunas: ["Tipo", "Secretaria", "Referência", "Veículo", "Parado desde", "Dias", "Nível"],
      monetarias: [],
      linhas,
    },
  ];
}

/** Planilha de "tudo": todas as tabelas, uma aba cada. */
export function relatorioCompleto(d: DadosRelatorio, avisos: Map<string, AvisoRevisao[]>): Tabela[] {
  return [
    ...relatorioPendencias(d),
    ...relatorioContabilidade(d),
    ...relatorioCombustivel(d, d.notas),
    ...relatorioManutencoes(d, d.manutencoes),
    ...relatorioVeiculos(d, d.veiculos, avisos),
    ...relatorioCusto(d),
    ...relatorioGastoSecretaria(d),
  ];
}

/** CSV de uma tabela: BOM, ponto e vírgula e vírgula decimal (abre direto no Excel em português). */
export function tabelaParaCsv(t: Tabela): string {
  const cel = (v: string | number, i: number) => {
    const s = typeof v === "number" && t.monetarias.includes(i) ? v.toFixed(2).replace(".", ",") : neutralizarFormula(String(v));
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [t.colunas.join(";"), ...t.linhas.map((l) => l.map(cel).join(";"))].join("\r\n");
}

/** Nome de arquivo seguro. */
export function nomeArquivo(id: string, hoje: string, extensao: string): string {
  return `frotas-${id}-${hoje}.${extensao}`.replace(/[^a-z0-9._-]/gi, "-");
}
