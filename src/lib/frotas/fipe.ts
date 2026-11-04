import "server-only";

import { lerLista, lerPreco, type ItemFipe, type PrecoFipe } from "@/lib/frotas/fipe-parse";
import type { TipoFipe } from "@/types/frotas";

/**
 * Consulta à tabela FIPE pela API pública da Parallelum (v2). Só roda no
 * servidor. `FIPE_API_URL` troca o endereço e `FIPE_API_TOKEN` (opcional)
 * envia o token de assinatura, que aumenta o limite diário de consultas.
 * NÃO testado contra a API real (o ambiente de desenvolvimento não alcança a
 * internet); a leitura das respostas é testada em `fipe-parse.test.ts`.
 */

const BASE = (process.env.FIPE_API_URL ?? "https://fipe.parallelum.com.br/api/v2").replace(/\/$/, "");
const TIPO_NA_API: Record<TipoFipe, string> = { carros: "cars", motos: "motorcycles", caminhoes: "trucks" };

export class ErroFipe extends Error {}

/** Os códigos da FIPE são curtos e alfanuméricos; qualquer outra coisa não entra na URL. */
const CODIGO_VALIDO = /^[0-9A-Za-z._-]{1,24}$/;

function codigo(valor: string): string {
  if (!CODIGO_VALIDO.test(valor)) throw new ErroFipe("Código da FIPE inválido.");
  return encodeURIComponent(valor);
}

async function pedir(caminho: string): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.FIPE_API_TOKEN) headers["X-Subscription-Token"] = process.env.FIPE_API_TOKEN;
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), 12_000);
  try {
    const resposta = await fetch(`${BASE}${caminho}`, { headers, signal: controle.signal, cache: "no-store" });
    if (resposta.status === 429) throw new ErroFipe("O limite de consultas à tabela FIPE foi atingido. Tente de novo mais tarde.");
    if (!resposta.ok) throw new ErroFipe(`A tabela FIPE respondeu com erro (${resposta.status}).`);
    return await resposta.json();
  } catch (e) {
    if (e instanceof ErroFipe) throw e;
    console.error("[fipe] falha:", caminho, e);
    throw new ErroFipe("A tabela FIPE não respondeu agora. Tente de novo em instantes.");
  } finally {
    clearTimeout(timer);
  }
}

export async function listarMarcas(tipo: TipoFipe): Promise<ItemFipe[]> {
  return lerLista(await pedir(`/${TIPO_NA_API[tipo]}/brands`));
}

export async function listarModelos(tipo: TipoFipe, marca: string): Promise<ItemFipe[]> {
  return lerLista(await pedir(`/${TIPO_NA_API[tipo]}/brands/${codigo(marca)}/models`));
}

export async function listarAnos(tipo: TipoFipe, marca: string, modelo: string): Promise<ItemFipe[]> {
  return lerLista(await pedir(`/${TIPO_NA_API[tipo]}/brands/${codigo(marca)}/models/${codigo(modelo)}/years`));
}

export async function consultarPreco(tipo: TipoFipe, marca: string, modelo: string, ano: string): Promise<PrecoFipe> {
  const json = await pedir(`/${TIPO_NA_API[tipo]}/brands/${codigo(marca)}/models/${codigo(modelo)}/years/${codigo(ano)}`);
  const preco = lerPreco(json);
  if (!preco) throw new ErroFipe("A tabela FIPE não trouxe o valor deste veículo.");
  return preco;
}
