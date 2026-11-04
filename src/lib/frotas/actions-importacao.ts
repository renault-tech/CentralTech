"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dataNoFuso } from "@/lib/fuso";
import { obterContextoFrotas } from "@/lib/frotas/dados";
import { consultarPreco, ErroFipe, listarAnos, listarMarcas, listarModelos } from "@/lib/frotas/fipe";
import { candidatosModelo, escolherAno, escolherMarca, tipoFipeSugerido, type ItemFipe } from "@/lib/frotas/fipe-parse";
import { chaveTexto } from "@/lib/frotas/importacao/normalizar";
import { chaveVeiculo, type ResultadoLeitura } from "@/lib/frotas/importacao/planilha";
import { lerPlanilhaVeiculos } from "@/lib/frotas/importacao/xlsx";
import { criarClienteFrotas } from "@/lib/supabase/frotas-cliente";
import type { TipoFipe } from "@/types/frotas";

/**
 * Importação da planilha de veículos e consulta à FIPE. Só o Setor de Frotas
 * (gestor). A planilha é lida de novo no servidor na hora de gravar: nada que o
 * navegador mande como "linhas já interpretadas" é confiado.
 */

type Falha = { sucesso: false; erro: string };
const falha = (erro: string): Falha => ({ sucesso: false, erro });

async function exigirGestor() {
  const ctx = await obterContextoFrotas();
  return ctx.situacao === "ok" && ctx.gestor ? ctx : null;
}

const LIMITE_ARQUIVO = 5 * 1024 * 1024;

async function lerArquivo(formData: FormData): Promise<{ leitura: ResultadoLeitura } | Falha> {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return falha("Escolha o arquivo da planilha (.xlsx).");
  if (!/\.xlsx$/i.test(arquivo.name)) return falha("O arquivo precisa ser uma planilha do Excel (.xlsx).");
  if (arquivo.size > LIMITE_ARQUIVO) return falha("O arquivo passa de 5 MB.");
  try {
    return { leitura: await lerPlanilhaVeiculos(await arquivo.arrayBuffer()) };
  } catch (e) {
    console.error("[importacao] leitura do xlsx:", e);
    return falha("Não foi possível ler a planilha. Confira se o arquivo é um .xlsx válido.");
  }
}

export type PreviaImportacao = {
  abas: ResultadoLeitura["abas"];
  lidos: number;
  novos: number;
  jaExistem: number;
  secretariasNovas: string[];
  locadorasNovas: string[];
  avisos: string[];
  amostra: { placa: string | null; modelo: string; secretaria: string; vinculo: string; situacao: string }[];
};

type Existentes = { chaves: Set<string>; secretarias: Map<string, string>; locadoras: Map<string, string> };

async function lerExistentes(): Promise<Existentes | Falha> {
  const frotas = await criarClienteFrotas();
  const [veiculos, secretarias, locadoras] = await Promise.all([
    frotas.from("veiculos").select("vinculo,placa,patrimonio,modelo,ano_modelo").limit(5000),
    frotas.from("secretarias").select("id,nome"),
    frotas.from("fornecedores").select("id,nome").eq("tipo", "locadora"),
  ]);
  if (veiculos.error || secretarias.error || locadoras.error) {
    console.error("[importacao] leitura do que já existe:", veiculos.error ?? secretarias.error ?? locadoras.error);
    return falha("Não foi possível ler o cadastro atual. Tente novamente.");
  }
  return {
    chaves: new Set(veiculos.data.map((v) => chaveVeiculo({ vinculo: v.vinculo, placa: v.placa, patrimonio: v.patrimonio, modelo: v.modelo, ano_modelo: v.ano_modelo }))),
    secretarias: new Map(secretarias.data.map((s) => [chaveTexto(s.nome), s.id])),
    locadoras: new Map(locadoras.data.map((l) => [chaveTexto(l.nome), l.id])),
  };
}

/** Mostra o que a importação faria, sem gravar nada. */
export async function previaImportacao(formData: FormData): Promise<{ sucesso: true; previa: PreviaImportacao } | Falha> {
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas importa a planilha.");
  const lido = await lerArquivo(formData);
  if ("sucesso" in lido) return lido;
  const existentes = await lerExistentes();
  if ("sucesso" in existentes) return existentes;
  const { leitura } = lido;

  const novos = leitura.veiculos.filter((v) => !existentes.chaves.has(chaveVeiculo(v)));
  const locadoras = new Set(leitura.veiculos.map((v) => v.locadora).filter((l): l is string => !!l));
  return {
    sucesso: true,
    previa: {
      abas: leitura.abas,
      lidos: leitura.veiculos.length,
      novos: novos.length,
      jaExistem: leitura.veiculos.length - novos.length,
      secretariasNovas: leitura.secretariasNovas.filter((s) => !existentes.secretarias.has(chaveTexto(s))),
      locadorasNovas: [...locadoras].filter((l) => !existentes.locadoras.has(chaveTexto(l))),
      avisos: leitura.avisos,
      amostra: novos.slice(0, 8).map((v) => ({ placa: v.placa, modelo: v.modelo, secretaria: v.secretaria, vinculo: v.vinculo, situacao: v.situacao })),
    },
  };
}

export type ResultadoImportacao = { criados: number; jaExistiam: number; ignorados: number };

/** Grava só os veículos que ainda não existem: reimportar a mesma planilha não duplica nem sobrescreve nada. */
export async function importarVeiculos(formData: FormData): Promise<{ sucesso: true; resultado: ResultadoImportacao } | Falha> {
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas importa a planilha.");
  const lido = await lerArquivo(formData);
  if ("sucesso" in lido) return lido;
  const existentes = await lerExistentes();
  if ("sucesso" in existentes) return existentes;
  const frotas = await criarClienteFrotas();
  const { leitura } = lido;

  const novos = leitura.veiculos.filter((v) => !existentes.chaves.has(chaveVeiculo(v)));
  if (novos.length === 0) return { sucesso: true, resultado: { criados: 0, jaExistiam: leitura.veiculos.length, ignorados: 0 } };

  // Secretarias e locadoras que ainda não existem.
  const secretarias = existentes.secretarias;
  for (const nome of new Set(novos.map((v) => v.secretaria))) {
    if (secretarias.has(chaveTexto(nome))) continue;
    const { data, error } = await frotas.from("secretarias").insert({ nome }).select("id").single();
    if (error) return falha(`Não foi possível criar a secretaria “${nome}”.`);
    secretarias.set(chaveTexto(nome), data.id);
  }
  const locadoras = existentes.locadoras;
  for (const nome of new Set(novos.map((v) => v.locadora).filter((l): l is string => !!l))) {
    if (locadoras.has(chaveTexto(nome))) continue;
    const { data, error } = await frotas.from("fornecedores").insert({ tipo: "locadora", nome }).select("id").single();
    if (error) return falha(`Não foi possível criar a locadora “${nome}”.`);
    locadoras.set(chaveTexto(nome), data.id);
  }

  let ignorados = 0;
  const linhas = novos.flatMap((v) => {
    const locadoraId = v.locadora ? (locadoras.get(chaveTexto(v.locadora)) ?? null) : null;
    if (v.vinculo === "alugado" && !locadoraId) {
      ignorados += 1; // o banco exige a locadora do veículo alugado
      return [];
    }
    return [
      {
        placa: v.placa,
        modelo: v.modelo,
        marca: v.marca,
        ano_fabricacao: v.ano_fabricacao,
        ano_modelo: v.ano_modelo,
        combustivel: v.combustivel,
        classificacao: v.classificacao,
        patrimonio: v.patrimonio,
        vinculo: v.vinculo,
        secretaria_id: secretarias.get(chaveTexto(v.secretaria))!,
        setor: v.setor,
        situacao: v.situacao,
        motivo_situacao: v.motivo_situacao,
        finalidade: v.finalidade,
        locadora_id: v.vinculo === "alugado" ? locadoraId : null,
        origem: v.origem,
      },
    ];
  });

  let criados = 0;
  for (let i = 0; i < linhas.length; i += 100) {
    const lote = linhas.slice(i, i + 100);
    const { error } = await frotas.from("veiculos").insert(lote);
    if (error) {
      console.error("[importarVeiculos] lote", i, error);
      revalidatePath("/frotas", "layout");
      return falha(`A importação parou depois de ${criados} veículos (${error.message}). Rode de novo: o que já entrou não é repetido.`);
    }
    criados += lote.length;
  }
  revalidatePath("/frotas", "layout");
  return { sucesso: true, resultado: { criados, jaExistiam: leitura.veiculos.length - novos.length, ignorados } };
}

// ------------------------------------------------------------- FIPE

const esquemaBusca = z.object({ veiculoId: z.uuid(), tipo: z.enum(["carros", "motos", "caminhoes"]).optional() });

export type BuscaFipe = {
  tipo: TipoFipe;
  marca: ItemFipe | null;
  candidatos: (ItemFipe & { pontos: number })[];
  /** Quando a marca não foi achada sozinha: todas, para a pessoa escolher. */
  marcas: ItemFipe[];
};

/** Procura o veículo na FIPE: marca e os modelos mais parecidos com o cadastro. */
export async function buscarModelosFipe(dados: z.input<typeof esquemaBusca>): Promise<{ sucesso: true; busca: BuscaFipe } | Falha> {
  const a = esquemaBusca.safeParse(dados);
  if (!a.success) return falha("Dados inválidos");
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas consulta a FIPE.");
  const frotas = await criarClienteFrotas();
  const { data: v, error } = await frotas.from("veiculos").select("marca,modelo,classificacao").eq("id", a.data.veiculoId).single();
  if (error) return falha("Veículo não encontrado.");
  const tipo = a.data.tipo ?? tipoFipeSugerido(v);
  if (!tipo) return falha("A tabela FIPE não cobre máquinas. Informe o valor de referência na mão.");
  try {
    const marcas = await listarMarcas(tipo);
    const marca = escolherMarca(marcas, v.marca);
    const candidatos = marca ? candidatosModelo(await listarModelos(tipo, marca.codigo), v.modelo) : [];
    return { sucesso: true, busca: { tipo, marca, candidatos, marcas: marca ? [] : marcas } };
  } catch (e) {
    return falha(e instanceof ErroFipe ? e.message : "Não foi possível consultar a FIPE.");
  }
}

const esquemaCodigo = z.string().regex(/^[0-9A-Za-z._-]{1,24}$/);
const esquemaModelos = z.object({ tipo: z.enum(["carros", "motos", "caminhoes"]), marcaId: esquemaCodigo, veiculoId: z.uuid() });

/** Modelos de uma marca escolhida na mão (quando a marca não foi achada sozinha). */
export async function modelosDaMarcaFipe(dados: z.input<typeof esquemaModelos>): Promise<{ sucesso: true; candidatos: (ItemFipe & { pontos: number })[] } | Falha> {
  const a = esquemaModelos.safeParse(dados);
  if (!a.success) return falha("Dados inválidos");
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas consulta a FIPE.");
  const frotas = await criarClienteFrotas();
  const { data: v, error } = await frotas.from("veiculos").select("modelo").eq("id", a.data.veiculoId).single();
  if (error) return falha("Veículo não encontrado.");
  try {
    const modelos = await listarModelos(a.data.tipo, a.data.marcaId);
    const candidatos = candidatosModelo(modelos, v.modelo);
    return { sucesso: true, candidatos: candidatos.length ? candidatos : modelos.slice(0, 30).map((m) => ({ ...m, pontos: 0 })) };
  } catch (e) {
    return falha(e instanceof ErroFipe ? e.message : "Não foi possível consultar a FIPE.");
  }
}

const esquemaAnos = z.object({ tipo: z.enum(["carros", "motos", "caminhoes"]), marcaId: esquemaCodigo, modeloId: esquemaCodigo, veiculoId: z.uuid() });

export async function anosDoModeloFipe(dados: z.input<typeof esquemaAnos>): Promise<{ sucesso: true; anos: ItemFipe[]; sugerido: string | null } | Falha> {
  const a = esquemaAnos.safeParse(dados);
  if (!a.success) return falha("Dados inválidos");
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas consulta a FIPE.");
  const frotas = await criarClienteFrotas();
  const { data: v, error } = await frotas.from("veiculos").select("ano_modelo,ano_fabricacao,combustivel").eq("id", a.data.veiculoId).single();
  if (error) return falha("Veículo não encontrado.");
  try {
    const anos = await listarAnos(a.data.tipo, a.data.marcaId, a.data.modeloId);
    return { sucesso: true, anos, sugerido: escolherAno(anos, v.ano_modelo ?? v.ano_fabricacao, v.combustivel)?.codigo ?? null };
  } catch (e) {
    return falha(e instanceof ErroFipe ? e.message : "Não foi possível consultar a FIPE.");
  }
}

const esquemaAplicar = z.object({
  veiculoId: z.uuid(),
  tipo: z.enum(["carros", "motos", "caminhoes"]),
  marcaId: esquemaCodigo,
  modeloId: esquemaCodigo,
  anoId: esquemaCodigo,
});

/** Guarda o vínculo com a FIPE e o valor do mês no cadastro do veículo. */
export async function aplicarFipe(dados: z.input<typeof esquemaAplicar>): Promise<{ sucesso: true; valor: number; referencia: string } | Falha> {
  const a = esquemaAplicar.safeParse(dados);
  if (!a.success) return falha("Dados inválidos");
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas consulta a FIPE.");
  try {
    const preco = await consultarPreco(a.data.tipo, a.data.marcaId, a.data.modeloId, a.data.anoId);
    const frotas = await criarClienteFrotas();
    const { error } = await frotas
      .from("veiculos")
      .update({
        fipe_tipo: a.data.tipo,
        fipe_marca_id: a.data.marcaId,
        fipe_modelo_id: a.data.modeloId,
        fipe_ano_id: a.data.anoId,
        fipe_codigo: preco.codigoFipe,
        fipe_referencia: preco.referencia || null,
        valor_referencia: preco.valor,
        valor_fonte: "fipe",
        valor_referencia_em: dataNoFuso(new Date()),
      })
      .eq("id", a.data.veiculoId);
    if (error) return falha("O valor foi consultado, mas não foi possível gravar no cadastro.");
    revalidatePath("/frotas", "layout");
    return { sucesso: true, valor: preco.valor, referencia: preco.referencia };
  } catch (e) {
    return falha(e instanceof ErroFipe ? e.message : "Não foi possível consultar a FIPE.");
  }
}

const POR_RODADA = 25;

/** Atualiza o valor dos veículos já vinculados à FIPE (os de valor mais antigo primeiro; em rodadas de 25). */
export async function atualizarValoresFipe(): Promise<{ sucesso: true; atualizados: number; falhas: number; restantes: number } | Falha> {
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas consulta a FIPE.");
  const frotas = await criarClienteFrotas();
  const hoje = dataNoFuso(new Date());
  const { data, error } = await frotas
    .from("veiculos")
    .select("id,fipe_tipo,fipe_marca_id,fipe_modelo_id,fipe_ano_id,valor_referencia_em")
    .not("fipe_ano_id", "is", null)
    .or(`valor_referencia_em.is.null,valor_referencia_em.lt.${hoje.slice(0, 8)}01`)
    .order("valor_referencia_em", { ascending: true, nullsFirst: true })
    .limit(POR_RODADA + 1);
  if (error) return falha("Não foi possível ler os veículos vinculados à FIPE.");

  const fila = data.slice(0, POR_RODADA);
  let atualizados = 0;
  let falhas = 0;
  for (const v of fila) {
    if (!v.fipe_tipo || !v.fipe_marca_id || !v.fipe_modelo_id || !v.fipe_ano_id) continue;
    try {
      const preco = await consultarPreco(v.fipe_tipo, v.fipe_marca_id, v.fipe_modelo_id, v.fipe_ano_id);
      const { error: erroGravar } = await frotas
        .from("veiculos")
        .update({ valor_referencia: preco.valor, valor_fonte: "fipe", valor_referencia_em: hoje, fipe_referencia: preco.referencia || null })
        .eq("id", v.id);
      if (erroGravar) falhas += 1;
      else atualizados += 1;
    } catch (e) {
      falhas += 1;
      if (e instanceof ErroFipe && /limite/i.test(e.message)) break; // sem limite de consultas, parar já
    }
  }
  revalidatePath("/frotas", "layout");
  return { sucesso: true, atualizados, falhas, restantes: Math.max(0, data.length - POR_RODADA) };
}
