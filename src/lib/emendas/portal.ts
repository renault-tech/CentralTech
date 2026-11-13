import "server-only";

import { unstable_cache } from "next/cache";

import { resumirProcessos } from "@/lib/emendas/compras";
import { gndDaNatureza } from "@/lib/emendas/conformidade";
import { tipoDaEmenda } from "@/lib/emendas/fases";
import { createHash } from "node:crypto";

import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import type { TipoExecucao } from "@/types/emendas";

/**
 * Dados do portal público de transparência. Rota SEM login: por isso a leitura é feita
 * só aqui, no servidor, com lista fechada de colunas — nada de `select *`, nada de CPF,
 * endereço ou outro dado de pessoa física, nada de observação interna da gestão. Gestor
 * responsável e banco/conta saem completos por exigência da IN TCE-MG 05/2025 (art. 7º,
 * XIV e XVI; decisão do dono, 29/10/2026). Cache de 5 minutos, invalidado pela tag
 * `portal-emendas` quando a gestão grava. Só aparecem exercícios PUBLICADOS por um gestor
 * (`exercicios.portal_publicado_em`), depois da verificação de `/emendas/portal`.
 */
import { TAG_PORTAL } from "@/lib/emendas/portal-tag";
export { TAG_PORTAL };

export { TIPOS_DOCUMENTO_PUBLICO, ROTULO_DOC } from "@/lib/emendas/portal-tipos";
export type { DocumentoPortal, MovimentoPortal, LinhaPortal } from "@/lib/emendas/portal-tipos";
import { ROTULO_DOC, TIPOS_DOCUMENTO_PUBLICO, type DocumentoPortal, type LinhaPortal, type MovimentoPortal } from "@/lib/emendas/portal-tipos";

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
          "id,numero_termo,processo_licitatorio,processo_id,numero_contrato,vigencia_inicio,vigencia_fim,data_publicacao_extrato,conta_bancaria,gestor_osc,gestor_pmc,localidade,inicio_previsto,termino_previsto,plano_metas,plano_outras_fontes,anuencia_sus,identificador_contabil,fonte_recurso"
        )
        .in("id", lote),
      db.from("impedimentos").select("emenda_id,tipo,resolvido_em").in("emenda_id", lote).is("resolvido_em", null),
      db.from("movimentos_financeiros").select("emenda_id,tipo,data,valor,numero").in("emenda_id", lote).in("tipo", ["empenho", "liquidacao", "pagamento", "anulacao"]).order("data"),
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
  // Processo e contrato ligados ao Compras valem como o número do processo/contrato: não se pede de novo.
  const compras = await resumirProcessos([...execucao.values()].map((r) => r.processo_id as string | null).filter((v): v is string => !!v)).catch(() => new Map());

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
      processo: s(x?.processo_licitatorio) ?? (x?.processo_id ? (compras.get(x.processo_id as string)?.numero_licitacao ?? compras.get(x.processo_id as string)?.numero ?? null) : null),
      contrato: s(x?.numero_contrato) ?? (x?.processo_id ? (compras.get(x.processo_id as string)?.contrato_numero ?? null) : null),
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

export type PacotePortal = { linhas: LinhaPortal[]; geradoEm: string; versao: string };

async function carregarPacote(ano: number): Promise<PacotePortal> {
  const linhas = await carregar(ano);
  const versao = createHash("sha1").update(JSON.stringify(linhas)).digest("hex").slice(0, 16);
  return { linhas, geradoEm: new Date().toISOString(), versao };
}

/** Linhas + carimbo de quando foram lidas + "versão" (hash): o navegador compara a versão para se atualizar sozinho. */
export const pacoteDoPortal = unstable_cache(carregarPacote, ["portal-emendas-pacote"], { revalidate: 300, tags: [TAG_PORTAL] });

export async function dadosDoPortal(ano: number): Promise<LinhaPortal[]> {
  return (await pacoteDoPortal(ano)).linhas;
}

/** Exercícios visíveis no portal: só os publicados (ou todos, para a prévia da gestão). */
export async function anosDoPortal(opcoes?: { incluirNaoPublicados?: boolean }): Promise<number[]> {
  const db = criarClienteAdminBruto().schema("emendas");
  let q = db.from("exercicios").select("ano").order("ano", { ascending: false });
  if (!opcoes?.incluirNaoPublicados) q = q.not("portal_publicado_em", "is", null);
  const { data } = await q;
  return (data ?? []).map((x) => x.ano as number);
}

export type MetaPortal = {
  ano: number;
  cota: number;
  saudeMinPct: number;
  publicadoEm: string | null;
  leiLoa: string | null;
  dataLoa: string | null;
  municipio: string | null;
  municipioCnpj: string | null;
  unidadeParlamentar: string | null;
  vereadoresSemPartido: string[];
};

/** Dados do exercício que o portal e a verificação usam (cota, saúde, LOA, publicação). */
export const metaDoPortal = unstable_cache(carregarMeta, ["portal-emendas-meta"], { revalidate: 300, tags: [TAG_PORTAL] });

async function carregarMeta(ano: number): Promise<MetaPortal | null> {
  const db = criarClienteAdminBruto().schema("emendas");
  const [{ data: ex }, { data: vers }] = await Promise.all([
    db
      .from("exercicios")
      .select("ano,cota_por_vereador,percentual_saude_min,portal_publicado_em,numero_lei_loa,data_aprovacao_loa,municipio_nome,municipio_cnpj,unidade_parlamentar")
      .eq("ano", ano)
      .maybeSingle(),
    db.from("vereadores").select("nome,partido"),
  ]);
  if (!ex) return null;
  return {
    ano: ex.ano as number,
    cota: Number(ex.cota_por_vereador),
    saudeMinPct: Number(ex.percentual_saude_min),
    publicadoEm: (ex.portal_publicado_em as string | null) ?? null,
    leiLoa: (ex.numero_lei_loa as string | null) ?? null,
    dataLoa: (ex.data_aprovacao_loa as string | null) ?? null,
    municipio: (ex.municipio_nome as string | null) ?? null,
    municipioCnpj: (ex.municipio_cnpj as string | null) ?? null,
    unidadeParlamentar: (ex.unidade_parlamentar as string | null) ?? null,
    vereadoresSemPartido: (vers ?? []).filter((v) => !String(v.partido ?? "").trim()).map((v) => v.nome as string),
  };
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
