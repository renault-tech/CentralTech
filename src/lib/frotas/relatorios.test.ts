import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { COLUNAS_RELATORIO, aplicarColunasOcultas, lerColunasOcultas } from "@/lib/frotas/colunas";
import { PARAMETROS_PADRAO } from "@/lib/frotas/regras";
import {
  nomeArquivo,
  relatorioCombustivel,
  relatorioCompleto,
  relatorioContabilidade,
  relatorioCusto,
  relatorioGastoSecretaria,
  relatorioManutencoes,
  relatorioPendencias,
  relatorioVeiculos,
  type Tabela,
  tabelaParaCsv,
  type DadosRelatorio,
} from "@/lib/frotas/relatorios";
import { revisarVeiculos, type AvisoRevisao } from "@/lib/frotas/revisao";
import { tabelasParaXlsx } from "@/lib/frotas/xlsx-saida";
import { montarPdfTabelas } from "@/lib/emendas/pdf";
import type { Manutencao, NotaCombustivel, Veiculo } from "@/types/frotas";

const veiculo = (id: string, extra: Partial<Veiculo> = {}): Veiculo =>
  ({
    id, placa: id.toUpperCase(), modelo: "Gol", marca: "Volkswagen", ano_fabricacao: 2011, ano_modelo: 2011, combustivel: "gasolina", classificacao: "leve",
    patrimonio: "1120179", vinculo: "proprio", secretaria_id: "su", setor: null, situacao: "ativo", motivo_situacao: null, finalidade: null, locadora_id: null,
    valor_referencia: 14000, valor_fonte: "fipe", revisao_ignorada: [], ...extra,
  }) as Veiculo;

const nota = (id: string, extra: Partial<NotaCombustivel> = {}): NotaCombustivel =>
  ({
    id, secretaria_id: "edu", fornecedor_id: "p1", numero_nf: `N${id}`, periodo_inicio: "2026-10-01", periodo_fim: "2026-10-15", data_emissao: "2026-10-15", valor: 1000,
    enviada_secretaria_em: null, retornou_em: null, enviada_contabilidade_em: null, observacoes: null, ...extra,
  }) as NotaCombustivel;

const man = (id: string, extra: Partial<Manutencao> = {}): Manutencao =>
  ({
    id, veiculo_id: "hlf", secretaria_id: "su", fornecedor_id: "o1", servico: "Embreagem", descricao: null, orcamento_valor: 15700, orcamento_recebido_em: "2026-09-01",
    status_analise: "liberado", analisado_em: "2026-09-02", oc_numero: "1841/2026", oc_valor: 15700, oc_emitida_em: null, nf_numero: null,
    nf_emissao: null, nf_valor: null, enviada_contabilidade_em: null, observacoes: null, ...extra,
  }) as Manutencao;

const dados: DadosRelatorio = {
  hoje: "2026-11-04",
  veiculos: [veiculo("hlf"), veiculo("sem", { placa: null, patrimonio: "0000000", valor_referencia: null, valor_fonte: null })],
  manutencoes: [
    man("1"),
    man("2", { oc_numero: "9/2026", nf_numero: "5", nf_emissao: "2026-10-10", nf_valor: 100, orcamento_valor: 100 }),
    man("3", { status_analise: "a_analisar", analisado_em: null, oc_numero: null, oc_valor: null, orcamento_recebido_em: "2026-11-02" }),
  ],
  notas: [
    nota("1", { enviada_secretaria_em: "2026-10-12" }),
    nota("2", { valor: 500.5, enviada_secretaria_em: "2026-10-20", retornou_em: "2026-10-28" }),
    nota("3", { enviada_secretaria_em: "2026-10-20", retornou_em: "2026-10-28", enviada_contabilidade_em: "2026-10-29" }),
  ],
  secretarias: [
    { id: "edu", nome: "Educação", controla_combustivel: true, ativa: true, criado_em: "" },
    { id: "su", nome: "Serviços Urbanos", controla_combustivel: true, ativa: true, criado_em: "" },
  ],
  fornecedores: [
    { id: "p1", tipo: "posto", nome: "Posto Alfa", cnpj: null, ativo: true, criado_em: "" },
    { id: "o1", tipo: "oficina", nome: "Oficina A", cnpj: null, ativo: true, criado_em: "" },
  ],
  params: PARAMETROS_PADRAO,
};

describe("relatórios", () => {
  it("veículos: valor, fonte e avisos de revisão", () => {
    const [t] = relatorioVeiculos(dados, dados.veiculos, revisarVeiculos(dados.veiculos));
    expect(t.colunas).toHaveLength(t.linhas[0].length);
    expect(t.linhas[0]).toContain("Tabela FIPE");
    expect(t.linhas[0][12]).toBe(14000);
    expect(t.linhas[1][0]).toBe("Sem placa");
    expect(String(t.linhas[1][14])).toContain("Sem placa");
    expect(String(t.linhas[1][14])).toContain("Patrimônio zerado");
  });

  it("combustível: situação, dias na etapa e total", () => {
    const [t] = relatorioCombustivel(dados, dados.notas);
    expect(t.linhas).toHaveLength(3);
    expect(t.linhas[0].slice(0, 4)).toEqual(["Educação", "N1", "Posto Alfa", "01/10 a 15/10/2026"]);
    expect(t.linhas[0][9]).toBe("Aguardando assinatura da secretaria");
    expect(t.linhas[0][10]).toBe(23);
    expect(t.linhas[2][10]).toBe("");
    expect(t.total?.[5]).toBe(2500.5);
    expect(t.linhas.every((l) => l.length === t.colunas.length)).toBe(true);
  });

  it("manutenções: uma linha por registro, com a situação", () => {
    const [t] = relatorioManutencoes(dados, dados.manutencoes);
    expect(t.linhas.map((l) => l[6])).toEqual(["OC emitida, aguardando a NF", "NF registrada, a enviar à Contabilidade", "Orçamento a analisar"]);
    expect(t.linhas[0][1]).toBe("HLF - Gol 2011");
    expect(t.linhas.every((l) => l.length === t.colunas.length)).toBe(true);
  });

  it("custo × valor e gasto por secretaria", () => {
    const [c] = relatorioCusto(dados);
    expect(c.linhas[0][5]).toBe("113%"); // (15.700 + 100) ÷ 14.000
    expect(c.linhas[0][6]).toBe("Avaliar baixa ou troca");
    const [g] = relatorioGastoSecretaria(dados);
    expect(g.total?.[3]).toBe((g.linhas as number[][]).reduce((a, l) => a + (l[3] as number), 0));
  });

  it("remessa à Contabilidade: só o que está no Frotas", () => {
    const [nfs, mans] = relatorioContabilidade(dados);
    expect(nfs.linhas).toHaveLength(1);
    expect(nfs.linhas[0][1]).toBe("N2");
    expect(nfs.total?.[4]).toBe(500.5);
    expect(mans.linhas).toHaveLength(1);
    expect(mans.linhas[0][2]).toBe("9/2026");
    expect(mans.linhas[0][6]).toBe(25);
  });

  it("pendências: NFs, manutenções e orçamentos, do mais parado ao menos", () => {
    const [t] = relatorioPendencias(dados);
    expect(t.titulo).toContain("04/11/2026");
    expect(t.linhas.map((l) => l[0])).toEqual(["NF aguardando retorno da secretaria", "OC emitida, aguardando a NF", "Orçamento a analisar"]);
    expect(t.linhas[0][6]).toBe("Crítico");
  });

  it("completo reúne todas as tabelas", () => {
    expect(relatorioCompleto(dados, revisarVeiculos(dados.veiculos)).map((t) => t.titulo)).toHaveLength(8);
  });
});

describe("saídas", () => {
  it("CSV com BOM, ponto e vírgula, vírgula decimal e fórmulas neutralizadas", () => {
    const csv = tabelaParaCsv({ titulo: "t", colunas: ["A", "Valor"], monetarias: [1], linhas: [["=SOMA(1)", 1234.5], ["a;b", 2]] });
    expect(csv.startsWith("﻿A;Valor")).toBe(true);
    expect(csv).toContain("'=SOMA(1);1234,50");
    expect(csv).toContain('"a;b";2,00');
  });

  it("Excel: uma aba por tabela, moeda e total", async () => {
    const [t] = relatorioCombustivel(dados, dados.notas);
    const bytes = await tabelasParaXlsx({ criador: "teste", tabelas: [t, ...relatorioGastoSecretaria(dados)] });
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["NFs de combustível", "Gasto por secretaria"]);
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).getCell(1).value).toBe("Secretaria");
    expect(ws.getRow(2).getCell(6).value).toBe(1000);
    expect(ws.getColumn(6).numFmt).toContain("R$");
    expect(ws.getRow(5).getCell(6).value).toBe(2500.5);
  });

  it("PDF válido a partir das tabelas do Frotas", () => {
    const pdf = montarPdfTabelas({ titulo: "Frotas - teste", tabelas: relatorioContabilidade(dados), rodape: "Central Cataguases - Frotas" });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });

  it("nome de arquivo sem caracteres estranhos", () => {
    expect(nomeArquivo("gasto-secretaria", "2026-11-04", "xlsx")).toBe("frotas-gasto-secretaria-2026-11-04.xlsx");
    expect(nomeArquivo("../x", "2026-11-04", "pdf")).toBe("frotas-..-x-2026-11-04.pdf");
  });

  it("o catálogo de colunas bate com as tabelas de cada relatório", () => {
    const avisos = new Map<string, AvisoRevisao[]>();
    const por: Record<string, Tabela[]> = {
      veiculos: relatorioVeiculos(dados, dados.veiculos, avisos),
      combustivel: relatorioCombustivel(dados, dados.notas),
      manutencoes: relatorioManutencoes(dados, dados.manutencoes),
      custo: relatorioCusto(dados),
      "gasto-secretaria": relatorioGastoSecretaria(dados),
      contabilidade: relatorioContabilidade(dados),
      pendencias: relatorioPendencias(dados),
    };
    for (const [id, tabelas] of Object.entries(por)) {
      const uniao = [...new Set(tabelas.flatMap((t) => t.colunas))];
      expect(COLUNAS_RELATORIO[id as keyof typeof COLUNAS_RELATORIO], id).toEqual(uniao);
    }
  });

  it("esconde colunas mantendo linhas, total e colunas em reais alinhados", () => {
    const [t] = relatorioManutencoes(dados, dados.manutencoes);
    const [sem] = aplicarColunasOcultas([t], ["Veículo", "Observações"]);
    expect(sem.colunas).not.toContain("Veículo");
    expect(sem.colunas).toHaveLength(t.colunas.length - 2);
    expect(sem.linhas.every((l) => l.length === sem.colunas.length)).toBe(true);
    // as colunas em reais continuam sendo as de valor
    expect(sem.monetarias.map((i) => sem.colunas[i])).toEqual(["Orçamento", "Valor da OC", "Valor da NF"]);
    expect(aplicarColunasOcultas([t], [])).toEqual([t]);
    expect(aplicarColunasOcultas([t], t.colunas)[0]).toBe(t); // nada sobraria: mantém inteira
    expect(lerColunasOcultas("Veículo|Alerta")).toEqual(["Veículo", "Alerta"]);
  });
});
