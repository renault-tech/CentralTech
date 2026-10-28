"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { TAG_PORTAL } from "@/lib/emendas/portal-tag";

import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";
import { listarFasesCatalogo, obterCatalogoEtapas, obterContextoEmendas } from "@/lib/emendas/dados";
import { proporAlteracoes } from "@/lib/emendas/actions-propostas";
import { buscarProcessoPorNumero } from "@/lib/emendas/compras";
import { etapaAoConcluir, tipoDaEmenda } from "@/lib/emendas/fases";
import { escaparLike } from "@/lib/seguranca/escapar-like";
import { ehGestor, modalidadePorNatureza } from "@/lib/emendas/regras";

/**
 * Ações do módulo Emendas. A permissão de verdade está no banco (RLS +
 * RPCs do schema `emendas`) — aqui só valida o formato e traduz o erro.
 * Nenhuma ação usa service_role.
 */

export type Resultado = { sucesso: true; id?: string; aviso?: string } | { sucesso: false; erro: string };

function traduzir(erro: { message?: string; code?: string } | null | undefined): string {
  const m = erro?.message ?? "";
  if (erro?.code === "42501" || /row-level security/i.test(m)) {
    return "Sem permissão para alterar emendas desta secretaria.";
  }
  if (/duplicate key.*\(ano, numero\)|emendas_ano_numero_key/i.test(m)) return "Já existe uma emenda com este número neste exercício.";
  if (/emendas_ano_vereador_id_numero_vereador_key/i.test(m)) return "Este vereador já tem uma emenda com este ID neste exercício.";
  if (/não faz parte do fluxo ativo/i.test(m)) return "Esta fase não faz parte do fluxo ativo desta emenda (repasse × aplicação direta).";
  if (/beneficiarios_nome_unico/i.test(m)) return "Já existe um beneficiário com este nome.";
  // Mensagens das RPCs/triggers já são escritas em português para o usuário.
  if (m && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(m) && !/^(new row|null value|insert|update|permission)/i.test(m)) return m;
  return "Não foi possível concluir a ação. Tente novamente.";
}

async function exigirAcesso() {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return null;
  return ctx;
}

/**
 * Atualiza só a tela da emenda mexida: a resposta da própria action já traz a
 * página renderizada de novo (por isso os componentes não chamam `router.refresh()`
 * depois). Painel e listas são dinâmicos e buscam dados novos a cada visita, então
 * não precisam ser invalidados aqui.
 */
function revalidar(emendaId?: string) {
  revalidateTag(TAG_PORTAL, "max");
  revalidatePath(emendaId ? `/emendas/${emendaId}` : "/emendas", emendaId ? "page" : "layout");
}

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

// ------------------------------------------------------------- execução

const esquemaAndamento = z.object({
  emendaId: z.uuid(),
  // A lista de fases é editável (Configurações → Fases): quem decide se a fase
  // vale para a emenda é o banco (`validar_etapa_andamento`).
  etapa: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/, "Fase inválida").refine((e) => e !== "indicada", "Fase inválida"),
  data,
  documento: textoOpcional(100),
  observacao: textoOpcional(4000),
  valor: z.number().positive().nullable().optional(),
});

export async function registrarAndamento(dados: z.input<typeof esquemaAndamento>): Promise<Resultado> {
  const a = esquemaAndamento.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  if (!(await exigirAcesso())) return { sucesso: false, erro: "Sem acesso ao módulo." };

  const emendas = await criarClienteEmendas();
  const { data: id, error } = await emendas.rpc("registrar_andamento", {
    p_emenda: a.data.emendaId,
    p_etapa: a.data.etapa,
    p_data: a.data.data,
    p_documento: a.data.documento,
    p_observacao: a.data.observacao,
    p_valor: a.data.valor ?? null,
  });
  if (error) {
    console.error("[registrarAndamento]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(a.data.emendaId);
  return { sucesso: true, id: id ?? undefined };
}

// ------------------------------------------------------------- fases, checklist e pendências

const chave = z.string().regex(/^[a-z][a-z0-9_]{1,40}$/, "Chave inválida");

const esquemaFase = z.object({
  emendaId: z.uuid(),
  chave,
  situacao: z.enum(["pendente", "em_andamento", "concluida", "nao_se_aplica"]),
  data: data.nullable(),
  documento: textoOpcional(120),
  observacao: textoOpcional(2000),
});

/** Situação de uma fase MANUAL. Ao concluir uma fase que adianta a emenda, o cache
 * de etapa avança junto (registra o andamento, que também alimenta os avisos). */
export async function salvarFase(dados: z.input<typeof esquemaFase>): Promise<Resultado> {
  const a = esquemaFase.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await exigirAcesso();
  if (!ctx) return { sucesso: false, erro: "Sem acesso ao módulo." };

  const emendas = await criarClienteEmendas();
  const { data: emenda, error: erroEmenda } = await emendas
    .from("v_emendas")
    .select("id,modalidade,tipo_execucao,etapa,situacao")
    .eq("id", a.data.emendaId)
    .maybeSingle();
  if (erroEmenda || !emenda) return { sucesso: false, erro: "Emenda não encontrada." };
  const fase = (await listarFasesCatalogo()).find((f) => f.tipo === tipoDaEmenda(emenda) && f.chave === a.data.chave);
  if (!fase || fase.derivacao) return { sucesso: false, erro: "Esta fase vem de outro dado e não é editada aqui." };

  if (!ehGestor(ctx.perfil)) {
    const { data: atual } = await emendas.from("emenda_fases").select("*").eq("emenda_id", a.data.emendaId).eq("chave", a.data.chave).maybeSingle();
    if (atual && atual.situacao !== "pendente") {
      const falha = await proporAlteracoes(a.data.emendaId, [
        {
          alvo: "emenda_fases",
          chave: a.data.chave,
          campo: null,
          valorAtual: { situacao: atual.situacao, data: atual.data, documento: atual.documento, observacao: atual.observacao },
          valorProposto: { situacao: a.data.situacao, data: a.data.data, documento: a.data.documento, observacao: a.data.observacao },
        },
      ]);
      if (falha) return { sucesso: false, erro: falha };
      revalidar(a.data.emendaId);
      return { sucesso: true, aviso: "Alteração enviada para aprovação do gestor." };
    }
  }
  const { error } = await emendas.from("emenda_fases").upsert({
    emenda_id: a.data.emendaId,
    chave: a.data.chave,
    situacao: a.data.situacao,
    data: a.data.data,
    documento: a.data.documento,
    observacao: a.data.observacao,
    origem: "manual",
    atualizado_por: ctx.usuario.id,
    atualizado_em: new Date().toISOString(),
  });
  if (error) {
    console.error("[salvarFase]", error);
    return { sucesso: false, erro: traduzir(error) };
  }

  if (a.data.situacao === "concluida" && emenda.situacao === "normal") {
    const proxima = etapaAoConcluir(fase, emenda.etapa, emenda.modalidade, await obterCatalogoEtapas());
    if (proxima && proxima !== "indicada") {
      const { error: erroAvanco } = await emendas.rpc("registrar_andamento", {
        p_emenda: a.data.emendaId,
        p_etapa: proxima,
        p_data: a.data.data ?? new Date().toISOString().slice(0, 10),
        p_documento: a.data.documento,
        p_observacao: `Fase "${fase.nome}" concluída`,
        p_valor: null,
      });
      // A fase já foi gravada; se a etapa não vale para o fluxo desta emenda, só não avança o cache.
      if (erroAvanco) console.error("[salvarFase:avanco]", erroAvanco);
    }
  }
  revalidar(a.data.emendaId);
  return { sucesso: true };
}

const esquemaItemChecklist = z.object({
  emendaId: z.uuid(),
  itemChave: chave,
  estado: z.enum(["conferido", "presumido", "pendente", "nao_se_aplica"]),
  observacao: textoOpcional(1000),
});

export async function salvarItemChecklist(dados: z.input<typeof esquemaItemChecklist>): Promise<Resultado> {
  const a = esquemaItemChecklist.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await exigirAcesso();
  if (!ctx) return { sucesso: false, erro: "Sem acesso ao módulo." };
  // "Presumido" só nasce de importação; na tela a pessoa confere ou deixa pendente.
  if (a.data.estado === "presumido") return { sucesso: false, erro: "Estado inválido." };

  const emendas = await criarClienteEmendas();
  const conferido = a.data.estado === "conferido";
  if (!ehGestor(ctx.perfil)) {
    const { data: atual } = await emendas.from("emenda_checklist").select("estado").eq("emenda_id", a.data.emendaId).eq("item_chave", a.data.itemChave).maybeSingle();
    if (atual && atual.estado !== "pendente" && atual.estado !== a.data.estado) {
      const falha = await proporAlteracoes(a.data.emendaId, [
        { alvo: "emenda_checklist", chave: a.data.itemChave, campo: null, valorAtual: { estado: atual.estado }, valorProposto: { estado: a.data.estado } },
      ]);
      if (falha) return { sucesso: false, erro: falha };
      revalidar(a.data.emendaId);
      return { sucesso: true, aviso: "Alteração enviada para aprovação do gestor." };
    }
  }
  const { error } = await emendas.from("emenda_checklist").upsert({
    emenda_id: a.data.emendaId,
    item_chave: a.data.itemChave,
    estado: a.data.estado,
    observacao: a.data.observacao,
    conferido_por: conferido ? ctx.usuario.id : null,
    conferido_em: conferido ? new Date().toISOString() : null,
  });
  if (error) {
    console.error("[salvarItemChecklist]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(a.data.emendaId);
  return { sucesso: true };
}

const esquemaJustificativa = z.object({
  emendaId: z.uuid(),
  regra: z.string().regex(/^[a-z][a-z0-9_:]{1,60}$/, "Regra inválida"),
  assinatura: z.string().min(1).max(500),
  justificativa: z.string().trim().min(5, "Explique em ao menos 5 caracteres").max(1000),
});

export async function justificarPendencia(dados: z.input<typeof esquemaJustificativa>): Promise<Resultado> {
  const a = esquemaJustificativa.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await exigirAcesso();
  if (!ctx) return { sucesso: false, erro: "Sem acesso ao módulo." };

  const emendas = await criarClienteEmendas();
  const { error } = await emendas.from("pendencias_justificadas").upsert({
    emenda_id: a.data.emendaId,
    regra: a.data.regra,
    assinatura: a.data.assinatura,
    justificativa: a.data.justificativa,
    por: ctx.usuario.id,
    em: new Date().toISOString(),
  });
  if (error) {
    console.error("[justificarPendencia]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(a.data.emendaId);
  return { sucesso: true };
}

export async function removerJustificativa(emendaId: string, regra: string): Promise<Resultado> {
  if (!z.uuid().safeParse(emendaId).success) return { sucesso: false, erro: "Dados inválidos" };
  if (!(await exigirAcesso())) return { sucesso: false, erro: "Sem acesso ao módulo." };
  const emendas = await criarClienteEmendas();
  const { error } = await emendas.from("pendencias_justificadas").delete().eq("emenda_id", emendaId).eq("regra", regra);
  if (error) return { sucesso: false, erro: traduzir(error) };
  revalidar(emendaId);
  return { sucesso: true };
}

const esquemaMovimento = z.object({
  emendaId: z.uuid(),
  tipo: z.enum(["empenho", "liquidacao", "pagamento", "anulacao"]),
  numero: textoOpcional(40),
  data: data.nullable(),
  valor: z.number().positive("Informe um valor maior que zero"),
  observacao: textoOpcional(1000),
});

export async function registrarMovimento(dados: z.input<typeof esquemaMovimento>): Promise<Resultado> {
  const a = esquemaMovimento.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await exigirAcesso();
  if (!ctx) return { sucesso: false, erro: "Sem acesso ao módulo." };

  const emendas = await criarClienteEmendas();
  const { error } = await emendas.from("movimentos_financeiros").insert({
    emenda_id: a.data.emendaId,
    tipo: a.data.tipo,
    numero: a.data.numero,
    data: a.data.data,
    valor: a.data.valor,
    observacao: a.data.observacao,
    usuario_id: ctx.usuario.id,
  });
  if (error) {
    console.error("[registrarMovimento]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(a.data.emendaId);
  return { sucesso: true };
}

const dataOpcional = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida");

const esquemaExecucao = z
  .object({
    emendaId: z.uuid(),
    numeroTermo: textoOpcional(40),
    processoLicitatorio: textoOpcional(200),
    dataEnvioPagamento: dataOpcional,
    vigenciaInicio: dataOpcional,
    vigenciaFim: dataOpcional,
    dataPublicacaoExtrato: dataOpcional,
    contaBancaria: textoOpcional(200),
    gestorOsc: textoOpcional(200),
    gestorPmc: textoOpcional(200),
    observacao: textoOpcional(2000),
  })
  .refine((d) => !d.vigenciaInicio || !d.vigenciaFim || d.vigenciaFim >= d.vigenciaInicio, {
    message: "O fim da vigência não pode ser antes do início.",
  });

/** Parceria e execução (termo, vigência, extrato, conta, gestores). Grava quem registra a execução da emenda. */
export async function salvarExecucao(dados: z.input<typeof esquemaExecucao>): Promise<Resultado> {
  const a = esquemaExecucao.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await exigirAcesso();
  if (!ctx) return { sucesso: false, erro: "Sem acesso ao módulo." };

  const emendas = await criarClienteEmendas();
  const campos: Record<string, string | null> = {
    numero_termo: a.data.numeroTermo,
    processo_licitatorio: a.data.processoLicitatorio,
    data_envio_pagamento: a.data.dataEnvioPagamento,
    vigencia_inicio: a.data.vigenciaInicio,
    vigencia_fim: a.data.vigenciaFim,
    data_publicacao_extrato: a.data.dataPublicacaoExtrato,
    conta_bancaria: a.data.contaBancaria,
    gestor_osc: a.data.gestorOsc,
    gestor_pmc: a.data.gestorPmc,
    observacao: a.data.observacao,
  };
  // Gestor/admin gravam direto. Secretaria: campo vazio grava; campo já preenchido
  // que muda vira proposta para o gestor aprovar.
  let aviso: string | undefined;
  if (!ehGestor(ctx.perfil)) {
    const { data: atual } = await emendas.from("execucao").select("*").eq("id", a.data.emendaId).maybeSingle();
    const propostas = [];
    for (const [campo, novo] of Object.entries(campos)) {
      const antigo = (atual as Record<string, unknown> | null)?.[campo] ?? null;
      if (antigo !== null && antigo !== "" && antigo !== novo) {
        propostas.push({ alvo: "execucao" as const, chave: null, campo, valorAtual: antigo, valorProposto: novo });
        delete campos[campo];
      }
    }
    const falha = await proporAlteracoes(a.data.emendaId, propostas);
    if (falha) return { sucesso: false, erro: falha };
    if (propostas.length) aviso = `${propostas.length} alteração(ões) em dado já preenchido enviada(s) para aprovação do gestor.`;
  }
  const { error } = await emendas.from("execucao").upsert({
    id: a.data.emendaId,
    ...campos,
    atualizado_em: new Date().toISOString(),
    atualizado_por: ctx.usuario.id,
  });
  if (error) {
    console.error("[salvarExecucao]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(a.data.emendaId);
  return { sucesso: true, aviso };
}

/** Liga a emenda a um processo do Compras pelo número (AAAA/NNNN ou NNN/AAAA). Vazio desfaz o vínculo. */
export async function vincularProcesso(emendaId: string, numero: string): Promise<Resultado> {
  if (!z.uuid().safeParse(emendaId).success) return { sucesso: false, erro: "Dados inválidos" };
  const ctx = await exigirAcesso();
  if (!ctx) return { sucesso: false, erro: "Sem acesso ao módulo." };
  const emendas = await criarClienteEmendas();

  // A RLS decide se a pessoa edita esta emenda: sem permissão, a leitura volta vazia.
  const { data: visivel } = await emendas.from("v_emendas").select("id").eq("id", emendaId).maybeSingle();
  if (!visivel) return { sucesso: false, erro: "Emenda não encontrada." };

  const texto = numero.trim();
  const processo = texto ? await buscarProcessoPorNumero(texto) : null;
  if (texto && !processo) return { sucesso: false, erro: "Processo não encontrado no Compras. Use 2026/0062 (processo) ou 136/2026 (licitação)." };

  const { data: atual } = await emendas.from("execucao").select("processo_id,processo_licitatorio").eq("id", emendaId).maybeSingle();
  const novoTexto = processo ? (processo.numero_licitacao ?? processo.numero) : null;
  const temAtual = !!(atual?.processo_id || atual?.processo_licitatorio);
  const mudou = (atual?.processo_id ?? null) !== (processo?.id ?? null) || (atual?.processo_licitatorio ?? null) !== novoTexto;
  if (!ehGestor(ctx.perfil) && temAtual && mudou) {
    const falha = await proporAlteracoes(emendaId, [
      { alvo: "execucao", chave: null, campo: "processo_id", valorAtual: atual?.processo_id ?? null, valorProposto: processo?.id ?? null },
      { alvo: "execucao", chave: null, campo: "processo_licitatorio", valorAtual: atual?.processo_licitatorio ?? null, valorProposto: novoTexto },
    ]);
    if (falha) return { sucesso: false, erro: falha };
    return { sucesso: true, aviso: "Troca de processo enviada para aprovação do gestor." };
  }
  const { error } = await emendas.from("execucao").upsert({
    id: emendaId,
    processo_id: processo?.id ?? null,
    processo_licitatorio: processo ? (processo.numero_licitacao ?? processo.numero) : null,
    atualizado_em: new Date().toISOString(),
    atualizado_por: ctx.usuario.id,
  });
  if (error) {
    console.error("[vincularProcesso]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(emendaId);
  return { sucesso: true };
}

const esquemaCorrecaoMovimento = z.object({
  id: z.uuid(),
  emendaId: z.uuid(),
  numero: textoOpcional(40),
  data: data.nullable(),
});

/** Completar nº de empenho / data de pagamento que vieram faltando (ex.:
 * importados da planilha). Só gestor (RLS de update). */
export async function corrigirMovimento(dados: z.input<typeof esquemaCorrecaoMovimento>): Promise<Resultado> {
  const a = esquemaCorrecaoMovimento.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await exigirAcesso();
  if (!ctx || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só gestores corrigem movimentos já registrados." };

  const emendas = await criarClienteEmendas();
  const { error } = await emendas.from("movimentos_financeiros").update({ numero: a.data.numero, data: a.data.data }).eq("id", a.data.id);
  if (error) {
    console.error("[corrigirMovimento]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(a.data.emendaId);
  return { sucesso: true };
}

const esquemaImpedimento = z.object({
  emendaId: z.uuid(),
  tipo: z.enum(["tecnico", "legal", "documentacao"]),
  justificativa: z.string().trim().min(10, "Descreva o impedimento (mínimo 10 caracteres)").max(4000),
  data,
});

export async function registrarImpedimento(dados: z.input<typeof esquemaImpedimento>): Promise<Resultado> {
  const a = esquemaImpedimento.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await exigirAcesso();
  if (!ctx) return { sucesso: false, erro: "Sem acesso ao módulo." };

  const emendas = await criarClienteEmendas();
  const { error } = await emendas.from("impedimentos").insert({
    emenda_id: a.data.emendaId,
    tipo: a.data.tipo,
    justificativa: a.data.justificativa,
    data: a.data.data,
    usuario_id: ctx.usuario.id,
  });
  if (error) {
    console.error("[registrarImpedimento]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(a.data.emendaId);
  return { sucesso: true };
}

const esquemaResolucao = z.object({
  id: z.uuid(),
  emendaId: z.uuid(),
  resolucao: z.string().trim().min(3, "Descreva como foi resolvido").max(2000),
});

export async function resolverImpedimento(dados: z.input<typeof esquemaResolucao>): Promise<Resultado> {
  const a = esquemaResolucao.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  if (!(await exigirAcesso())) return { sucesso: false, erro: "Sem acesso ao módulo." };

  const emendas = await criarClienteEmendas();
  const hoje = new Date().toISOString().slice(0, 10);
  const { error } = await emendas
    .from("impedimentos")
    .update({ resolvido_em: hoje, resolucao: a.data.resolucao })
    .eq("id", a.data.id);
  if (error) {
    console.error("[resolverImpedimento]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(a.data.emendaId);
  return { sucesso: true };
}

// --------------------------------------------------------- cadastro

const esquemaEmenda = z.object({
  id: z.uuid().optional(),
  ano: z.number().int(),
  numero: z.number().int().positive("Informe o número da emenda"),
  numeroVereador: z.number().int().positive("Informe o ID da emenda do vereador"),
  vereadorId: z.uuid("Escolha o vereador"),
  objeto: z.string().trim().min(3, "Informe o objeto (resumo)").max(300),
  descricao: z.string().trim().min(3, "Informe a descrição").max(4000),
  valor: z.number().positive("Informe um valor maior que zero"),
  beneficiarioId: z.uuid().nullable(),
  beneficiarioNovo: textoOpcional(200),
  unidadeId: z.uuid("Escolha a unidade orçamentária"),
  saude: z.boolean(),
  funcional: textoOpcional(40),
  natureza: z
    .string()
    .trim()
    .regex(/^\d\.\d\.\d{2}\.\d{2}$/, "Natureza no formato 3.3.50.43")
    .or(z.literal(""))
    .optional()
    .transform((v) => (v ? v : null)),
  dotacaoTexto: textoOpcional(1000),
  ficha: textoOpcional(300),
  modalidade: z.enum(["repasse", "direta"]),
  tipoExecucao: z.enum(["direta", "osc", "ente"]),
});

async function resolverBeneficiario(
  emendas: Awaited<ReturnType<typeof criarClienteEmendas>>,
  id: string | null,
  novo: string | null
): Promise<{ id: string | null; erro?: string }> {
  if (!novo) return { id };
  const { data: existente } = await emendas.from("beneficiarios").select("id").ilike("nome", escaparLike(novo)).maybeSingle();
  if (existente) return { id: existente.id };
  const { data, error } = await emendas
    .from("beneficiarios")
    .insert({ nome: novo, tipo: /^secretaria/i.test(novo) ? "orgao_publico" : "entidade" })
    .select("id")
    .single();
  if (error) return { id: null, erro: traduzir(error) };
  return { id: data.id };
}

export async function salvarEmenda(dados: z.input<typeof esquemaEmenda>): Promise<Resultado> {
  const a = esquemaEmenda.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await exigirAcesso();
  if (!ctx || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só gestores cadastram e corrigem emendas." };

  const emendas = await criarClienteEmendas();
  const benef = await resolverBeneficiario(emendas, a.data.beneficiarioId, a.data.beneficiarioNovo);
  if (benef.erro) return { sucesso: false, erro: benef.erro };

  const campos = {
    ano: a.data.ano,
    numero: a.data.numero,
    numero_vereador: a.data.numeroVereador,
    vereador_id: a.data.vereadorId,
    objeto: a.data.objeto,
    descricao: a.data.descricao,
    valor: Math.round(a.data.valor * 100) / 100,
    beneficiario_id: benef.id,
    unidade_id: a.data.unidadeId,
    saude: a.data.saude,
    funcional_programatica: a.data.funcional,
    natureza_despesa: a.data.natureza,
    dotacao_texto: a.data.dotacaoTexto,
    ficha: a.data.ficha,
    modalidade: modalidadePorNatureza(a.data.natureza) ?? a.data.modalidade,
    tipo_execucao: a.data.tipoExecucao,
  };

  const resposta = a.data.id
    ? await emendas.from("emendas").update(campos).eq("id", a.data.id).select("id").single()
    : await emendas.from("emendas").insert(campos).select("id").single();
  if (resposta.error) {
    console.error("[salvarEmenda]", resposta.error);
    return { sucesso: false, erro: traduzir(resposta.error) };
  }
  revalidar(resposta.data.id);
  return { sucesso: true, id: resposta.data.id };
}

const esquemaRemanejamento = z.object({
  emendaId: z.uuid(),
  ato: textoOpcional(200),
  motivo: z.string().trim().min(5, "Informe o motivo do remanejamento").max(2000),
  novo: z.object({
    objeto: z.string().trim().min(3).max(300).optional(),
    descricao: z.string().trim().min(3).max(4000).optional(),
    valor: z.number().positive().optional(),
    beneficiario_id: z.uuid().nullable().optional(),
    beneficiarioNovo: textoOpcional(200),
    unidade_id: z.uuid().optional(),
    saude: z.boolean().optional(),
    funcional_programatica: z.string().trim().max(40).optional(),
    natureza_despesa: z.string().trim().regex(/^\d\.\d\.\d{2}\.\d{2}$/).optional(),
    dotacao_texto: z.string().trim().max(1000).optional(),
    ficha: z.string().trim().max(300).optional(),
  }),
});

export async function remanejarEmenda(dados: z.input<typeof esquemaRemanejamento>): Promise<Resultado> {
  const a = esquemaRemanejamento.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await exigirAcesso();
  if (!ctx || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só gestores remanejam emendas." };

  const emendas = await criarClienteEmendas();
  const { beneficiarioNovo, ...novo } = a.data.novo;
  if (beneficiarioNovo) {
    const benef = await resolverBeneficiario(emendas, null, beneficiarioNovo);
    if (benef.erro) return { sucesso: false, erro: benef.erro };
    novo.beneficiario_id = benef.id;
  }
  const { error } = await emendas.rpc("remanejar", {
    p_emenda: a.data.emendaId,
    p_novo: novo,
    p_ato: a.data.ato,
    p_motivo: a.data.motivo,
  });
  if (error) {
    console.error("[remanejarEmenda]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(a.data.emendaId);
  return { sucesso: true };
}

export async function definirCancelamento(emendaId: string, cancelada: boolean): Promise<Resultado> {
  if (!z.uuid().safeParse(emendaId).success) return { sucesso: false, erro: "Emenda inválida" };
  const ctx = await exigirAcesso();
  if (!ctx || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só gestores cancelam emendas." };
  const emendas = await criarClienteEmendas();
  const { error } = await emendas.from("emendas").update({ situacao: cancelada ? "cancelada" : "normal" }).eq("id", emendaId);
  if (error) {
    console.error("[definirCancelamento]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(emendaId);
  return { sucesso: true };
}

// ------------------------------------------------------------ documentos

const esquemaDocumento = z.object({
  emendaId: z.uuid(),
  tipo: z.enum([
    "plano_trabalho",
    "certidoes",
    "termo",
    "pedido",
    "processo_compra",
    "nota_empenho",
    "nota_fiscal",
    "comprovante_pagamento",
    "prestacao_contas",
    "outro",
  ]),
  nomeArquivo: z.string().trim().min(1).max(255),
  caminho: z.string().min(3).max(500),
  tamanho: z.number().int().nonnegative().nullable(),
});

/** Registra um anexo já enviado ao bucket `emendas-documentos` pelo
 * navegador (a policy de storage confere a permissão no envio). */
export async function registrarDocumento(dados: z.input<typeof esquemaDocumento>): Promise<Resultado> {
  const a = esquemaDocumento.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  if (!a.data.caminho.startsWith(`${a.data.emendaId}/`)) return { sucesso: false, erro: "Caminho de arquivo inválido." };
  const ctx = await exigirAcesso();
  if (!ctx) return { sucesso: false, erro: "Sem acesso ao módulo." };

  const emendas = await criarClienteEmendas();
  const { error } = await emendas.from("documentos").insert({
    emenda_id: a.data.emendaId,
    tipo: a.data.tipo,
    nome_arquivo: a.data.nomeArquivo,
    caminho: a.data.caminho,
    tamanho: a.data.tamanho,
    usuario_id: ctx.usuario.id,
  });
  if (error) {
    console.error("[registrarDocumento]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(a.data.emendaId);
  return { sucesso: true };
}

export async function removerDocumento(id: string, emendaId: string): Promise<Resultado> {
  if (!z.uuid().safeParse(id).success) return { sucesso: false, erro: "Documento inválido" };
  if (!(await exigirAcesso())) return { sucesso: false, erro: "Sem acesso ao módulo." };
  const emendas = await criarClienteEmendas();
  const { data: doc } = await emendas.from("documentos").select("caminho").eq("id", id).maybeSingle();
  if (!doc) return { sucesso: false, erro: "Documento não encontrado." };
  const { error: erroStorage } = await emendas.storage.from("emendas-documentos").remove([doc.caminho]);
  if (erroStorage) {
    console.error("[removerDocumento] storage", erroStorage);
    return { sucesso: false, erro: "Sem permissão para remover este arquivo." };
  }
  const { error } = await emendas.from("documentos").delete().eq("id", id);
  if (error) {
    console.error("[removerDocumento]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(emendaId);
  return { sucesso: true };
}

/** Link temporário (5 min) para baixar um anexo — gerado com a sessão de
 * quem pede, então a policy de leitura do bucket decide. */
export async function linkDocumento(caminho: string): Promise<{ url: string | null }> {
  if (!(await exigirAcesso())) return { url: null };
  const emendas = await criarClienteEmendas();
  const { data } = await emendas.storage.from("emendas-documentos").createSignedUrl(caminho, 300);
  return { url: data?.signedUrl ?? null };
}
