"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { obterContextoImoveis } from "@/lib/imoveis/dados";
import { chave } from "@/lib/imoveis/importacao/planilha-contas";
import { lerContrato, lerDocumento, type DadosContrato, type DocumentoLido, type TipoDocumentoLido } from "@/lib/imoveis/pdf-documento";
import { extrairTexto } from "@/lib/imoveis/texto-arquivo";
import { ROTULO_TIPO } from "@/lib/imoveis/regras";
import { criarClienteImoveis } from "@/lib/supabase/imoveis-cliente";
import type { TipoUnidade } from "@/types/imoveis";

/**
 * Leitura de documentos do imóvel em PDF (contrato, comprovante de troca de titularidade, laudo de vistoria): o servidor lê o
 * TEXTO e PROPÕE os campos; nada é gravado até a pessoa conferir e aplicar. O PDF nunca é guardado (nem no banco nem em disco,
 * nem em bucket): só os dados confirmados entram nos campos do imóvel/da entrega, e a auditoria registra a mudança.
 */

const MAX_BYTES = 5 * 1024 * 1024;

export type OpcaoUnidadeDoc = { id: string; tipo: TipoUnidade; rotulo: string };
export type ResultadoLeituraDoc = { sucesso: true; documento: DocumentoLido; unidades: OpcaoUnidadeDoc[]; semTexto: false } | { sucesso: true; semTexto: true; unidades: OpcaoUnidadeDoc[] } | { sucesso: false; erro: string };
export type ResultadoAplicacao = { sucesso: true } | { sucesso: false; erro: string };

async function exigirGestor() {
  const ctx = await obterContextoImoveis();
  return ctx.situacao === "ok" && ctx.gestor ? ctx : null;
}

export async function lerDocumentoPdf(form: FormData): Promise<ResultadoLeituraDoc> {
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só o Setor de Imóveis lê documentos." };
  const imovelId = z.uuid().safeParse(form.get("imovelId"));
  const tipo = z.enum(["contrato", "titularidade", "vistoria"]).safeParse(form.get("tipo"));
  const arquivo = form.get("arquivo");
  if (!imovelId.success || !tipo.success) return { sucesso: false, erro: "Escolha o tipo de documento." };
  if (!(arquivo instanceof File) || arquivo.size === 0) return { sucesso: false, erro: "Escolha um PDF." };
  if (arquivo.size > MAX_BYTES) return { sucesso: false, erro: "O arquivo tem mais de 5 MB." };

  const imoveis = await criarClienteImoveis();
  const [{ data: imovel }, { data: unidades }] = await Promise.all([
    imoveis.from("imoveis").select("id").eq("id", imovelId.data).maybeSingle(),
    imoveis.from("unidades").select("id, tipo, numero").eq("imovel_id", imovelId.data),
  ]);
  if (!imovel) return { sucesso: false, erro: "Imóvel não encontrado." };
  const opcoes: OpcaoUnidadeDoc[] = (unidades ?? []).map((u) => ({ id: u.id, tipo: u.tipo, rotulo: `${ROTULO_TIPO[u.tipo]} · ${u.numero}` }));

  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await arquivo.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    const texto = Array.isArray(text) ? text.join("\n") : text;
    if (texto.replace(/\s/g, "").length < 20) return { sucesso: true, semTexto: true, unidades: opcoes };
    return { sucesso: true, semTexto: false, documento: lerDocumento(tipo.data as TipoDocumentoLido, texto, unidades ?? []), unidades: opcoes };
  } catch {
    return { sucesso: false, erro: "Não consegui abrir este PDF." };
  }
}

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

const esquemaAplicar = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("contrato"),
    imovelId: z.uuid(),
    campos: z.object({
      contratoNumero: z.string().trim().max(40).optional(),
      vigenciaInicio: data.optional(),
      vigenciaFim: data.optional(),
      valorAluguel: z.number().min(0).max(99_999_999).optional(),
      diaVencimento: z.number().int().min(1).max(31).optional(),
      indiceReajuste: z.enum(["IPCA", "IGP-M", "INPC", "outro"]).optional(),
      proprietarioNome: z.string().trim().max(160).optional(),
      proprietarioDocumento: z.string().trim().max(20).optional(),
    }),
  }),
  z.object({ tipo: z.literal("titularidade"), imovelId: z.uuid(), unidadeTipo: z.enum(["agua", "luz"]), dataTroca: data }),
  z.object({
    tipo: z.literal("vistoria"),
    imovelId: z.uuid(),
    dataVistoria: data,
    vistoriador: z.string().trim().max(160).optional(),
    resumo: z.string().trim().max(2000).optional(),
  }),
]);

const MENSAGENS: [RegExp, string][] = [
  [/vigencia_em_ordem/i, "O fim da vigência é anterior ao início."],
  [/vistoria_concluida_depois_da_agenda/i, "A vistoria foi concluída antes da data em que estava agendada."],
];

/** Aplica os campos confirmados pela pessoa. Só grava o que veio marcado; nada de PDF é guardado. */
export async function aplicarDocumento(entrada: z.input<typeof esquemaAplicar>): Promise<ResultadoAplicacao> {
  const a = esquemaAplicar.safeParse(entrada);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só o Setor de Imóveis altera os dados." };
  const imoveis = await criarClienteImoveis();
  const v = a.data;
  let erro: { message?: string; code?: string } | null = null;

  if (v.tipo === "contrato") {
    const c = v.campos;
    const linha = {
      ...(c.contratoNumero !== undefined && { contrato_numero: c.contratoNumero || null }),
      ...(c.vigenciaInicio !== undefined && { vigencia_inicio: c.vigenciaInicio }),
      ...(c.vigenciaFim !== undefined && { vigencia_fim: c.vigenciaFim }),
      ...(c.valorAluguel !== undefined && { valor_aluguel: c.valorAluguel }),
      ...(c.diaVencimento !== undefined && { dia_vencimento: c.diaVencimento }),
      ...(c.indiceReajuste !== undefined && { indice_reajuste: c.indiceReajuste }),
      ...(c.proprietarioNome !== undefined && { proprietario_nome: c.proprietarioNome || null }),
      ...(c.proprietarioDocumento !== undefined && { proprietario_documento: c.proprietarioDocumento || null }),
    };
    if (Object.keys(linha).length === 0) return { sucesso: false, erro: "Marque ao menos um campo para aplicar." };
    ({ error: erro } = await imoveis.from("imoveis").update(linha).eq("id", v.imovelId));
  } else if (v.tipo === "titularidade") {
    ({ error: erro } = await imoveis
      .from("entregas")
      .upsert({ id: v.imovelId, ...(v.unidadeTipo === "agua" ? { titularidade_agua_em: v.dataTroca } : { titularidade_luz_em: v.dataTroca }) }, { onConflict: "id" }));
  } else {
    ({ error: erro } = await imoveis.from("entregas").upsert(
      { id: v.imovelId, vistoria_concluida_em: v.dataVistoria, ...(v.vistoriador ? { vistoriador: v.vistoriador } : {}), ...(v.resumo ? { vistoria_obs: v.resumo } : {}) },
      { onConflict: "id" }
    ));
  }
  if (erro) {
    if (erro.code === "42501" || /row-level security/i.test(erro.message ?? "")) return { sucesso: false, erro: "Sem permissão para alterar os dados de Imóveis." };
    return { sucesso: false, erro: MENSAGENS.find(([p]) => p.test(erro?.message ?? ""))?.[1] ?? "Não foi possível aplicar. Tente novamente." };
  }
  revalidatePath("/imoveis", "layout");
  return { sucesso: true };
}

// ------------------------------------------------------------------ cadastro do imóvel

export type PropostaCadastro = DadosContrato & { imobiliariaId?: string; imobiliariaRotulo?: string; secretariaId?: string; secretariaRotulo?: string };
export type ResultadoLeituraCadastro = { sucesso: true; proposta: PropostaCadastro; avisos: string[] } | { sucesso: true; semTexto: true } | { sucesso: false; erro: string };

/**
 * Lê um contrato (PDF, Word .docx ou texto) só para PREENCHER o formulário de cadastro do imóvel: extrai o texto na memória, propõe os
 * campos e casa imobiliária e secretaria com o cadastro. NÃO grava nada e o arquivo não é guardado (nem banco, nem bucket, nem disco).
 */
export async function lerDocumentoParaCadastro(form: FormData): Promise<ResultadoLeituraCadastro> {
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só o Setor de Imóveis lê documentos." };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { sucesso: false, erro: "Escolha um arquivo (PDF, Word .docx ou texto)." };
  if (arquivo.size > MAX_BYTES) return { sucesso: false, erro: "O arquivo tem mais de 5 MB." };
  if (!/\.(pdf|docx|txt)$/i.test(arquivo.name)) return { sucesso: false, erro: "Use um PDF, um Word (.docx) ou um arquivo de texto (.txt)." };

  let texto: string;
  try {
    texto = await extrairTexto(arquivo.name, new Uint8Array(await arquivo.arrayBuffer()));
  } catch {
    return { sucesso: false, erro: "Não consegui abrir este arquivo." };
  }
  if (texto.replace(/\s/g, "").length < 20) return { sucesso: true, semTexto: true };

  const lido = lerContrato(texto);
  if (lido.tipo !== "contrato") return { sucesso: false, erro: "Não foi possível ler o documento." };
  const proposta: PropostaCadastro = { ...lido.dados };
  const avisos = [...lido.avisos];

  const imoveis = await criarClienteImoveis();
  const [{ data: imobs }, { data: secs }] = await Promise.all([
    imoveis.from("imobiliarias").select("id, nome").eq("ativa", true),
    imoveis.from("secretarias").select("id, nome").eq("ativa", true),
  ]);
  const casa = (lista: { id: string; nome: string }[] | null, lido: string | undefined) => {
    const k = chave(lido ?? "");
    if (!k) return null;
    const achados = (lista ?? []).filter((x) => {
      const n = chave(x.nome);
      return n === k || n.includes(k) || k.includes(n);
    });
    return achados.length === 1 ? achados[0] : null;
  };
  const imob = casa(imobs, proposta.imobiliariaNome);
  if (imob) Object.assign(proposta, { imobiliariaId: imob.id, imobiliariaRotulo: imob.nome });
  else if (proposta.imobiliariaNome) avisos.push(`Imobiliária “${proposta.imobiliariaNome}” não encontrada no cadastro: cadastre em Configurações ou escolha à mão.`);
  const sec = casa(secs, proposta.secretariaNome);
  if (sec) Object.assign(proposta, { secretariaId: sec.id, secretariaRotulo: sec.nome });
  else if (proposta.secretariaNome) avisos.push(`Secretaria “${proposta.secretariaNome}” não casou com o cadastro: escolha à mão.`);
  return { sucesso: true, proposta, avisos };
}
