"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { lerArquivoContas } from "@/lib/imoveis/importacao/xlsx-contas";
import { chave, chaveCodigo, type AbaLida } from "@/lib/imoveis/importacao/planilha-contas";
import { montarPrevia, planejarGravacao, type AbaPrevia, type DecisoesImportacao, type Existentes } from "@/lib/imoveis/importacao/plano-contas";
import { obterContextoImoveis } from "@/lib/imoveis/dados";
import { criarClienteImoveis } from "@/lib/supabase/imoveis-cliente";

/**
 * Importação das planilhas de CONTROLE de água e luz (uma aba por secretaria). Só o Setor de Imóveis. A planilha é lida de novo no
 * servidor na hora de gravar: nada que o navegador mande como "linhas já interpretadas" é confiado (só as decisões, validadas).
 * Os números mensais são lidos como VALOR em reais. Reimportar não duplica nem sobrescreve conta de mês já lançado.
 */

const LIMITE_ARQUIVO = 5 * 1024 * 1024;
const falha = (erro: string) => ({ sucesso: false as const, erro });

async function exigirGestor() {
  const ctx = await obterContextoImoveis();
  return ctx.situacao === "ok" && ctx.gestor ? ctx : null;
}

async function lerArquivo(form: FormData): Promise<{ abas: AbaLida[]; avisos: string[] } | { erro: string }> {
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha a planilha (.xlsx)." };
  if (!/\.xlsx$/i.test(arquivo.name)) return { erro: "O arquivo precisa ser uma planilha do Excel (.xlsx)." };
  if (arquivo.size > LIMITE_ARQUIVO) return { erro: "O arquivo passa de 5 MB." };
  try {
    return await lerArquivoContas(await arquivo.arrayBuffer());
  } catch (e) {
    console.error("[imoveis:importacao-contas] leitura do xlsx:", e);
    return { erro: "Não foi possível ler a planilha. Confira se é um .xlsx válido." };
  }
}

async function todas<T>(buscar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await buscar(de, de + 999);
    if (error) throw new Error("falha ao ler os dados existentes");
    tudo.push(...(data ?? []));
    if ((data ?? []).length < 1000) return tudo;
  }
}

async function carregarExistentes(): Promise<Existentes> {
  const imoveis = await criarClienteImoveis();
  const [secretarias, lista, unidades, contas] = await Promise.all([
    todas((de, ate) => imoveis.from("secretarias").select("id, nome").order("id").range(de, ate)),
    todas((de, ate) => imoveis.from("imoveis").select("id, nome, endereco, secretaria_id").order("id").range(de, ate)),
    todas((de, ate) => imoveis.from("unidades").select("id, imovel_id, tipo, numero").order("id").range(de, ate)),
    todas((de, ate) => imoveis.from("contas").select("unidade_id, referencia").order("id").range(de, ate)),
  ]);
  return { secretarias, imoveis: lista, unidades, contas };
}

const esquemaBasico = z.object({ tipo: z.enum(["agua", "luz"]), ano: z.coerce.number().int().min(2000).max(2100) });

export type ResultadoPrevia =
  | { sucesso: true; abas: AbaPrevia[]; avisos: string[]; secretarias: { id: string; nome: string }[]; imoveis: { id: string; nome: string; secretaria_id: string }[]; tipo: "agua" | "luz"; ano: number }
  | { sucesso: false; erro: string };

/** Lê a planilha e mostra o que aconteceria. Não grava nada. */
export async function previaPlanilhaContas(form: FormData): Promise<ResultadoPrevia> {
  if (!(await exigirGestor())) return falha("Só o Setor de Imóveis importa planilhas.");
  const b = esquemaBasico.safeParse({ tipo: form.get("tipo"), ano: form.get("ano") });
  if (!b.success) return falha("Escolha se a planilha é de água ou de luz e informe o ano.");
  const leitura = await lerArquivo(form);
  if ("erro" in leitura) return falha(leitura.erro);
  if (leitura.abas.every((a) => a.linhas.length === 0)) return falha("Não encontrei linhas de unidades nesta planilha. Ela precisa ter o cabeçalho com Código (CDC ou Matrícula), Setor, Endereço e os meses.");
  try {
    const ex = await carregarExistentes();
    return {
      sucesso: true,
      abas: montarPrevia(leitura.abas, b.data.tipo, b.data.ano, ex),
      avisos: leitura.avisos,
      secretarias: ex.secretarias,
      imoveis: ex.imoveis.map((i) => ({ id: i.id, nome: i.nome, secretaria_id: i.secretaria_id })),
      tipo: b.data.tipo,
      ano: b.data.ano,
    };
  } catch {
    return falha("Não foi possível consultar os dados do módulo. Tente novamente.");
  }
}

const esquemaDecisoes = z.object({
  tipo: z.enum(["agua", "luz"]),
  ano: z.number().int().min(2000).max(2100),
  vinculo: z.enum(["alugado", "proprio", "cedido"]),
  abas: z.record(z.string(), z.string()),
  linhas: z.record(z.string(), z.object({ incluir: z.boolean(), imovelId: z.uuid().nullable() })),
});

export type ResultadoImportacao =
  | { sucesso: true; secretariasCriadas: number; imoveisCriados: number; unidadesCriadas: number; contasGravadas: number; contasJaLancadas: number; linhas: number; avisos: string[] }
  | { sucesso: false; erro: string };

/** Grava o que foi confirmado. Não é uma transação única; se parar no meio, rodar de novo completa sem duplicar. */
export async function importarPlanilhaContas(form: FormData): Promise<ResultadoImportacao> {
  if (!(await exigirGestor())) return falha("Só o Setor de Imóveis importa planilhas.");
  let decisoes: DecisoesImportacao;
  try {
    const d = esquemaDecisoes.safeParse(JSON.parse(String(form.get("decisoes") ?? "")));
    if (!d.success) return falha("As escolhas da importação estão incompletas.");
    decisoes = d.data;
  } catch {
    return falha("As escolhas da importação estão ilegíveis.");
  }
  const leitura = await lerArquivo(form);
  if ("erro" in leitura) return falha(leitura.erro);

  let ex: Existentes;
  try {
    ex = await carregarExistentes();
  } catch {
    return falha("Não foi possível consultar os dados do módulo. Tente novamente.");
  }
  const idsSecretarias = new Set(ex.secretarias.map((s) => s.id));
  for (const [aba, escolha] of Object.entries(decisoes.abas)) {
    if (escolha !== "" && escolha !== "novo" && !idsSecretarias.has(escolha)) return falha(`A secretaria escolhida para a aba “${aba}” não existe.`);
  }
  const plano = planejarGravacao(leitura.abas, decisoes, ex);
  if (plano.linhasImportadas === 0) return falha("Nada para importar: marque ao menos uma linha e escolha a secretaria de cada aba.");

  const imoveis = await criarClienteImoveis();
  const erroGravacao = (onde: string, e: unknown) => {
    console.error(`[imoveis:importacao-contas] ${onde}:`, e);
    return falha(`Não foi possível gravar (${onde}). O que já foi gravado fica; rode de novo para completar, sem duplicar.`);
  };

  // 1. Secretarias novas (nome da aba).
  const secretariaId = new Map<string, string>(); // "novo:<aba>" -> id
  let secretariasCriadas = 0;
  for (const nome of plano.secretariasNovas) {
    const limpo = nome.trim().slice(0, 120);
    const ja = ex.secretarias.find((s) => chave(s.nome) === chave(limpo));
    if (ja) {
      secretariaId.set(`novo:${nome}`, ja.id);
      continue;
    }
    const { data, error } = await imoveis.from("secretarias").insert({ nome: limpo }).select("id").single();
    if (error) return erroGravacao("secretaria", error);
    secretariaId.set(`novo:${nome}`, data.id);
    secretariasCriadas++;
  }
  const resolver = (ref: string) => (ref.startsWith("novo:") ? secretariaId.get(ref) : ref);

  // 2. Imóveis novos.
  const imovelPorChave = new Map<string, string>();
  if (plano.imoveisNovos.length) {
    const linhas = plano.imoveisNovos.map((i) => ({ chave: i.chave, secretaria_id: resolver(i.secretaria) as string, nome: i.nome.slice(0, 160), endereco: i.endereco.slice(0, 240) }));
    const { data, error } = await imoveis
      .from("imoveis")
      .insert(linhas.map((l) => ({ secretaria_id: l.secretaria_id, nome: l.nome, endereco: l.endereco, vinculo: decisoes.vinculo })))
      .select("id, nome, endereco, secretaria_id");
    if (error) return erroGravacao("imóveis", error);
    const porTupla = new Map((data ?? []).map((r) => [`${r.secretaria_id}|${r.nome}|${r.endereco}`, r.id]));
    for (const l of linhas) {
      const id = porTupla.get(`${l.secretaria_id}|${l.nome}|${l.endereco}`);
      if (id) imovelPorChave.set(l.chave, id);
    }
  }

  // 3. Unidades novas.
  const unidadePorLinha = new Map<string, string>();
  if (plano.unidadesNovas.length) {
    const linhas = plano.unidadesNovas.map((u) => ({ linha: u.linha, imovel_id: "id" in u.imovel ? u.imovel.id : imovelPorChave.get(u.imovel.chaveNovo), tipo: decisoes.tipo, numero: u.codigo.slice(0, 40) }));
    if (linhas.some((l) => !l.imovel_id)) return erroGravacao("unidades", "imóvel sem id");
    const { data, error } = await imoveis.from("unidades").insert(linhas.map((l) => ({ imovel_id: l.imovel_id as string, tipo: l.tipo, numero: l.numero }))).select("id, numero");
    if (error) return erroGravacao("unidades", error);
    const porCodigo = new Map((data ?? []).map((r) => [chaveCodigo(r.numero), r.id]));
    for (const l of linhas) {
      const id = porCodigo.get(chaveCodigo(l.numero));
      if (id) unidadePorLinha.set(l.linha, id);
    }
  }
  const existentePorCodigo = new Map(ex.unidades.filter((u) => u.tipo === decisoes.tipo).map((u) => [chaveCodigo(u.numero), u.id]));
  const codigoDaLinha = new Map<string, string>(leitura.abas.flatMap((a) => a.linhas.map((l): [string, string] => [`${l.aba}#${l.linhaNumero}`, l.codigo])));

  // 4. Contas (nunca sobrescreve mês já lançado).
  const contas = plano.contas
    .map((c) => ({
      unidade_id: c.unidadeId ?? unidadePorLinha.get(c.linha) ?? existentePorCodigo.get(chaveCodigo(codigoDaLinha.get(c.linha) ?? "")),
      referencia: c.referencia,
      valor: c.valor,
      origem: "planilha" as const,
    }))
    .filter((c): c is { unidade_id: string; referencia: string; valor: number; origem: "planilha" } => !!c.unidade_id);
  for (let i = 0; i < contas.length; i += 500) {
    const { error } = await imoveis.from("contas").upsert(contas.slice(i, i + 500), { onConflict: "unidade_id,referencia", ignoreDuplicates: true });
    if (error) return erroGravacao("contas", error);
  }

  revalidatePath("/imoveis", "layout");
  return { sucesso: true, secretariasCriadas, imoveisCriados: imovelPorChave.size, unidadesCriadas: unidadePorLinha.size, contasGravadas: contas.length, contasJaLancadas: plano.contasJaLancadas, linhas: plano.linhasImportadas, avisos: plano.avisos };
}
