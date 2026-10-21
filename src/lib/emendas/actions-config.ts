"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";
import { obterContextoEmendas } from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";
import { lerPlanilha, type LinhaImportacao } from "@/lib/emendas/importacao/planilha";
import type { Resultado } from "@/lib/emendas/actions";

/**
 * Configurações do módulo Emendas (catálogos, permissões, importação).
 * Mesma regra das demais ações: a permissão de verdade é a RLS/RPC do
 * schema `emendas`; aqui só valida e traduz.
 */

function traduzir(erro: { message?: string; code?: string } | null | undefined): string {
  const m = erro?.message ?? "";
  if (erro?.code === "42501" || /row-level security/i.test(m)) return "Sem permissão para esta alteração.";
  if (/duplicate key|unique/i.test(m)) return "Já existe um cadastro com esse número/nome/código.";
  if (/check constraint/i.test(m)) return "Valor fora do formato aceito.";
  if (m && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(m) && !/^(new row|null value|insert|update|permission)/i.test(m)) return m;
  return "Não foi possível salvar. Tente novamente.";
}

async function exigirGestor() {
  const ctx = await obterContextoEmendas();
  return ctx.situacao === "ok" && ehGestor(ctx.perfil) ? ctx : null;
}

function revalidar() {
  revalidatePath("/emendas", "layout");
}

const opcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

// ---------------------------------------------------------------- exercício

const esquemaExercicio = z.object({
  ano: z.number().int().min(2020).max(2100),
  cota: z.number().positive("Informe a cota por vereador"),
  saudeMin: z.number().min(0).max(100),
  rcl: z.number().positive().nullable(),
  percentualRcl: z.number().min(0).max(100).nullable(),
  situacao: z.enum(["aberto", "encerrado"]),
});

export async function salvarExercicio(dados: z.input<typeof esquemaExercicio>): Promise<Resultado> {
  const a = esquemaExercicio.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só gestores configuram o módulo." };
  const emendas = await criarClienteEmendas();
  const { error } = await emendas.from("exercicios").upsert({
    ano: a.data.ano,
    cota_por_vereador: a.data.cota,
    percentual_saude_min: a.data.saudeMin,
    rcl: a.data.rcl,
    percentual_rcl: a.data.percentualRcl,
    situacao: a.data.situacao,
  });
  if (error) return { sucesso: false, erro: traduzir(error) };
  revalidar();
  return { sucesso: true };
}

// ---------------------------------------------------------------- vereadores

const esquemaVereador = z.object({
  id: z.uuid().optional(),
  numero: z.number().int().positive("Número inválido"),
  nome: z.string().trim().min(2, "Informe o nome").max(200),
  partido: opcional,
  ativo: z.boolean(),
});

export async function salvarVereador(dados: z.input<typeof esquemaVereador>): Promise<Resultado> {
  const a = esquemaVereador.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só gestores configuram o módulo." };
  const emendas = await criarClienteEmendas();
  const campos = { numero: a.data.numero, nome: a.data.nome, partido: a.data.partido, ativo: a.data.ativo };
  const { error } = a.data.id
    ? await emendas.from("vereadores").update(campos).eq("id", a.data.id)
    : await emendas.from("vereadores").insert(campos);
  if (error) return { sucesso: false, erro: traduzir(error) };
  revalidar();
  return { sucesso: true };
}

// ------------------------------------------------- secretarias e unidades

const esquemaSecretaria = z.object({
  id: z.uuid().optional(),
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  ativo: z.boolean(),
});

export async function salvarSecretaria(dados: z.input<typeof esquemaSecretaria>): Promise<Resultado> {
  const a = esquemaSecretaria.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só gestores configuram o módulo." };
  const emendas = await criarClienteEmendas();
  const { error } = a.data.id
    ? await emendas.from("secretarias").update({ nome: a.data.nome, ativo: a.data.ativo }).eq("id", a.data.id)
    : await emendas.from("secretarias").insert({ nome: a.data.nome, ativo: a.data.ativo });
  if (error) return { sucesso: false, erro: traduzir(error) };
  revalidar();
  return { sucesso: true };
}

const esquemaUnidade = z.object({
  id: z.uuid().optional(),
  codigo: z.string().trim().regex(/^\d{2}\.\d{2}$/, "Código no formato 02.09"),
  nome: z.string().trim().min(2, "Informe o nome").max(160),
  secretariaId: z.uuid("Escolha a secretaria"),
  ativo: z.boolean(),
});

export async function salvarUnidade(dados: z.input<typeof esquemaUnidade>): Promise<Resultado> {
  const a = esquemaUnidade.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só gestores configuram o módulo." };
  const emendas = await criarClienteEmendas();
  const campos = { codigo: a.data.codigo, nome: a.data.nome, secretaria_id: a.data.secretariaId, ativo: a.data.ativo };
  const { error } = a.data.id
    ? await emendas.from("unidades_orcamentarias").update(campos).eq("id", a.data.id)
    : await emendas.from("unidades_orcamentarias").insert(campos);
  if (error) return { sucesso: false, erro: traduzir(error) };
  revalidar();
  return { sucesso: true };
}

// ------------------------------------------------------------- beneficiários

const esquemaBeneficiario = z.object({
  id: z.uuid(),
  nome: z.string().trim().min(2).max(200),
  cnpj: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      const d = (v ?? "").replace(/\D/g, "");
      return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d ? "invalido" : null;
    })
    .refine((v) => v !== "invalido", "CNPJ precisa ter 14 dígitos"),
  tipo: z.enum(["entidade", "orgao_publico"]),
});

export async function salvarBeneficiario(dados: z.input<typeof esquemaBeneficiario>): Promise<Resultado> {
  const a = esquemaBeneficiario.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só gestores configuram o módulo." };
  const emendas = await criarClienteEmendas();
  const { error } = await emendas
    .from("beneficiarios")
    .update({ nome: a.data.nome, cnpj: a.data.cnpj, tipo: a.data.tipo })
    .eq("id", a.data.id);
  if (error) return { sucesso: false, erro: traduzir(error) };
  revalidar();
  return { sucesso: true };
}

// ------------------------------------------------------------- permissões

const esquemaAcesso = z.object({
  usuarioId: z.uuid(),
  perfil: z.enum(["gestor", "admin_secretaria", "operador", "consulta"]),
  secretariaId: z.uuid().nullable(),
  permissoes: z.array(z.object({ secretaria_id: z.uuid(), ver: z.boolean(), editar: z.boolean() })),
});

/** Matriz de permissões. Só o administrador do Hub e o gestor definem acessos
 * (decisão do dono: todo acesso passa por eles) — quem decide de verdade é
 * `emendas.definir_acesso`. */
export async function definirPermissoes(dados: z.input<typeof esquemaAcesso>): Promise<Resultado> {
  const a = esquemaAcesso.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok" || !ehGestor(ctx.perfil)) {
    return { sucesso: false, erro: "Só o administrador ou o gestor ajusta acessos." };
  }
  if (["admin_secretaria", "operador"].includes(a.data.perfil) && !a.data.secretariaId) {
    return { sucesso: false, erro: "Este perfil precisa da secretaria da pessoa." };
  }
  const emendas = await criarClienteEmendas();
  const { error } = await emendas.rpc("definir_acesso", {
    p_usuario: a.data.usuarioId,
    p_perfil: a.data.perfil,
    p_secretaria: a.data.secretariaId,
    p_permissoes: a.data.permissoes,
    p_ativo: true,
  });
  if (error) {
    console.error("[definirPermissoes]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidatePath("/emendas/configuracoes/usuarios");
  return { sucesso: true };
}

// ------------------------------------------------------------------- fases

const esquemaFluxo = z.object({
  modalidade: z.enum(["repasse", "direta"]),
  itens: z
    .array(
      z.object({
        chave: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/).nullable(),
        nome: z.string().trim().min(2, "O nome de cada fase precisa ter de 2 a 60 caracteres.").max(60, "O nome de cada fase precisa ter de 2 a 60 caracteres."),
        cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida."),
        ativa: z.boolean(),
        remover: z.boolean().optional(),
      })
    )
    .min(1, "Informe ao menos uma fase.")
    .max(40, "Fases demais neste fluxo."),
});

/** Salva o fluxo de uma modalidade (ordem, nomes, cores, ativação, novas
 * fases e exclusão de fases nunca usadas). As regras (fixas, ordem, uso)
 * vivem em `emendas.salvar_fluxo`; `validarFluxo` só antecipa o aviso. */
export async function salvarFluxo(dados: z.input<typeof esquemaFluxo>): Promise<Resultado> {
  const a = esquemaFluxo.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só o administrador ou o gestor edita as fases." };
  const emendas = await criarClienteEmendas();
  const { error } = await emendas.rpc("salvar_fluxo", { p_modalidade: a.data.modalidade, p_itens: a.data.itens });
  if (error) {
    console.error("[salvarFluxo]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar();
  return { sucesso: true };
}

// ---------------------------------------------------------------- importação

export type PreviaImportacao =
  | {
      sucesso: true;
      ano: number;
      abas: string[];
      linhas: LinhaImportacao[];
      erros: string[];
      avisos: string[];
      jaCadastradas: number[];
      totais: { valor: number; saude: number; pagas: number; empenhadas: number; remanejadas: number; comPendencia: number };
    }
  | { sucesso: false; erro: string };

async function lerArquivo(formData: FormData) {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha a planilha (.xlsx)." } as const;
  if (arquivo.size > 10 * 1024 * 1024) return { erro: "Planilha maior que 10 MB." } as const;
  if (!/\.xlsx$/i.test(arquivo.name)) return { erro: "Envie o arquivo no formato .xlsx (Excel)." } as const;
  try {
    return { leitura: await lerPlanilha(await arquivo.arrayBuffer()) } as const;
  } catch (e) {
    console.error("[importacao] leitura", e);
    return { erro: "Não foi possível ler a planilha. Confira se é um .xlsx válido." } as const;
  }
}

/** Passo 1: lê a planilha e confere contra o cadastro (vereadores,
 * unidades, cota, números já usados) — nada é gravado. */
export async function previaImportacao(formData: FormData): Promise<PreviaImportacao> {
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só gestores importam planilhas." };
  const ano = Number(formData.get("ano"));
  if (!Number.isInteger(ano)) return { sucesso: false, erro: "Escolha o exercício." };
  const r = await lerArquivo(formData);
  if ("erro" in r) return { sucesso: false, erro: r.erro as string };
  const { linhas, erros, abas } = r.leitura;

  const emendas = await criarClienteEmendas();
  const [{ data: exercicio }, { data: vereadores }, { data: unidades }, { data: existentes }] = await Promise.all([
    emendas.from("exercicios").select("*").eq("ano", ano).maybeSingle(),
    emendas.from("vereadores").select("numero"),
    emendas.from("unidades_orcamentarias").select("codigo"),
    emendas.from("emendas").select("numero,vereador_id,valor").eq("ano", ano),
  ]);
  if (!exercicio) return { sucesso: false, erro: `Exercício ${ano} não cadastrado. Cadastre-o na aba Exercício antes de importar.` };

  const avisos: string[] = [];
  const numerosVereadores = new Set((vereadores ?? []).map((v) => v.numero));
  const codigos = new Set((unidades ?? []).map((u) => u.codigo));
  const faltamVereadores = Array.from(new Set(linhas.filter((l) => !numerosVereadores.has(l.vereador_numero)).map((l) => `${l.vereador_numero} - ${l.vereador_nome}`)));
  const faltamUnidades = Array.from(new Set(linhas.filter((l) => !codigos.has(l.unidade_codigo)).map((l) => `${l.unidade_codigo} - ${l.unidade_nome}`)));
  if (faltamVereadores.length) erros.push(`Vereadores não cadastrados: ${faltamVereadores.join("; ")}. Cadastre-os na aba Vereadores.`);
  if (faltamUnidades.length) erros.push(`Unidades orçamentárias não cadastradas: ${faltamUnidades.join("; ")}. Cadastre-as na aba Secretarias.`);

  const porVereador = new Map<number, number>();
  for (const l of linhas) porVereador.set(l.vereador_numero, (porVereador.get(l.vereador_numero) ?? 0) + l.valor);
  for (const [n, total] of porVereador) {
    if (total > Number(exercicio.cota_por_vereador) + 0.005) {
      erros.push(`Vereador nº ${n}: soma de R$ ${total.toFixed(2)} passa a cota de R$ ${Number(exercicio.cota_por_vereador).toFixed(2)}.`);
    }
  }
  const jaCadastradas = linhas.filter((l) => (existentes ?? []).some((e) => e.numero === l.numero)).map((l) => l.numero);
  if (jaCadastradas.length) avisos.push(`${jaCadastradas.length} emendas já existem em ${ano} e serão ignoradas (nada é duplicado).`);

  return {
    sucesso: true,
    ano,
    abas,
    linhas,
    erros,
    avisos,
    jaCadastradas,
    totais: {
      valor: linhas.reduce((t, l) => t + l.valor, 0),
      saude: linhas.filter((l) => l.saude).reduce((t, l) => t + l.valor, 0),
      pagas: linhas.filter((l) => l.etapa === "paga").length,
      empenhadas: linhas.filter((l) => l.etapa === "empenhada").length,
      remanejadas: linhas.filter((l) => l.remanejamento).length,
      comPendencia: linhas.filter((l) => l.pendencias.length).length,
    },
  };
}

/** Passo 2: grava tudo numa transação só (`emendas.importar`). Relê o
 * arquivo em vez de confiar na prévia vinda do navegador. */
export async function confirmarImportacao(formData: FormData): Promise<
  { sucesso: true; criadas: number; ignoradas: number; remanejamentos: number; movimentos: number } | { sucesso: false; erro: string }
> {
  if (!(await exigirGestor())) return { sucesso: false, erro: "Só gestores importam planilhas." };
  const ano = Number(formData.get("ano"));
  const r = await lerArquivo(formData);
  if ("erro" in r) return { sucesso: false, erro: r.erro as string };
  if (r.leitura.erros.length) return { sucesso: false, erro: "A planilha tem linhas com erro — corrija e gere a prévia de novo." };

  const payload = r.leitura.linhas.map((l) => ({
    numero: l.numero,
    numero_vereador: l.numero_vereador,
    vereador_numero: l.vereador_numero,
    objeto: l.objeto,
    descricao: l.descricao,
    valor: l.valor,
    beneficiario: l.beneficiario,
    unidade_codigo: l.unidade_codigo,
    saude: l.saude,
    funcional: l.funcional,
    natureza: l.natureza,
    dotacao_texto: l.dotacao_texto,
    ficha: l.ficha,
    status_original: l.status_original,
    etapa: l.etapa,
    empenho: l.empenho,
    data_pagamento: l.data_pagamento,
    remanejamento: l.remanejamento,
  }));

  const emendas = await criarClienteEmendas();
  const { data, error } = await emendas.rpc("importar", { p_ano: ano, p_emendas: payload });
  if (error || !data) {
    console.error("[confirmarImportacao]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar();
  return { sucesso: true, ...data };
}
