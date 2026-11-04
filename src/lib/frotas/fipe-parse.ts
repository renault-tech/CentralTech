/**
 * Parte pura da consulta à tabela FIPE: leitura das respostas da API e a
 * escolha de marca, modelo e ano a partir do cadastro do veículo. A chamada
 * de rede fica em `fipe.ts`. Testado em `fipe-parse.test.ts`.
 */

import { chaveTexto } from "@/lib/frotas/importacao/normalizar";
import type { Combustivel, TipoFipe, Veiculo } from "@/types/frotas";

export type ItemFipe = { codigo: string; nome: string };

/** "R$ 72.000,00" → 72000. */
export function precoParaNumero(texto: string): number | null {
  const limpo = texto.replace(/[^\d,]/g, "").replace(",", ".");
  const n = Number(limpo);
  return limpo && Number.isFinite(n) ? n : null;
}

/** A API devolve a lista direto (`[{code, name}]`) ou embrulhada (`{modelos: [{codigo, nome}]}`); aceita as duas. */
export function lerLista(json: unknown): ItemFipe[] {
  const bruto = Array.isArray(json)
    ? json
    : json && typeof json === "object"
      ? (((json as Record<string, unknown>).modelos ?? (json as Record<string, unknown>).anos ?? []) as unknown[])
      : [];
  const itens: ItemFipe[] = [];
  for (const i of bruto) {
    if (!i || typeof i !== "object") continue;
    const o = i as Record<string, unknown>;
    const codigo = o.code ?? o.codigo;
    const nome = o.name ?? o.nome;
    if ((typeof codigo === "string" || typeof codigo === "number") && typeof nome === "string") itens.push({ codigo: String(codigo), nome });
  }
  return itens;
}

export type PrecoFipe = { valor: number; referencia: string; codigoFipe: string | null; modelo: string | null };

export function lerPreco(json: unknown): PrecoFipe | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const texto = o.price ?? o.Valor;
  if (typeof texto !== "string") return null;
  const valor = precoParaNumero(texto);
  if (valor === null) return null;
  const ref = o.referenceMonth ?? o.MesReferencia;
  const cod = o.codeFipe ?? o.CodigoFipe;
  const modelo = o.model ?? o.Modelo;
  return {
    valor,
    referencia: typeof ref === "string" ? ref.trim() : "",
    codigoFipe: typeof cod === "string" ? cod : null,
    modelo: typeof modelo === "string" ? modelo : null,
  };
}

/** Tipo de consulta mais provável (a pessoa pode trocar na tela). Máquinas não têm FIPE. */
export function tipoFipeSugerido(v: Pick<Veiculo, "classificacao">): TipoFipe | null {
  if (v.classificacao === "maquina") return null;
  if (v.classificacao === "moto") return "motos";
  if (v.classificacao === "pesado") return "caminhoes";
  return "carros";
}

/** Marca da FIPE que corresponde à do cadastro ("VW - VolksWagen" para "Volkswagen"). */
export function escolherMarca(marcas: ItemFipe[], marca: string | null): ItemFipe | null {
  const k = chaveTexto(marca ?? "");
  if (!k) return null;
  return marcas.find((m) => chaveTexto(m.nome).includes(k)) ?? null;
}

const IGNORAR = new Set(["de", "da", "do", "e", "com", "mt", "at"]);

function palavras(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter((p) => p.length > 1 && !IGNORAR.has(p));
}

/** Palavra do nome pesa mais que número ("argo" mais que "1.0"): "Palio 1.0" não pode vencer "Argo HGT" para "ARGO 1.0". */
const peso = (p: string) => (/[a-z]/.test(p) && p.length > 2 ? 2 : 1);

/** Peso das palavras do modelo do cadastro que aparecem no nome do modelo da FIPE (0 a 1). */
export function pontuarModelo(modeloCadastro: string, nomeFipe: string): number {
  const alvo = palavras(modeloCadastro);
  if (alvo.length === 0) return 0;
  const fipe = new Set(palavras(nomeFipe));
  const total = alvo.reduce((a, p) => a + peso(p), 0);
  return alvo.filter((p) => fipe.has(p)).reduce((a, p) => a + peso(p), 0) / total;
}

/** Os modelos da FIPE que mais se parecem com o do cadastro, do melhor para o pior. */
export function candidatosModelo(modelos: ItemFipe[], modeloCadastro: string, limite = 8): (ItemFipe & { pontos: number })[] {
  return modelos
    .map((m) => ({ ...m, pontos: pontuarModelo(modeloCadastro, m.nome) }))
    .filter((m) => m.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || a.nome.length - b.nome.length)
    .slice(0, limite);
}

const COMBUSTIVEL_NA_FIPE: Record<Combustivel, string> = { gasolina: "gasolina", flex: "flex", diesel: "diesel", diesel_s10: "diesel" };

/** Ano da FIPE ("2018-1" / "2018 Gasolina") para o ano do modelo e o combustível do cadastro. */
export function escolherAno(anos: ItemFipe[], anoModelo: number | null, combustivel: Combustivel | null): ItemFipe | null {
  if (anoModelo === null) return null;
  const doAno = anos.filter((a) => a.nome.startsWith(String(anoModelo)) || a.codigo.startsWith(`${anoModelo}-`));
  if (doAno.length <= 1) return doAno[0] ?? null;
  const alvo = combustivel ? COMBUSTIVEL_NA_FIPE[combustivel] : null;
  return (alvo && doAno.find((a) => chaveTexto(a.nome).includes(alvo))) || doAno[0];
}
