import "server-only";

import { unstable_cache } from "next/cache";

import { tipoDaEmenda } from "@/lib/emendas/fases";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import type { TipoExecucao } from "@/types/emendas";

/**
 * Dados do portal público de transparência. Rota SEM login: por isso a leitura é feita
 * só aqui, no servidor, com lista fechada de colunas — nada de `select *`, nada de dado
 * pessoal (CPF, dirigentes) nem texto livre de gestão (observações, gestores, descrição
 * completa). A conta bancária sai mascarada (últimos 4 dígitos). Cache de 5 minutos,
 * invalidado pela tag `portal-emendas` quando a gestão grava.
 */
import { TAG_PORTAL } from "@/lib/emendas/portal-tag";
export { TAG_PORTAL };

export type LinhaPortal = {
  numero: number;
  ano: number;
  vereador: string;
  objeto: string;
  valor: number;
  saude: boolean;
  tipo: TipoExecucao;
  secretaria: string;
  unidade: string;
  funcional: string | null;
  natureza: string | null;
  beneficiario: string | null;
  /** CNPJ só de pessoa jurídica (beneficiários cadastrados são todos PJ). */
  cnpj: string | null;
  etapa: string;
  situacao: "normal" | "impedida" | "cancelada";
  empenhado: number;
  liquidado: number;
  pago: number;
  ultimoPagamento: string | null;
  termo: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  extratoPublicadoEm: string | null;
  contaMascarada: string | null;
  impedimento: string | null;
};

export function mascararConta(conta: string | null | undefined): string | null {
  const digitos = (conta ?? "").replace(/\D/g, "");
  if (digitos.length < 4) return null;
  return `****${digitos.slice(-4)}`;
}

async function carregar(ano: number): Promise<LinhaPortal[]> {
  const db = criarClienteAdminBruto().schema("emendas");
  const { data: emendas, error } = await db
    .from("v_emendas")
    .select(
      "id,ano,numero,objeto,valor,saude,modalidade,tipo_execucao,etapa,situacao,vereador_nome,secretaria_nome,unidade_codigo,unidade_nome,funcional_programatica,natureza_despesa,beneficiario_nome,beneficiario_cnpj,empenhado,liquidado,pago,ultimo_pagamento"
    )
    .eq("ano", ano)
    .neq("situacao", "cancelada")
    .order("numero");
  if (error || !emendas) throw new Error("Portal: falha ao ler as emendas.");
  const ids = emendas.map((e) => e.id as string);

  const execucao = new Map<string, Record<string, string | null>>();
  const impedimentos = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 150) {
    const lote = ids.slice(i, i + 150);
    const [ex, imp] = await Promise.all([
      db.from("execucao").select("id,numero_termo,vigencia_inicio,vigencia_fim,data_publicacao_extrato,conta_bancaria").in("id", lote),
      db.from("impedimentos").select("emenda_id,tipo,resolvido_em").in("emenda_id", lote).is("resolvido_em", null),
    ]);
    for (const x of ex.data ?? []) execucao.set(x.id as string, x as Record<string, string | null>);
    for (const x of imp.data ?? []) impedimentos.set(x.emenda_id as string, String(x.tipo));
  }

  const NOME_IMPEDIMENTO: Record<string, string> = { tecnico: "Impedimento técnico", legal: "Impedimento legal", documentacao: "Documentação da entidade" };
  return emendas.map((e) => {
    const x = execucao.get(e.id as string);
    const imp = impedimentos.get(e.id as string);
    return {
      numero: e.numero as number,
      ano: e.ano as number,
      vereador: e.vereador_nome as string,
      objeto: e.objeto as string,
      valor: Number(e.valor),
      saude: !!e.saude,
      tipo: tipoDaEmenda({ tipo_execucao: e.tipo_execucao as TipoExecucao | null, modalidade: e.modalidade as "repasse" | "direta" }),
      secretaria: e.secretaria_nome as string,
      unidade: `${e.unidade_codigo} ${e.unidade_nome}`,
      funcional: (e.funcional_programatica as string | null) ?? null,
      natureza: (e.natureza_despesa as string | null) ?? null,
      beneficiario: (e.beneficiario_nome as string | null) ?? null,
      cnpj: (e.beneficiario_cnpj as string | null) ?? null,
      etapa: e.etapa as string,
      situacao: e.situacao as LinhaPortal["situacao"],
      empenhado: Number(e.empenhado),
      liquidado: Number(e.liquidado),
      pago: Number(e.pago),
      ultimoPagamento: (e.ultimo_pagamento as string | null) ?? null,
      termo: x?.numero_termo ?? null,
      vigenciaInicio: x?.vigencia_inicio ?? null,
      vigenciaFim: x?.vigencia_fim ?? null,
      extratoPublicadoEm: x?.data_publicacao_extrato ?? null,
      contaMascarada: mascararConta(x?.conta_bancaria),
      impedimento: imp ? NOME_IMPEDIMENTO[imp] ?? "Impedimento" : null,
    };
  });
}

export const dadosDoPortal = unstable_cache(carregar, ["portal-emendas"], { revalidate: 300, tags: [TAG_PORTAL] });

export async function anosDoPortal(): Promise<number[]> {
  const db = criarClienteAdminBruto().schema("emendas");
  const { data } = await db.from("exercicios").select("ano").order("ano", { ascending: false });
  return (data ?? []).map((x) => x.ano as number);
}

/** CSV de dados abertos (UTF-8 com BOM, separador `;`, decimais com vírgula — abre direto no Excel brasileiro). */
export function paraCsv(linhas: LinhaPortal[], nomeEtapa: (chave: string) => string): string {
  const cab = ["Ano","Emenda","Vereador","Objeto","Valor","Saúde","Tipo de execução","Secretaria","Unidade orçamentária","Funcional programática","Natureza da despesa","Beneficiário","CNPJ","Fase","Situação","Empenhado","Liquidado","Pago","Último pagamento","Termo","Vigência início","Vigência fim","Extrato publicado em","Conta (mascarada)","Impedimento"];
  const num = (v: number) => v.toFixed(2).replace(".", ",");
  const cel = (v: string | number | null) => {
    const t = v === null ? "" : String(v);
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const nomeTipo = { direta: "Execução direta", osc: "Repasse a OSC", ente: "Entes e conveniadas" } as const;
  const corpo = linhas.map((l) =>
    [l.ano,l.numero,l.vereador,l.objeto,num(l.valor),l.saude ? "Sim" : "Não",nomeTipo[l.tipo],l.secretaria,l.unidade,l.funcional,l.natureza,l.beneficiario,l.cnpj,nomeEtapa(l.etapa),l.situacao === "impedida" ? "Impedida" : "Normal",num(l.empenhado),num(l.liquidado),num(l.pago),l.ultimoPagamento,l.termo,l.vigenciaInicio,l.vigenciaFim,l.extratoPublicadoEm,l.contaMascarada,l.impedimento].map(cel).join(";")
  );
  return "﻿" + [cab.join(";"), ...corpo].join("\r\n");
}

export async function nomesDasEtapas(): Promise<Record<string, string>> {
  const db = criarClienteAdminBruto().schema("emendas");
  const { data } = await db.from("etapas").select("chave,nome");
  return Object.fromEntries((data ?? []).map((e) => [e.chave as string, e.nome as string]));
}
