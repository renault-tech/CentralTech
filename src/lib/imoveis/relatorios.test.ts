import { describe, expect, it } from "vitest";

import { montarTabelas, type DadosRelatorio } from "./relatorios";
import type { Conta, Imovel, SecretariaImoveis, Unidade } from "@/types/imoveis";

const d: DadosRelatorio = {
  hoje: "2026-11-06",
  secretarias: [{ id: "s1", nome: "Saúde" }, { id: "s2", nome: "Obras" }] as SecretariaImoveis[],
  imobiliarias: [],
  imoveis: [
    { id: "i1", nome: "CRAS", endereco: "Rua A", secretaria_id: "s1", situacao: "ativo", valor_aluguel: 1000, proprietario_documento: "123.456.789-09" },
    { id: "i2", nome: "Garagem", endereco: "Rua B", secretaria_id: "s2", situacao: "entregue", valor_aluguel: 500 },
  ] as Imovel[],
  unidades: [{ id: "u1", imovel_id: "i1", tipo: "luz", numero: "UC1" }, { id: "u2", imovel_id: "i2", tipo: "agua", numero: "M2" }] as Unidade[],
  contas: [{ id: "c1", unidade_id: "u1", referencia: "2026-10-01", consumo: 100, valor: 80, vencimento: "2026-11-10", pago_em: null }, { id: "c2", unidade_id: "u2", referencia: "2026-10-01", consumo: 10, valor: 40, vencimento: null, pago_em: "2026-10-20" }] as Conta[],
  pendencias: [{ chave: "x", imovelId: "i1", nivel: "critico", titulo: "T", detalhe: "D", assinatura: "a" }],
};

describe("relatórios", () => {
  it("lista de imóveis mascara o documento e soma o aluguel", () => {
    const t = montarTabelas("imoveis", d).tabelas[0];
    expect(t.linhas[0]).toContain("***.456.***-09");
    expect(t.total?.[8]).toBe(1500);
    expect(t.linhas[0]).toHaveLength(t.colunas.length);
  });
  it("contas traz imóvel, secretaria e situação de pagamento", () => {
    const t = montarTabelas("contas", d).tabelas[0];
    expect(t.linhas.map((l) => l[9])).toContain("em aberto");
    expect(t.total?.[7]).toBe(120);
    expect(t.linhas.every((l) => l.length === t.colunas.length)).toBe(true);
  });
  it("gasto por secretaria não conta aluguel de imóvel entregue", () => {
    const t = montarTabelas("secretarias", d).tabelas[0];
    const saude = t.linhas.find((l) => l[0] === "Saúde")!;
    expect(saude.slice(1)).toEqual([1, 1000, 0, 80, 1080]);
    const obras = t.linhas.find((l) => l[0] === "Obras")!;
    expect(obras[2]).toBe(0);
    expect(obras[3]).toBe(40);
  });
  it("pendências sai em tabela", () => {
    expect(montarTabelas("pendencias", d).tabelas[0].linhas[0][0]).toBe("Crítico");
  });
});
