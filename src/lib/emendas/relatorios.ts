import type { ExecucaoEmenda, EmendaResumo, Impedimento } from "@/types/emendas";

/** Relatórios de prestação de contas (dados de apoio; o envio oficial segue o sistema do TCE-MG — IN 05/2025). */
export type Tabela = { titulo: string; colunas: string[]; linhas: (string | number)[][]; monetarias: number[] };

const soma = (rs: EmendaResumo[], f: (r: EmendaResumo) => number) => rs.reduce((t, r) => t + f(r), 0);
const agrupar = (rs: EmendaResumo[], chave: (r: EmendaResumo) => string) => {
  const m = new Map<string, EmendaResumo[]>();
  for (const r of rs) (m.get(chave(r)) ?? m.set(chave(r), []).get(chave(r))!).push(r);
  return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
};

export function relatorioPorVereador(rs: EmendaResumo[]): Tabela {
  return {
    titulo: "Execução por vereador",
    colunas: ["Vereador", "Emendas", "Indicado", "Na Saúde", "Empenhado", "Liquidado", "Pago", "% pago"],
    monetarias: [2, 3, 4, 5, 6],
    linhas: agrupar(rs, (r) => `${String(r.vereador_numero).padStart(2, "0")} · ${r.vereador_nome}`).map(([nome, l]) => {
      const total = soma(l, (r) => r.valor);
      return [nome, l.length, total, soma(l.filter((r) => r.saude), (r) => r.valor), soma(l, (r) => r.empenhado), soma(l, (r) => r.liquidado), soma(l, (r) => r.pago), total ? `${((soma(l, (r) => r.pago) / total) * 100).toFixed(1)}%` : "—"];
    }),
  };
}

export function relatorioPorSecretaria(rs: EmendaResumo[]): Tabela {
  return {
    titulo: "Execução orçamentária por secretaria",
    colunas: ["Secretaria", "Emendas", "Indicado", "Empenhado", "Liquidado", "Pago"],
    monetarias: [2, 3, 4, 5],
    linhas: agrupar(rs, (r) => r.secretaria_nome).map(([nome, l]) => [nome, l.length, soma(l, (r) => r.valor), soma(l, (r) => r.empenhado), soma(l, (r) => r.liquidado), soma(l, (r) => r.pago)]),
  };
}

export function relatorioPorBeneficiario(rs: EmendaResumo[]): Tabela {
  return {
    titulo: "Recursos por beneficiário",
    colunas: ["Beneficiário", "CNPJ", "Emendas", "Indicado", "Pago"],
    monetarias: [3, 4],
    linhas: agrupar(rs, (r) => r.beneficiario_nome ?? "(sem beneficiário)").map(([nome, l]) => [nome, l[0].beneficiario_cnpj ?? "", l.length, soma(l, (r) => r.valor), soma(l, (r) => r.pago)]),
  };
}

export function relatorioParcerias(rs: EmendaResumo[], exec: ExecucaoEmenda[]): Tabela {
  const porId = new Map(exec.map((x) => [x.id, x]));
  const iso = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");
  return {
    titulo: "Parcerias e prestação de contas",
    colunas: ["Emenda", "Beneficiário", "Termo", "Vigência início", "Vigência fim", "Extrato publicado", "Conta bancária", "Valor", "Pago"],
    monetarias: [7, 8],
    linhas: rs
      .filter((r) => porId.get(r.id)?.numero_termo)
      .map((r) => {
        const x = porId.get(r.id)!;
        return [r.numero, r.beneficiario_nome ?? "", x.numero_termo ?? "", iso(x.vigencia_inicio), iso(x.vigencia_fim), iso(x.data_publicacao_extrato), x.conta_bancaria ?? "", r.valor, r.pago];
      }),
  };
}

export function relatorioImpedimentos(rs: EmendaResumo[], imps: Impedimento[]): Tabela {
  const porId = new Map(rs.map((r) => [r.id, r]));
  const nome = { tecnico: "Técnico", legal: "Legal", documentacao: "Documentação" } as const;
  return {
    titulo: "Impedimentos em aberto",
    colunas: ["Emenda", "Vereador", "Secretaria", "Tipo", "Justificativa", "Valor"],
    monetarias: [5],
    linhas: imps
      .filter((i) => !i.resolvido_em && porId.has(i.emenda_id))
      .map((i) => {
        const r = porId.get(i.emenda_id)!;
        return [r.numero, r.vereador_nome, r.secretaria_nome, nome[i.tipo], i.justificativa, r.valor];
      }),
  };
}

export function tabelaParaCsv(t: Tabela): string {
  const cel = (v: string | number, i: number) => {
    const s = typeof v === "number" && t.monetarias.includes(i) ? v.toFixed(2).replace(".", ",") : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [t.colunas.join(";"), ...t.linhas.map((l) => l.map(cel).join(";"))].join("\r\n");
}
