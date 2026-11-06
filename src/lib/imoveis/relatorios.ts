import { formatarData } from "@/lib/frotas/regras";
import type { Tabela } from "@/lib/frotas/relatorios";
import { mascararDocumento, referenciaDe, rotuloMes, ROTULO_TIPO, UNIDADE_DE_MEDIDA, type Pendencia } from "@/lib/imoveis/regras";
import type { Conta, Imobiliaria, Imovel, SecretariaImoveis, Unidade } from "@/types/imoveis";

/** Relatórios do módulo Imóveis e Consumo (funções puras, testadas). Reaproveitam o formato `Tabela` do Frotas. */
export type IdRelatorioImoveis = "imoveis" | "contas" | "pendencias" | "secretarias";
export const RELATORIOS_IMOVEIS: IdRelatorioImoveis[] = ["imoveis", "contas", "pendencias", "secretarias"];

const SITUACAO = { ativo: "Ativo", em_entrega: "Em entrega", entregue: "Entregue" } as const;

export type DadosRelatorio = {
  imoveis: Imovel[];
  unidades: Unidade[];
  contas: Conta[];
  secretarias: SecretariaImoveis[];
  imobiliarias: Imobiliaria[];
  pendencias: Pendencia[];
  hoje: string;
};

export function montarTabelas(id: IdRelatorioImoveis, d: DadosRelatorio): { nome: string; tabelas: Tabela[] } {
  const sec = new Map(d.secretarias.map((s) => [s.id, s.nome]));
  const imob = new Map(d.imobiliarias.map((m) => [m.id, m.nome]));
  const imovel = new Map(d.imoveis.map((i) => [i.id, i]));

  if (id === "imoveis") {
    const linhas = d.imoveis.map((i) => [
      i.nome, i.endereco, sec.get(i.secretaria_id) ?? "", i.setor ?? "", SITUACAO[i.situacao], i.contrato_numero ?? "",
      formatarData(i.vigencia_inicio), formatarData(i.vigencia_fim), i.valor_aluguel, i.dia_vencimento ?? "", i.indice_reajuste ?? "",
      imob.get(i.imobiliaria_id ?? "") ?? "", i.proprietario_nome ?? "", mascararDocumento(i.proprietario_documento),
    ]);
    return {
      nome: "Imóveis",
      tabelas: [{
        titulo: "Imóveis alugados", aba: "Imóveis",
        colunas: ["Imóvel", "Endereço", "Secretaria", "Setor", "Situação", "Contrato", "Início", "Fim", "Aluguel", "Dia", "Reajuste", "Imobiliária", "Proprietário", "CPF/CNPJ"],
        linhas, monetarias: [8],
        total: ["Total", ...Array(7).fill(""), d.imoveis.reduce((a, i) => a + i.valor_aluguel, 0), ...Array(5).fill("")],
      }],
    };
  }

  if (id === "contas") {
    const un = new Map(d.unidades.map((u) => [u.id, u]));
    const linhas = [...d.contas]
      .sort((a, b) => b.referencia.localeCompare(a.referencia))
      .map((c) => {
        const u = un.get(c.unidade_id);
        const i = u ? imovel.get(u.imovel_id) : undefined;
        return [rotuloMes(c.referencia), u ? ROTULO_TIPO[u.tipo] : "", i?.nome ?? "", i ? sec.get(i.secretaria_id) ?? "" : "", u?.numero ?? "",
          c.consumo ?? "", u ? UNIDADE_DE_MEDIDA[u.tipo] : "", c.valor, formatarData(c.vencimento), c.pago_em ? formatarData(c.pago_em) : "em aberto"];
      });
    return {
      nome: "Contas de água e luz",
      tabelas: [{
        titulo: "Contas de água e luz", aba: "Contas",
        colunas: ["Mês", "Tipo", "Imóvel", "Secretaria", "Matrícula/UC", "Consumo", "Unidade", "Valor", "Vencimento", "Pago em"],
        linhas, monetarias: [7], total: ["Total", ...Array(6).fill(""), d.contas.reduce((a, c) => a + c.valor, 0), "", ""],
      }],
    };
  }

  if (id === "pendencias") {
    return {
      nome: "Pendências",
      tabelas: [{
        titulo: "Pendências abertas", aba: "Pendências",
        colunas: ["Gravidade", "Imóvel", "Secretaria", "Assunto", "Detalhe"],
        linhas: d.pendencias.map((p) => {
          const i = imovel.get(p.imovelId);
          return [p.nivel === "critico" ? "Crítico" : "Atenção", i?.nome ?? "", i ? sec.get(i.secretaria_id) ?? "" : "", p.titulo, p.detalhe];
        }),
        monetarias: [],
      }],
    };
  }

  // secretarias: gasto do mês mais recente por secretaria
  const un = new Map(d.unidades.map((u) => [u.id, u]));
  const mesAtual = referenciaDe(d.hoje);
  const ref = d.contas.map((c) => c.referencia).filter((r) => r <= mesAtual).sort().at(-1) ?? mesAtual;
  const por = new Map<string, { aluguel: number; agua: number; luz: number; imoveis: number }>();
  for (const i of d.imoveis.filter((x) => x.situacao !== "entregue")) {
    const e = por.get(i.secretaria_id) ?? { aluguel: 0, agua: 0, luz: 0, imoveis: 0 };
    e.aluguel += i.valor_aluguel;
    e.imoveis += 1;
    por.set(i.secretaria_id, e);
  }
  for (const c of d.contas.filter((x) => x.referencia === ref)) {
    const u = un.get(c.unidade_id);
    const i = u ? imovel.get(u.imovel_id) : undefined;
    if (!u || !i) continue;
    const e = por.get(i.secretaria_id) ?? { aluguel: 0, agua: 0, luz: 0, imoveis: 0 };
    e[u.tipo] += c.valor;
    por.set(i.secretaria_id, e);
  }
  const linhas = [...por.entries()].map(([sid, e]) => [sec.get(sid) ?? "", e.imoveis, e.aluguel, e.agua, e.luz, e.aluguel + e.agua + e.luz]).sort((a, b) => Number(b[5]) - Number(a[5]));
  const soma = (k: number) => linhas.reduce((a, l) => a + Number(l[k]), 0);
  return {
    nome: "Gasto por secretaria",
    tabelas: [{ titulo: `Gasto por secretaria (${rotuloMes(ref)})`, aba: "Secretarias", colunas: ["Secretaria", "Imóveis", "Aluguel", "Água", "Luz", "Total"], linhas, monetarias: [2, 3, 4, 5], total: ["Total", soma(1), soma(2), soma(3), soma(4), soma(5)] }],
  };
}

export function nomeArquivoImoveis(id: string, hoje: string, extensao: string): string {
  return `imoveis-${id}-${hoje}.${extensao}`.replace(/[^a-z0-9._-]/gi, "-");
}
