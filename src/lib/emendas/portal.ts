import "server-only";

import { unstable_cache } from "next/cache";

import { gndDaNatureza } from "@/lib/emendas/conformidade";
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

export type DocumentoPortal = { id: string; tipo: "plano_trabalho" | "relatorio_gestao" | "anuencia_sus"; rotulo: string; competencia: number | null; nome: string };
export type MovimentoPortal = { tipo: "empenho" | "liquidacao" | "pagamento" | "anulacao"; data: string | null; valor: number; numero: string | null };

/** Documentos que o portal publica por exigência da IN TCE-MG 05/2025 (art. 7º, IX, X e XVII). Nenhum outro anexo sai daqui. */
export const TIPOS_DOCUMENTO_PUBLICO = ["plano_trabalho", "relatorio_gestao", "anuencia_sus"] as const;
const ROTULO_DOC = { plano_trabalho: "Plano de trabalho", relatorio_gestao: "Relatório de gestão", anuencia_sus: "Anuência do SUS" } as const;

export type LinhaPortal = {
  numero: number;
  ano: number;
  vereador: string;
  partido: string | null;
  unidadeParlamentar: string | null;
  leiLoa: string | null;
  municipio: string | null;
  municipioCnpj: string | null;
  objeto: string;
  descricao: string;
  localidade: string | null;
  valor: number;
  saude: boolean;
  tipo: TipoExecucao;
  secretaria: string;
  unidade: string;
  funcional: string | null;
  natureza: string | null;
  gnd: string | null;
  categoria: string | null;
  beneficiario: string | null;
  /** CNPJ do recebedor (beneficiário; na execução direta, o do Município). */
  cnpj: string | null;
  etapa: string;
  situacao: "normal" | "impedida" | "cancelada";
  empenhado: number;
  liquidado: number;
  pago: number;
  ultimoPagamento: string | null;
  /** Data(s) de disponibilização do recurso: empenhos, liquidações e pagamentos. */
  movimentos: MovimentoPortal[];
  termo: string | null;
  processo: string | null;
  contrato: string | null;
  inicioPrevisto: string | null;
  terminoPrevisto: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  extratoPublicadoEm: string | null;
  /** Banco e conta da movimentação dos recursos (IN 05/2025, art. 7º, XVI): conta de pessoa jurídica, divulgada por exigência da norma. */
  conta: string | null;
  gestorPrefeitura: string | null;
  gestorEntidade: string | null;
  anuenciaSus: "sim" | "nao" | "nao_se_aplica" | null;
  identificadorContabil: string | null;
  fonteRecurso: string | null;
  planoMetas: string | null;
  planoOutrasFontes: number | null;
  documentos: DocumentoPortal[];
  impedimento: string | null;
};

async function carregar(ano: number): Promise<LinhaPortal[]> {
  const db = criarClienteAdminBruto().schema("emendas");
  const { data: emendas, error } = await db
    .from("v_emendas")
    .select(
      "id,ano,numero,objeto,descricao,valor,saude,modalidade,tipo_execucao,etapa,situacao,vereador_nome,secretaria_nome,unidade_codigo,unidade_nome,funcional_programatica,natureza_despesa,beneficiario_nome,beneficiario_cnpj,empenhado,liquidado,pago,ultimo_pagamento"
    )
    .eq("ano", ano)
    .neq("situacao", "cancelada")
    .order("numero");
  if (error || !emendas) throw new Error("Portal: falha ao ler as emendas.");
  const ids = emendas.map((e) => e.id as string);

  const [{ data: ex }, { data: vers }] = await Promise.all([
    db.from("exercicios").select("numero_lei_loa,municipio_nome,municipio_cnpj,unidade_parlamentar").eq("ano", ano).maybeSingle(),
    db.from("vereadores").select("nome,partido"),
  ]);
  const partidos = new Map((vers ?? []).map((v) => [v.nome as string, (v.partido as string | null) ?? null]));

  const execucao = new Map<string, Record<string, string | number | null>>();
  const impedimentos = new Map<string, string>();
  const movimentos = new Map<string, MovimentoPortal[]>();
  const documentos = new Map<string, DocumentoPortal[]>();
  for (let i = 0; i < ids.length; i += 150) {
    const lote = ids.slice(i, i + 150);
    const [x, imp, mov, doc] = await Promise.all([
      db
        .from("execucao")
        .select(
          "id,numero_termo,processo_licitatorio,numero_contrato,vigencia_inicio,vigencia_fim,data_publicacao_extrato,conta_bancaria,gestor_osc,gestor_pmc,localidade,inicio_previsto,termino_previsto,plano_metas,plano_outras_fontes,anuencia_sus,identificador_contabil,fonte_recurso"
        )
        .in("id", lote),
      db.from("impedimentos").select("emenda_id,tipo,resolvido_em").in("emenda_id", lote).is("resolvido_em", null),
      db.from("movimentos_financeiros").select("emenda_id,tipo,data,valor,numero").in("emenda_id", lote).order("data"),
      db.from("documentos").select("id,emenda_id,tipo,competencia,nome_arquivo").in("emenda_id", lote).in("tipo", [...TIPOS_DOCUMENTO_PUBLICO]).order("criado_em"),
    ]);
    for (const r of x.data ?? []) execucao.set(r.id as string, r as Record<string, string | number | null>);
    for (const r of imp.data ?? []) impedimentos.set(r.emenda_id as string, String(r.tipo));
    for (const r of mov.data ?? []) {
      const k = r.emenda_id as string;
      movimentos.set(k, [...(movimentos.get(k) ?? []), { tipo: r.tipo as MovimentoPortal["tipo"], data: (r.data as string | null) ?? null, valor: Number(r.valor), numero: (r.numero as string | null) ?? null }]);
    }
    for (const r of doc.data ?? []) {
      const k = r.emenda_id as string;
      const t = r.tipo as DocumentoPortal["tipo"];
      documentos.set(k, [...(documentos.get(k) ?? []), { id: r.id as string, tipo: t, rotulo: ROTULO_DOC[t], competencia: (r.competencia as number | null) ?? null, nome: r.nome_arquivo as string }]);
    }
  }

  const NOME_IMPEDIMENTO: Record<string, string> = { tecnico: "Impedimento técnico", legal: "Impedimento legal", documentacao: "Documentação da entidade" };
  return emendas.map((e) => {
    const x = execucao.get(e.id as string);
    const imp = impedimentos.get(e.id as string);
    const tipo = tipoDaEmenda({ tipo_execucao: e.tipo_execucao as TipoExecucao | null, modalidade: e.modalidade as "repasse" | "direta" });
    const g = gndDaNatureza(e.natureza_despesa as string | null);
    const municipioCnpj = (ex?.municipio_cnpj as string | null) ?? null;
    const s = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
    return {
      numero: e.numero as number,
      ano: e.ano as number,
      vereador: e.vereador_nome as string,
      partido: partidos.get(e.vereador_nome as string) ?? null,
      unidadeParlamentar: (ex?.unidade_parlamentar as string | null) ?? null,
      leiLoa: (ex?.numero_lei_loa as string | null) ?? null,
      municipio: (ex?.municipio_nome as string | null) ?? null,
      municipioCnpj,
      objeto: e.objeto as string,
      descricao: (e.descricao as string) ?? "",
      localidade: s(x?.localidade),
      valor: Number(e.valor),
      saude: !!e.saude,
      tipo,
      secretaria: e.secretaria_nome as string,
      unidade: `${e.unidade_codigo} ${e.unidade_nome}`,
      funcional: (e.funcional_programatica as string | null) ?? null,
      natureza: (e.natureza_despesa as string | null) ?? null,
      gnd: g ? `GND ${g.gnd} — ${g.nome}` : null,
      categoria: g?.categoria === "corrente" ? "Despesa corrente" : g?.categoria === "capital" ? "Despesa de capital" : null,
      beneficiario: (e.beneficiario_nome as string | null) ?? null,
      cnpj: tipo === "direta" && !e.beneficiario_cnpj ? municipioCnpj : ((e.beneficiario_cnpj as string | null) ?? null),
      etapa: e.etapa as string,
      situacao: e.situacao as LinhaPortal["situacao"],
      empenhado: Number(e.empenhado),
      liquidado: Number(e.liquidado),
      pago: Number(e.pago),
      ultimoPagamento: (e.ultimo_pagamento as string | null) ?? null,
      movimentos: movimentos.get(e.id as string) ?? [],
      termo: s(x?.numero_termo),
      processo: s(x?.processo_licitatorio),
      contrato: s(x?.numero_contrato),
      inicioPrevisto: s(x?.inicio_previsto),
      terminoPrevisto: s(x?.termino_previsto),
      vigenciaInicio: s(x?.vigencia_inicio),
      vigenciaFim: s(x?.vigencia_fim),
      extratoPublicadoEm: s(x?.data_publicacao_extrato),
      conta: s(x?.conta_bancaria),
      gestorPrefeitura: s(x?.gestor_pmc),
      gestorEntidade: s(x?.gestor_osc),
      anuenciaSus: (x?.anuencia_sus as LinhaPortal["anuenciaSus"]) ?? null,
      identificadorContabil: s(x?.identificador_contabil),
      fonteRecurso: s(x?.fonte_recurso),
      planoMetas: s(x?.plano_metas),
      planoOutrasFontes: x?.plano_outras_fontes != null ? Number(x.plano_outras_fontes) : null,
      documentos: documentos.get(e.id as string) ?? [],
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
  const cab = ["Ano","Emenda","Vereador","Partido","Unidade parlamentar","Lei da LOA","Município","CNPJ do Município","Objeto","Descrição","Localidade","Valor","Saúde","Tipo de execução","Secretaria","Unidade orçamentária","Funcional programática","Natureza da despesa","GND","Categoria","Beneficiário/recebedor","CNPJ do recebedor","Fase","Situação","Empenhado","Liquidado","Pago","Datas de disponibilização","Termo","Processo","Contrato","Início previsto","Término previsto","Vigência início","Vigência fim","Extrato publicado em","Banco e conta","Gestor na Prefeitura","Gestor na entidade","Anuência do SUS","Identificador contábil","Fonte de recurso","Finalidade e metas","Outras fontes (R$)","Plano de trabalho (link)","Relatórios de gestão (links)","Impedimento"];
  const num = (v: number) => v.toFixed(2).replace(".", ",");
  const cel = (v: string | number | null) => {
    const t = v === null ? "" : /^[=+\-@\t\r]/.test(String(v)) && !/^-?\d+(,\d+)?$/.test(String(v)) ? `'${v}` : String(v);
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const nomeTipo = { direta: "Execução direta", osc: "Repasse a OSC", ente: "Entes e conveniadas" } as const;
  const nomeMov = { empenho: "Empenho", liquidacao: "Liquidação", pagamento: "Pagamento", anulacao: "Anulação" } as const;
  const sus = { sim: "Sim", nao: "Não", nao_se_aplica: "Não se aplica" } as const;
  const link = (d: DocumentoPortal) => `/transparencia/emendas/documento/${d.id}`;
  const corpo = linhas.map((l) =>
    [
      l.ano, l.numero, l.vereador, l.partido, l.unidadeParlamentar, l.leiLoa, l.municipio, l.municipioCnpj, l.objeto, l.descricao, l.localidade, num(l.valor), l.saude ? "Sim" : "Não",
      nomeTipo[l.tipo], l.secretaria, l.unidade, l.funcional, l.natureza, l.gnd, l.categoria, l.beneficiario, l.cnpj, nomeEtapa(l.etapa), l.situacao === "impedida" ? "Impedida" : "Normal",
      num(l.empenhado), num(l.liquidado), num(l.pago),
      l.movimentos.map((m) => `${nomeMov[m.tipo]} ${m.data ?? "sem data"}${m.numero ? ` (${m.numero})` : ""}`).join(" | "),
      l.termo, l.processo, l.contrato, l.inicioPrevisto, l.terminoPrevisto, l.vigenciaInicio, l.vigenciaFim, l.extratoPublicadoEm, l.conta, l.gestorPrefeitura, l.gestorEntidade,
      l.anuenciaSus ? sus[l.anuenciaSus] : null, l.identificadorContabil, l.fonteRecurso, l.planoMetas, l.planoOutrasFontes != null ? num(l.planoOutrasFontes) : null,
      l.documentos.filter((d) => d.tipo === "plano_trabalho").map(link).join(" | "),
      l.documentos.filter((d) => d.tipo === "relatorio_gestao").map((d) => `${d.competencia ?? ""}: ${link(d)}`).join(" | "),
      l.impedimento,
    ].map(cel).join(";")
  );
  return "﻿" + [cab.join(";"), ...corpo].join("\r\n");
}

export async function nomesDasEtapas(): Promise<Record<string, string>> {
  const db = criarClienteAdminBruto().schema("emendas");
  const { data } = await db.from("etapas").select("chave,nome");
  return Object.fromEntries((data ?? []).map((e) => [e.chave as string, e.nome as string]));
}
