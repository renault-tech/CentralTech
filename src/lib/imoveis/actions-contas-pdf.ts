"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { obterContextoImoveis } from "@/lib/imoveis/dados";
import { lerContaDoTexto, type ContaLida } from "@/lib/imoveis/pdf-conta";
import { referenciaDe, ROTULO_TIPO } from "@/lib/imoveis/regras";
import { criarClienteImoveis } from "@/lib/supabase/imoveis-cliente";
import type { TipoUnidade } from "@/types/imoveis";

/**
 * Importação de faturas em PDF: o servidor lê o TEXTO de cada arquivo e PROPÕE os campos; nada é gravado até a
 * pessoa conferir e confirmar. O PDF nunca é guardado (nem no banco nem em disco): só os dados confirmados.
 */

const MAX_ARQUIVOS = 20;
const MAX_BYTES_ARQUIVO = 5 * 1024 * 1024;

export type OpcaoUnidadePdf = { id: string; tipo: TipoUnidade; rotulo: string };
export type LinhaPrevia = ContaLida & { arquivo: string; semTexto: boolean };
export type ResultadoLeitura = { sucesso: true; linhas: LinhaPrevia[]; unidades: OpcaoUnidadePdf[] } | { sucesso: false; erro: string };

async function exigirGestor() {
  const ctx = await obterContextoImoveis();
  return ctx.situacao === "ok" && ctx.gestor ? ctx : null;
}

const VAZIA: ContaLida = { unidadeId: null, tipo: null, referencia: null, consumo: null, valor: null, vencimento: null, encontrados: 0, avisos: [] };

export async function lerContasPdf(form: FormData): Promise<ResultadoLeitura> {
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só o Setor de Imóveis importa contas." };
  const arquivos = form.getAll("arquivos").filter((f): f is File => f instanceof File && f.size > 0);
  if (arquivos.length === 0) return { sucesso: false, erro: "Escolha ao menos um PDF." };
  if (arquivos.length > MAX_ARQUIVOS) return { sucesso: false, erro: `Envie até ${MAX_ARQUIVOS} PDFs por vez.` };

  const imoveis = await criarClienteImoveis();
  const [{ data: unidades }, { data: lista }] = await Promise.all([
    imoveis.from("unidades").select("id, imovel_id, tipo, numero").eq("ativa", true),
    imoveis.from("imoveis").select("id, nome"),
  ]);
  const nomeImovel = new Map((lista ?? []).map((i) => [i.id, i.nome]));
  const opcoes: OpcaoUnidadePdf[] = (unidades ?? []).map((u) => ({ id: u.id, tipo: u.tipo, rotulo: `${nomeImovel.get(u.imovel_id) ?? "—"} · ${ROTULO_TIPO[u.tipo]} ${u.numero}` }));
  const { extractText, getDocumentProxy } = await import("unpdf");

  const linhas: LinhaPrevia[] = [];
  for (const arq of arquivos) {
    if (arq.size > MAX_BYTES_ARQUIVO) {
      linhas.push({ ...VAZIA, arquivo: arq.name, semTexto: false, avisos: ["Arquivo maior que 5 MB: não foi lido."] });
      continue;
    }
    try {
      const pdf = await getDocumentProxy(new Uint8Array(await arq.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: true });
      const texto = Array.isArray(text) ? text.join("\n") : text;
      if (texto.replace(/\s/g, "").length < 20) {
        linhas.push({ ...VAZIA, arquivo: arq.name, semTexto: true, avisos: ["PDF sem texto (provavelmente digitalizado): lance a conta à mão. A leitura por OCR ainda não está disponível."] });
        continue;
      }
      linhas.push({ ...lerContaDoTexto(texto, unidades ?? []), arquivo: arq.name, semTexto: false });
    } catch {
      linhas.push({ ...VAZIA, arquivo: arq.name, semTexto: false, avisos: ["Não consegui abrir este PDF."] });
    }
  }
  return { sucesso: true, linhas, unidades: opcoes };
}

const esquemaLinha = z.object({
  unidadeId: z.uuid("Escolha a unidade"),
  referencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Mês inválido"),
  consumo: z.number().min(0).max(99_999_999).nullable(),
  valor: z.number({ error: "Informe o valor" }).min(0).max(99_999_999),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export type ResultadoLinha = { ok: true } | { ok: false; erro: string };

/** Grava as linhas confirmadas. Cada uma é independente: uma falha (ex.: mês já lançado) não desfaz as outras. */
export async function confirmarContasPdf(linhas: z.input<typeof esquemaLinha>[]): Promise<{ sucesso: true; resultados: ResultadoLinha[] } | { sucesso: false; erro: string }> {
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só o Setor de Imóveis importa contas." };
  if (!Array.isArray(linhas) || linhas.length === 0 || linhas.length > MAX_ARQUIVOS) return { sucesso: false, erro: "Nada para confirmar." };
  const imoveis = await criarClienteImoveis();
  const resultados: ResultadoLinha[] = [];
  for (const bruta of linhas) {
    const a = esquemaLinha.safeParse(bruta);
    if (!a.success) {
      resultados.push({ ok: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" });
      continue;
    }
    const l = a.data;
    const { error } = await imoveis.from("contas").insert({ unidade_id: l.unidadeId, referencia: referenciaDe(l.referencia), consumo: l.consumo, valor: l.valor, vencimento: l.vencimento, origem: "pdf" });
    if (error) {
      resultados.push({ ok: false, erro: /contas_unidade_mes_unico/i.test(error.message) ? "Já existe conta lançada para esta unidade neste mês." : "Não foi possível gravar esta conta." });
      continue;
    }
    resultados.push({ ok: true });
  }
  revalidatePath("/imoveis", "layout");
  return { sucesso: true, resultados };
}
