"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { obterContextoImoveis } from "@/lib/imoveis/dados";
import { referenciaDe } from "@/lib/imoveis/regras";
import { criarClienteImoveis } from "@/lib/supabase/imoveis-cliente";

/**
 * Ações do módulo Imóveis e Consumo. A permissão de verdade está no banco (RLS do schema `imoveis`: só o gestor
 * escreve) e as regras de integridade também (CHECKs de datas da entrega, encerramento só com tudo resolvido,
 * uma conta por unidade e mês). Aqui só valida o formato, traduz o erro e revalida as telas. Nenhuma ação usa
 * service_role.
 */

export type Resultado = { sucesso: true; id?: string; aviso?: string } | { sucesso: false; erro: string };

type ErroBanco = { message?: string; code?: string } | null | undefined;

const MENSAGENS_DO_BANCO: [RegExp, string][] = [
  [/contas_unidade_mes_unico/i, "Já existe uma conta lançada para esta unidade neste mês."],
  [/unidades_numero_unico/i, "Já existe uma unidade com este número (matrícula ou UC)."],
  [/imobiliarias_nome_unico/i, "Já existe uma imobiliária com este nome."],
  [/secretarias_nome_unico/i, "Já existe uma secretaria com este nome."],
  [/encerra_so_com_tudo_resolvido/i, "Só dá para encerrar com água e luz desligadas, chaves entregues, vistoria concluída e a titularidade das duas trocada."],
  [/pedido_agua_antes_da_baixa/i, "A data de desligamento da água é anterior à do pedido."],
  [/pedido_luz_antes_da_baixa/i, "A data de desligamento da luz é anterior à do pedido."],
  [/vistoria_concluida_depois_da_agenda/i, "A vistoria foi concluída antes da data em que estava agendada."],
  [/vigencia_em_ordem/i, "O fim da vigência é anterior ao início."],
  [/pago_depois_da_referencia/i, "A data de pagamento é anterior ao mês da conta."],
  [/contas_referencia_check/i, "O mês de referência é inválido."],
  [/foreign key/i, "Este registro está em uso por outros e não pode ser removido."],
];

function traduzir(erro: ErroBanco): string {
  const m = erro?.message ?? "";
  if (erro?.code === "42501" || /row-level security/i.test(m)) return "Sem permissão para alterar os dados de Imóveis.";
  for (const [padrao, texto] of MENSAGENS_DO_BANCO) if (padrao.test(m)) return texto;
  return "Não foi possível concluir a ação. Tente novamente.";
}

async function exigirGestor() {
  const ctx = await obterContextoImoveis();
  return ctx.situacao === "ok" && ctx.gestor ? ctx : null;
}

function atualizarTelas() {
  revalidatePath("/imoveis", "layout");
}

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const dataOpcional = data.nullable().optional().transform((v) => v ?? null);
const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `No máximo ${max} caracteres`)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
const falha = (erro: string): Resultado => ({ sucesso: false, erro });
const invalido = (e: z.ZodError): Resultado => falha(e.issues[0]?.message ?? "Dados inválidos");
const SO_GESTOR = "Só o Setor de Imóveis altera os dados do módulo.";

// ------------------------------------------------------------- imóveis

const esquemaImovel = z.object({
  id: z.uuid().optional(),
  nome: z.string().trim().min(2, "Informe o nome do imóvel").max(160),
  endereco: z.string().trim().min(2, "Informe o endereço").max(240),
  secretariaId: z.uuid("Escolha a secretaria"),
  setor: texto(120),
  finalidade: texto(160),
  vinculo: z.enum(["alugado", "proprio", "cedido"]).optional().transform((v) => v ?? "alugado"),
  contratoNumero: texto(40),
  vigenciaInicio: dataOpcional,
  vigenciaFim: dataOpcional,
  valorAluguel: z.number({ error: "Informe o valor do aluguel" }).min(0).max(99_999_999),
  diaVencimento: z.number().int().min(1).max(31).nullable().optional().transform((v) => v ?? null),
  indiceReajuste: z.enum(["IPCA", "IGP-M", "INPC", "outro"]).nullable().optional().transform((v) => v ?? null),
  proximoReajuste: dataOpcional,
  imobiliariaId: z.uuid().nullable().optional().transform((v) => v ?? null),
  proprietarioNome: texto(160),
  proprietarioDocumento: texto(20),
  proprietarioContato: texto(120),
  proprietarioConta: texto(160),
  observacoes: texto(2000),
  /** Marca o cadastro como revisado: apaga o aviso "Cadastro para revisar". */
  revisado: z.boolean().optional(),
});

export async function salvarImovel(dados: z.input<typeof esquemaImovel>): Promise<Resultado> {
  const a = esquemaImovel.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha(SO_GESTOR);
  const { id, revisado, ...v } = a.data;
  const linha = {
    ...(id && revisado ? { revisar_motivo: null } : {}),
    nome: v.nome,
    endereco: v.endereco,
    secretaria_id: v.secretariaId,
    setor: v.setor,
    finalidade: v.finalidade,
    vinculo: v.vinculo,
    contrato_numero: v.contratoNumero,
    vigencia_inicio: v.vigenciaInicio,
    vigencia_fim: v.vigenciaFim,
    valor_aluguel: v.valorAluguel,
    dia_vencimento: v.diaVencimento,
    indice_reajuste: v.indiceReajuste,
    proximo_reajuste: v.proximoReajuste,
    imobiliaria_id: v.imobiliariaId,
    proprietario_nome: v.proprietarioNome,
    proprietario_documento: v.proprietarioDocumento,
    proprietario_contato: v.proprietarioContato,
    proprietario_conta: v.proprietarioConta,
    observacoes: v.observacoes,
  };
  const imoveis = await criarClienteImoveis();
  if (id) {
    const { error } = await imoveis.from("imoveis").update(linha).eq("id", id);
    if (error) return falha(traduzir(error));
    atualizarTelas();
    return { sucesso: true, id };
  }
  const { data: criado, error } = await imoveis.from("imoveis").insert(linha).select("id").single();
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true, id: criado.id };
}

export async function excluirImovel(id: string): Promise<Resultado> {
  if (!z.uuid().safeParse(id).success) return falha("Imóvel inválido.");
  if (!(await exigirGestor())) return falha(SO_GESTOR);
  const imoveis = await criarClienteImoveis();
  const { error } = await imoveis.from("imoveis").delete().eq("id", id);
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true };
}

// ------------------------------------------------------------- unidades consumidoras

const esquemaUnidade = z.object({
  id: z.uuid().optional(),
  imovelId: z.uuid(),
  tipo: z.enum(["agua", "luz"]),
  numero: z.string().trim().min(1, "Informe a matrícula ou UC").max(40),
  titular: texto(160),
  ativa: z.boolean(),
});

export async function salvarUnidade(dados: z.input<typeof esquemaUnidade>): Promise<Resultado> {
  const a = esquemaUnidade.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha(SO_GESTOR);
  const { id, imovelId, ...v } = a.data;
  const imoveis = await criarClienteImoveis();
  if (id) {
    const { error } = await imoveis.from("unidades").update({ tipo: v.tipo, numero: v.numero, titular: v.titular, ativa: v.ativa }).eq("id", id);
    if (error) return falha(traduzir(error));
    atualizarTelas();
    return { sucesso: true, id };
  }
  const { data: criada, error } = await imoveis
    .from("unidades")
    .insert({ imovel_id: imovelId, tipo: v.tipo, numero: v.numero, titular: v.titular, ativa: v.ativa })
    .select("id")
    .single();
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true, id: criada.id };
}

// ------------------------------------------------------------- contas

const esquemaConta = z.object({
  id: z.uuid().optional(),
  unidadeId: z.uuid("Escolha a unidade (matrícula ou UC)"),
  /** Qualquer dia do mês; vira o dia 1. */
  referencia: data,
  consumo: z.number().min(0).max(99_999_999).nullable().optional().transform((v) => v ?? null),
  valor: z.number({ error: "Informe o valor da conta" }).min(0).max(99_999_999),
  vencimento: dataOpcional,
  pagoEm: dataOpcional,
  observacao: texto(500),
  origem: z.enum(["digitada", "pdf"]).optional(),
});

export async function salvarConta(dados: z.input<typeof esquemaConta>): Promise<Resultado> {
  const a = esquemaConta.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha(SO_GESTOR);
  const { id, ...v } = a.data;
  const linha = {
    unidade_id: v.unidadeId,
    referencia: referenciaDe(v.referencia),
    consumo: v.consumo,
    valor: v.valor,
    vencimento: v.vencimento,
    pago_em: v.pagoEm,
    observacao: v.observacao,
    ...(v.origem ? { origem: v.origem } : {}),
  };
  const imoveis = await criarClienteImoveis();
  if (id) {
    const { error } = await imoveis.from("contas").update(linha).eq("id", id);
    if (error) return falha(traduzir(error));
    atualizarTelas();
    return { sucesso: true, id };
  }
  const { data: criada, error } = await imoveis.from("contas").insert(linha).select("id").single();
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true, id: criada.id };
}

export async function excluirConta(id: string): Promise<Resultado> {
  if (!z.uuid().safeParse(id).success) return falha("Conta inválida.");
  if (!(await exigirGestor())) return falha(SO_GESTOR);
  const imoveis = await criarClienteImoveis();
  const { error } = await imoveis.from("contas").delete().eq("id", id);
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true };
}

// ------------------------------------------------------------- entrega do imóvel

const esquemaEntrega = z.object({
  imovelId: z.uuid(),
  avisoSaidaEm: dataOpcional,
  aguaPedidoEm: dataOpcional,
  aguaProtocolo: texto(60),
  aguaDesligadaEm: dataOpcional,
  luzPedidoEm: dataOpcional,
  luzProtocolo: texto(60),
  luzDesligadaEm: dataOpcional,
  chavesEntreguesEm: dataOpcional,
  chavesEntreguePor: texto(160),
  chavesRecebidaPor: texto(160),
  vistoriaAgendadaEm: dataOpcional,
  vistoriador: texto(160),
  vistoriaConcluidaEm: dataOpcional,
  vistoriaObs: texto(2000),
  titularidadeAguaEm: dataOpcional,
  titularidadeLuzEm: dataOpcional,
  encerradoEm: dataOpcional,
  observacoes: texto(2000),
});

/** Grava a entrega inteira do imóvel (o formulário manda todos os campos). Cria a linha se ainda não existe. */
export async function salvarEntrega(dados: z.input<typeof esquemaEntrega>): Promise<Resultado> {
  const a = esquemaEntrega.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha(SO_GESTOR);
  const v = a.data;
  const imoveis = await criarClienteImoveis();
  const { error } = await imoveis.from("entregas").upsert(
    {
      id: v.imovelId,
      aviso_saida_em: v.avisoSaidaEm,
      agua_pedido_em: v.aguaPedidoEm,
      agua_protocolo: v.aguaProtocolo,
      agua_desligada_em: v.aguaDesligadaEm,
      luz_pedido_em: v.luzPedidoEm,
      luz_protocolo: v.luzProtocolo,
      luz_desligada_em: v.luzDesligadaEm,
      chaves_entregues_em: v.chavesEntreguesEm,
      chaves_entregue_por: v.chavesEntreguePor,
      chaves_recebida_por: v.chavesRecebidaPor,
      vistoria_agendada_em: v.vistoriaAgendadaEm,
      vistoriador: v.vistoriador,
      vistoria_concluida_em: v.vistoriaConcluidaEm,
      vistoria_obs: v.vistoriaObs,
      titularidade_agua_em: v.titularidadeAguaEm,
      titularidade_luz_em: v.titularidadeLuzEm,
      encerrado_em: v.encerradoEm,
      observacoes: v.observacoes,
    },
    { onConflict: "id" }
  );
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true, id: v.imovelId };
}

// ------------------------------------------------------------- cadastros de apoio

const esquemaImobiliaria = z.object({
  id: z.uuid().optional(),
  nome: z.string().trim().min(2, "Informe o nome").max(160),
  cnpj: texto(18),
  telefone: texto(40),
  email: texto(160),
  ativa: z.boolean(),
});

export async function salvarImobiliaria(dados: z.input<typeof esquemaImobiliaria>): Promise<Resultado> {
  const a = esquemaImobiliaria.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha(SO_GESTOR);
  const { id, ...resto } = a.data;
  const imoveis = await criarClienteImoveis();
  if (id) {
    const { error } = await imoveis.from("imobiliarias").update(resto).eq("id", id);
    if (error) return falha(traduzir(error));
    atualizarTelas();
    return { sucesso: true, id };
  }
  const { data: criada, error } = await imoveis.from("imobiliarias").insert(resto).select("id").single();
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true, id: criada.id };
}

const esquemaSecretaria = z.object({
  id: z.uuid().optional(),
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  ativa: z.boolean(),
});

export async function salvarSecretaria(dados: z.input<typeof esquemaSecretaria>): Promise<Resultado> {
  const a = esquemaSecretaria.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha(SO_GESTOR);
  const { id, ...resto } = a.data;
  const imoveis = await criarClienteImoveis();
  if (id) {
    const { error } = await imoveis.from("secretarias").update(resto).eq("id", id);
    if (error) return falha(traduzir(error));
    atualizarTelas();
    return { sucesso: true, id };
  }
  const { data: criada, error } = await imoveis.from("secretarias").insert(resto).select("id").single();
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true, id: criada.id };
}

// ------------------------------------------------------------- limites dos alertas

const inteiro = (min: number, max: number) => z.number({ error: "Informe um número" }).int("Use um número inteiro").min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`);

const esquemaParametros = z.object({
  pctAcima: inteiro(1, 1000),
  pctAbaixo: inteiro(1, 100),
  mesesMedia: inteiro(2, 11),
  diasFimContrato: inteiro(1, 365),
  diaLancamento: inteiro(1, 28),
  pctValor: inteiro(1, 1000),
  diasAtraso: inteiro(0, 90),
});

export async function salvarParametros(dados: z.input<typeof esquemaParametros>): Promise<Resultado> {
  const a = esquemaParametros.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha("Só o Setor de Imóveis altera os limites dos alertas.");
  const p = a.data;
  const imoveis = await criarClienteImoveis();
  const { error } = await imoveis
    .from("parametros")
    .update({
      pct_acima: p.pctAcima,
      pct_abaixo: p.pctAbaixo,
      meses_media: p.mesesMedia,
      dias_fim_contrato: p.diasFimContrato,
      dia_lancamento: p.diaLancamento,
      pct_valor: p.pctValor,
      dias_atraso: p.diasAtraso,
    })
    .eq("id", 1);
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true };
}

// ------------------------------------------------------------- pendências justificadas

const esquemaJustificativa = z.object({
  imovelId: z.uuid(),
  chave: z.string().trim().min(1).max(120),
  assinatura: z.string().max(300),
  justificativa: z.string().trim().min(3, "Escreva a justificativa (mínimo 3 caracteres)").max(500),
});

export async function justificarPendencia(dados: z.input<typeof esquemaJustificativa>): Promise<Resultado> {
  const a = esquemaJustificativa.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha(SO_GESTOR);
  const imoveis = await criarClienteImoveis();
  const { error } = await imoveis
    .from("pendencias_justificadas")
    .upsert({ imovel_id: a.data.imovelId, chave: a.data.chave, assinatura: a.data.assinatura, justificativa: a.data.justificativa }, { onConflict: "imovel_id,chave" });
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true };
}

export async function removerJustificativa(imovelId: string, chave: string): Promise<Resultado> {
  if (!z.uuid().safeParse(imovelId).success || !chave) return falha("Pendência inválida.");
  if (!(await exigirGestor())) return falha(SO_GESTOR);
  const imoveis = await criarClienteImoveis();
  const { error } = await imoveis.from("pendencias_justificadas").delete().eq("imovel_id", imovelId).eq("chave", chave);
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true };
}
