"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dataNoFuso } from "@/lib/fuso";
import { obterContextoFrotas } from "@/lib/frotas/dados";
import { lerOrcamentoDoTexto, type OrcamentoLido } from "@/lib/frotas/importacao/orcamento-pdf";
import { criarClienteFrotas } from "@/lib/supabase/frotas-cliente";

/**
 * Importação de orçamentos em PDF: o servidor lê o texto de cada arquivo e PROPÕE os campos; nada é gravado
 * até a pessoa conferir e confirmar. O PDF nunca é guardado (nem no banco nem em disco): só os dados confirmados.
 */

const MAX_ARQUIVOS = 20;
const MAX_BYTES_ARQUIVO = 5 * 1024 * 1024;

export type LinhaPrevia = OrcamentoLido & { arquivo: string; semTexto: boolean };
export type ResultadoLeitura = { sucesso: true; linhas: LinhaPrevia[] } | { sucesso: false; erro: string };

async function exigirGestor() {
  const ctx = await obterContextoFrotas();
  return ctx.situacao === "ok" && ctx.gestor ? ctx : null;
}

export async function lerOrcamentosPdf(form: FormData): Promise<ResultadoLeitura> {
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só o Setor de Frotas importa orçamentos." };
  const arquivos = form.getAll("arquivos").filter((f): f is File => f instanceof File && f.size > 0);
  if (arquivos.length === 0) return { sucesso: false, erro: "Escolha ao menos um PDF." };
  if (arquivos.length > MAX_ARQUIVOS) return { sucesso: false, erro: `Envie até ${MAX_ARQUIVOS} PDFs por vez.` };

  const frotas = await criarClienteFrotas();
  const [{ data: veiculos }, { data: oficinas }] = await Promise.all([
    frotas.from("veiculos").select("id, placa, modelo"),
    frotas.from("fornecedores").select("id, nome").eq("tipo", "oficina").eq("ativo", true),
  ]);
  const hoje = dataNoFuso(new Date());
  const { extractText, getDocumentProxy } = await import("unpdf");

  const linhas: LinhaPrevia[] = [];
  for (const arq of arquivos) {
    const vazio = { veiculoId: null, placaLida: null, oficinaId: null, servico: "", valor: null, data: null };
    if (arq.size > MAX_BYTES_ARQUIVO) {
      linhas.push({ ...vazio, arquivo: arq.name, semTexto: false, avisos: ["Arquivo maior que 5 MB: não foi lido."] });
      continue;
    }
    try {
      const pdf = await getDocumentProxy(new Uint8Array(await arq.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: true });
      const texto = Array.isArray(text) ? text.join("\n") : text;
      if (texto.replace(/\s/g, "").length < 20) {
        linhas.push({ ...vazio, arquivo: arq.name, semTexto: true, avisos: ["PDF sem texto (provavelmente digitalizado): preencha à mão. A leitura por OCR ainda não está disponível."] });
        continue;
      }
      linhas.push({ ...lerOrcamentoDoTexto(texto, veiculos ?? [], oficinas ?? [], hoje), arquivo: arq.name, semTexto: false });
    } catch {
      linhas.push({ ...vazio, arquivo: arq.name, semTexto: false, avisos: ["Não consegui abrir este PDF."] });
    }
  }
  return { sucesso: true, linhas };
}

const esquemaLinha = z.object({
  veiculoId: z.uuid("Escolha o veículo"),
  oficinaId: z.uuid().nullable(),
  servico: z.string().trim().min(2, "Informe o serviço").max(80),
  valor: z.number({ error: "Informe o valor" }).positive("O valor deve ser maior que zero").max(99_999_999_999),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  descricao: z.string().trim().max(1000).nullable().optional(),
});

export type LinhaConfirmada = z.input<typeof esquemaLinha>;
export type ResultadoConfirmacao = { sucesso: true; criados: number; falhas: { posicao: number; erro: string }[] } | { sucesso: false; erro: string };

/** Grava as linhas conferidas como orçamentos "a analisar". Cada linha é validada de novo aqui; uma falha não derruba as outras. */
export async function confirmarOrcamentosPdf(linhas: LinhaConfirmada[]): Promise<ResultadoConfirmacao> {
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só o Setor de Frotas importa orçamentos." };
  if (!Array.isArray(linhas) || linhas.length === 0 || linhas.length > MAX_ARQUIVOS) return { sucesso: false, erro: "Nada para gravar." };
  const frotas = await criarClienteFrotas();
  let criados = 0;
  const falhas: { posicao: number; erro: string }[] = [];
  for (const [i, bruta] of linhas.entries()) {
    const a = esquemaLinha.safeParse(bruta);
    if (!a.success) {
      falhas.push({ posicao: i, erro: a.error.issues[0]?.message ?? "Dados inválidos" });
      continue;
    }
    const l = a.data;
    const { data: veiculo, error: erroVeiculo } = await frotas.from("veiculos").select("secretaria_id").eq("id", l.veiculoId).single();
    if (erroVeiculo || !veiculo) {
      falhas.push({ posicao: i, erro: "Veículo não encontrado." });
      continue;
    }
    const { error } = await frotas.from("manutencoes").insert({
      veiculo_id: l.veiculoId,
      secretaria_id: veiculo.secretaria_id,
      fornecedor_id: l.oficinaId,
      servico: l.servico,
      descricao: l.descricao || null,
      orcamento_valor: l.valor,
      orcamento_recebido_em: l.data,
      observacoes: "Importado de PDF",
    });
    if (error) falhas.push({ posicao: i, erro: "Não foi possível gravar esta linha." });
    else criados += 1;
  }
  revalidatePath("/frotas", "layout");
  return { sucesso: true, criados, falhas };
}
