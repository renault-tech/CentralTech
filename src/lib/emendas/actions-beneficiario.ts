"use server";

import { obterContextoEmendas } from "@/lib/emendas/dados";
import { lerBeneficiario, type BeneficiarioLido } from "@/lib/emendas/leitor-beneficiario";
import { ehGestor } from "@/lib/emendas/regras";
import { excedeuLimite, ipDoCliente } from "@/lib/seguranca/limite-requisicoes";

/**
 * Leitura de um documento (PDF) para cadastrar um beneficiário: o servidor lê o TEXTO e PROPÕE os campos; a tela preenche o
 * formulário e a pessoa confere antes de salvar. O PDF nunca é guardado (nem no banco, nem em disco, nem em bucket) e o CPF
 * não é lido. Só PDF com texto; documento digitalizado (imagem) volta "sem texto" e o cadastro é digitado.
 */

const MAX_BYTES = 5 * 1024 * 1024;

export type ResultadoLeituraBeneficiario =
  | { sucesso: true; semTexto: false; dados: BeneficiarioLido; avisos: string[] }
  | { sucesso: true; semTexto: true }
  | { sucesso: false; erro: string };

export async function lerDocumentoBeneficiario(form: FormData): Promise<ResultadoLeituraBeneficiario> {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok" || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só gestores cadastram beneficiários." };
  if (await excedeuLimite("emendas-ler-beneficiario", await ipDoCliente(), 30, 300)) return { sucesso: false, erro: "Muitas leituras seguidas. Aguarde alguns minutos." };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { sucesso: false, erro: "Escolha um PDF." };
  if (arquivo.size > MAX_BYTES) return { sucesso: false, erro: "O arquivo tem mais de 5 MB." };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return { sucesso: false, erro: "Envie um arquivo PDF." };

  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const texto = Array.isArray(text) ? text.join("\n") : text;
    if (texto.replace(/\s/g, "").length < 20) return { sucesso: true, semTexto: true };
    const { dados, avisos } = lerBeneficiario(texto);
    return { sucesso: true, semTexto: false, dados, avisos };
  } catch {
    return { sucesso: false, erro: "Não consegui abrir este PDF." };
  }
}
