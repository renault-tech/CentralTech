"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { TAG_PORTAL } from "@/lib/emendas/portal-tag";

import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";
import { listarFasesCatalogo, listarItensChecklist, obterCatalogoEtapas, obterContextoEmendas, podeEditarSecretaria } from "@/lib/emendas/dados";
import { avancarEtapaPorLancamentos, avancarEtapaPorProcesso } from "@/lib/emendas/etapa-financeira";
import { proporAlteracoes } from "@/lib/emendas/actions-propostas";
import { buscarProcessoPorNumero, sugerirProcessos, type SugestaoProcesso } from "@/lib/emendas/compras";
import { excedeuLimite, ipDoCliente } from "@/lib/seguranca/limite-requisicoes";
import { calcularFasesDaEmenda } from "@/lib/emendas/calculos";
import { etapaAoConcluir, motivoBloqueioConclusao, tipoDaEmenda, totaisFinanceiros } from "@/lib/emendas/fases";
import { extrairDaDescricao, validarDocumento, type TipoBeneficiario } from "@/lib/emendas/documentos";
import { escaparLike } from "@/lib/seguranca/escapar-like";
import { brl, ehGestor, etapaAposExclusao, etapaDoMovimento, modalidadePorNatureza } from "@/lib/emendas/regras";

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

  if (a.data.etapa === "liquidada") return { sucesso: false, erro: "A liquidação deixou de ser uma fase da execução." };

  // Concluir a emenda só é possível com todas as outras fases completas.
  if (a.data.etapa === "concluida") {
    const fases = await calcularFasesDaEmenda(a.data.emendaId);
    const motivo = fases ? motivoBloqueioConclusao(fases) : null;
    if (motivo) return { sucesso: false, erro: motivo };
  }

  // Empenho e pagamento têm UM só lugar: a aba Financeiro. O andamento financeiro vira lançamento (com a mesma
  // checagem de saldo e a mesma aprovação para perfis de secretaria) e a etapa sobe sozinha quando o total fecha.
  if (a.data.etapa === "empenhada" || a.data.etapa === "paga") {
    if (!a.data.valor) return { sucesso: false, erro: `Informe o valor ${a.data.etapa === "paga" ? "pago" : "empenhado"}: ele é lançado na aba Financeiro e a etapa só avança quando o total fecha.` };
    return registrarMovimento({
      emendaId: a.data.emendaId,
      tipo: a.data.etapa === "paga" ? "pagamento" : "empenho",
      numero: a.data.documento ?? undefined,
      data: a.data.data,
      valor: a.data.valor,
      observacao: a.data.observacao ?? undefined,
    });
  }

  const emendas = await criarClienteEmendas();
  const { data: id, error } = await emendas.rpc("registrar_andamento", {
    p_emenda: a.data.emendaId,
    p_etapa: a.data.etapa,
    p_data: a.data.data,
    p_documento: a.data.documento,
    p_observacao: a.data.observacao,
    p_valor: null,
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
  if (fase.etapa === "concluida" && a.data.situacao === "concluida") {
    const calculadas = await calcularFasesDaEmenda(a.data.emendaId);
    const motivo = calculadas ? motivoBloqueioConclusao(calculadas) : null;
    if (motivo) return { sucesso: false, erro: motivo };
  }

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

/** Volta uma fase manual a "pendente" (preenchida por engano). Só gestor. Se a conclusão dela tinha avançado a etapa
 * da emenda, o andamento que ela criou sai do histórico e a etapa volta ao que restou. */
export async function desfazerFase(dados: { emendaId: string; chave: string }): Promise<Resultado> {
  if (!z.uuid().safeParse(dados.emendaId).success || !/^[a-z][a-z0-9_]{1,40}$/.test(dados.chave)) return { sucesso: false, erro: "Dados inválidos" };
  const ctx = await exigirAcesso();
  if (!ctx || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só gestores voltam uma fase para pendente." };
  const emendas = await criarClienteEmendas();
  const { data: emenda } = await emendas.from("v_emendas").select("id,modalidade,tipo_execucao").eq("id", dados.emendaId).maybeSingle();
  if (!emenda) return { sucesso: false, erro: "Emenda não encontrada." };
  const fase = (await listarFasesCatalogo()).find((f) => f.tipo === tipoDaEmenda(emenda) && f.chave === dados.chave);
  if (!fase || fase.derivacao) return { sucesso: false, erro: "Esta fase vem de outro dado (lançamentos, termo, parecer…): corrija na origem." };
  const { error } = await emendas.from("emenda_fases").upsert({
    emenda_id: dados.emendaId, chave: dados.chave, situacao: "pendente", data: null, documento: null, observacao: null,
    origem: "manual", atualizado_por: ctx.usuario.id, atualizado_em: new Date().toISOString(),
  });
  if (error) {
    console.error("[desfazerFase]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  // O andamento criado ao concluir a fase (mesmo texto de salvarFase) sai; o gatilho recalcula a etapa.
  const { data: removidos } = await emendas.from("andamentos").delete().eq("emenda_id", dados.emendaId).eq("etapa", fase.etapa).eq("observacao", `Fase "${fase.nome}" concluída`).select("id");
  revalidar(dados.emendaId);
  return { sucesso: true, aviso: removidos?.length ? "Fase voltou para pendente e a etapa da emenda foi recalculada." : "Fase voltou para pendente." };
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
  const { data: emendaAlvo } = await emendas.from("v_emendas").select("tipo_execucao,modalidade").eq("id", a.data.emendaId).maybeSingle();
  if (!emendaAlvo) return { sucesso: false, erro: "Emenda não encontrada." };
  const itemValido = (await listarItensChecklist()).some((i) => i.tipo === tipoDaEmenda(emendaAlvo) && i.chave === a.data.itemChave && i.ativo);
  if (!itemValido) return { sucesso: false, erro: "Item de documentação inválido para este tipo de emenda." };
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

/** Bloqueia lançamento acima do disponível: empenho até o valor da emenda; liquidação, pagamento e anulação até o empenhado. */
async function conferirSaldo(emendas: Awaited<ReturnType<typeof criarClienteEmendas>>, emendaId: string, tipo: string, valor: number): Promise<string | null> {
  const [{ data: em }, { data: movs }] = await Promise.all([
    emendas.from("emendas").select("valor").eq("id", emendaId).maybeSingle(),
    emendas.from("movimentos_financeiros").select("tipo,valor").eq("emenda_id", emendaId),
  ]);
  if (!em) return null;
  const t = totaisFinanceiros(movs ?? []);
  const fmt = (v: number) => brl(Math.max(0, v));
  if (tipo === "empenho" && valor > Number(em.valor) - t.empenhado + 0.005)
    return `O empenho de ${brl(valor)} passa do disponível para empenhar (${fmt(Number(em.valor) - t.empenhado)}).`;
  if (tipo === "liquidacao" && valor > t.empenhado - t.liquidado + 0.005)
    return `A liquidação de ${brl(valor)} passa do disponível para liquidar (${fmt(t.empenhado - t.liquidado)} do empenhado).`;
  if (tipo === "pagamento" && valor > t.empenhado - t.pago + 0.005)
    return `O pagamento de ${brl(valor)} passa do disponível para pagar (${fmt(t.empenhado - t.pago)} do empenhado).`;
  if (tipo === "anulacao" && valor > t.empenhado - t.pago + 0.005)
    return `A anulação de ${brl(valor)} passa do que pode ser anulado (${fmt(t.empenhado - t.pago)}: empenhado menos o já pago).`;
  return null;
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
  const barrado = await conferirSaldo(emendas, a.data.emendaId, a.data.tipo, a.data.valor);
  if (barrado) return { sucesso: false, erro: barrado };
  // Perfis de secretaria não lançam direto: o lançamento espera a aprovação do gestor.
  if (!ehGestor(ctx.perfil)) {
    const falha = await proporAlteracoes(a.data.emendaId, [
      {
        alvo: "movimentos",
        chave: a.data.tipo,
        campo: null,
        valorAtual: null,
        valorProposto: { tipo: a.data.tipo, numero: a.data.numero, data: a.data.data, valor: a.data.valor, observacao: a.data.observacao },
      },
    ]);
    if (falha) return { sucesso: false, erro: falha };
    revalidar(a.data.emendaId);
    return { sucesso: true, aviso: "Lançamento enviado para aprovação do gestor. Ele só passa a valer depois de aprovado." };
  }
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
  await avancarEtapaPorLancamentos(emendas, a.data.emendaId);
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

type CamposExecucao = Record<string, string | number | null>;

/** Grava campos de `execucao`: gestor/admin direto; secretaria grava campo vazio e propõe a troca de campo já preenchido. */
async function gravarCamposExecucao(emendaId: string, campos: CamposExecucao, rotulo: string): Promise<Resultado> {
  const ctx = await exigirAcesso();
  if (!ctx) return { sucesso: false, erro: "Sem acesso ao módulo." };
  const emendas = await criarClienteEmendas();
  let aviso: string | undefined;
  if (!ehGestor(ctx.perfil)) {
    const { data: atual } = await emendas.from("execucao").select("*").eq("id", emendaId).maybeSingle();
    const propostas = [];
    for (const [campo, novo] of Object.entries(campos)) {
      const antigo = (atual as Record<string, unknown> | null)?.[campo] ?? null;
      const mudou = typeof antigo === "number" && typeof novo === "number" ? antigo !== novo : String(antigo ?? "") !== String(novo ?? "");
      if (antigo !== null && antigo !== "" && mudou) {
        propostas.push({ alvo: "execucao" as const, chave: null, campo, valorAtual: antigo as string, valorProposto: novo === null ? null : String(novo) });
        delete campos[campo];
      }
    }
    const falha = await proporAlteracoes(emendaId, propostas);
    if (falha) return { sucesso: false, erro: falha };
    if (propostas.length) aviso = `${propostas.length} alteração(ões) em dado já preenchido enviada(s) para aprovação do gestor.`;
  }
  const { error } = await emendas.from("execucao").upsert({
    id: emendaId,
    ...campos,
    atualizado_em: new Date().toISOString(),
    atualizado_por: ctx.usuario.id,
  });
  if (error) {
    console.error(`[${rotulo}]`, error);
    return { sucesso: false, erro: traduzir(error) };
  }
  revalidar(emendaId);
  return { sucesso: true, aviso };
}

/** Parceria e execução (termo, vigência, extrato, conta, gestores). Grava quem registra a execução da emenda. */
export async function salvarExecucao(dados: z.input<typeof esquemaExecucao>): Promise<Resultado> {
  const a = esquemaExecucao.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const r = await salvarExecucaoCampos(a.data);
  if (r.sucesso && !r.aviso && a.data.processoLicitatorio) await ligarProcessoPeloTexto(a.data.emendaId, a.data.processoLicitatorio);
  return r;
}

/** O número do processo escrito na execução já basta para ligar ao Compras: só gestor, só se achar um único processo e nunca troca um vínculo já feito. */
async function ligarProcessoPeloTexto(emendaId: string, texto: string) {
  try {
    const ctx = await exigirAcesso();
    if (!ctx || !ehGestor(ctx.perfil)) return;
    const emendas = await criarClienteEmendas();
    const { data: x } = await emendas.from("execucao").select("processo_id").eq("id", emendaId).maybeSingle();
    if (x?.processo_id) return;
    const achados = new Map<string, string>();
    for (const t of new Set(texto.match(/\d{1,4}\/\d{4}/g) ?? [])) {
      const p = await buscarProcessoPorNumero(t);
      if (p) achados.set(p.id, p.id);
    }
    if (achados.size !== 1) return;
    await emendas.from("execucao").update({ processo_id: [...achados.keys()][0], atualizado_em: new Date().toISOString(), atualizado_por: ctx.usuario.id }).eq("id", emendaId);
    await avancarEtapaPorProcesso(emendas, emendaId);
    revalidar(emendaId);
  } catch (e) {
    console.error("[ligarProcessoPeloTexto]", e);
  }
}

async function salvarExecucaoCampos(a: z.output<typeof esquemaExecucao>): Promise<Resultado> {
  return gravarCamposExecucao(
    a.emendaId,
    {
      numero_termo: a.numeroTermo,
      processo_licitatorio: a.processoLicitatorio,
      data_envio_pagamento: a.dataEnvioPagamento,
      vigencia_inicio: a.vigenciaInicio,
      vigencia_fim: a.vigenciaFim,
      data_publicacao_extrato: a.dataPublicacaoExtrato,
      conta_bancaria: a.contaBancaria,
      gestor_osc: a.gestorOsc,
      gestor_pmc: a.gestorPmc,
      observacao: a.observacao,
    },
    "salvarExecucao"
  );
}

const valorOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v.replace(/\./g, "").replace(",", ".")))
  .refine((v) => v === null || /^\d{1,12}(\.\d{1,2})?$/.test(v), "Valor inválido (use números, ex.: 1.500,00)");

const esquemaTransparencia = z
  .object({
    emendaId: z.uuid(),
    localidade: textoOpcional(200),
    inicioPrevisto: dataOpcional,
    terminoPrevisto: dataOpcional,
    planoMetas: textoOpcional(4000),
    planoOutrasFontes: valorOpcional,
    anuenciaSus: z.enum(["sim", "nao", "nao_se_aplica"]).nullable(),
    anuenciaSusData: dataOpcional,
    identificadorContabil: textoOpcional(120),
    fonteRecurso: textoOpcional(120),
  })
  .refine((d) => !d.inicioPrevisto || !d.terminoPrevisto || d.terminoPrevisto >= d.inicioPrevisto, {
    message: "O término previsto não pode ser antes do início.",
  });

/** Dados de transparência exigidos pela IN TCE-MG 05/2025 (art. 7º): localidade, cronograma, plano de trabalho, SUS, identificador contábil. */
export async function salvarTransparencia(dados: z.input<typeof esquemaTransparencia>): Promise<Resultado> {
  const a = esquemaTransparencia.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  return gravarCamposExecucao(
    a.data.emendaId,
    {
      localidade: a.data.localidade,
      inicio_previsto: a.data.inicioPrevisto,
      termino_previsto: a.data.terminoPrevisto,
      plano_metas: a.data.planoMetas,
      plano_outras_fontes: a.data.planoOutrasFontes,
      anuencia_sus: a.data.anuenciaSus,
      anuencia_sus_data: a.data.anuenciaSusData,
      identificador_contabil: a.data.identificadorContabil,
      fonte_recurso: a.data.fonteRecurso,
    },
    "salvarTransparencia"
  );
}

/** Sugestões de processos do Compras para o campo de vínculo (só quem edita a emenda; leitura estreita). */
export async function sugerirProcessosCompras(emendaId: string, texto: string): Promise<SugestaoProcesso[]> {
  if (!z.uuid().safeParse(emendaId).success) return [];
  const ctx = await exigirAcesso();
  if (!ctx) return [];
  if (await excedeuLimite("emendas-sugerir-processo", await ipDoCliente(), 120, 60)) return [];
  const emendas = await criarClienteEmendas();
  // A RLS decide: sem acesso à emenda a leitura volta vazia.
  const { data: visivel } = await emendas.from("v_emendas").select("id,objeto").eq("id", emendaId).maybeSingle();
  if (!visivel) return [];
  return sugerirProcessos(texto.slice(0, 80), String(visivel.objeto ?? "")).catch(() => []);
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
  const mudou = (atual?.processo_id ?? null) !== (processo?.id ?? null) || (atual?.processo_licitatorio ?? null) !== novoTexto;
  // Quem não é gestor NUNCA liga direto: o vínculo mostra dados do Compras (lidos com chave de serviço), então
  // passa pela aprovação — assim ninguém sonda processos alheios só digitando números.
  if (!ehGestor(ctx.perfil) && mudou) {
    const falha = await proporAlteracoes(emendaId, [
      { alvo: "execucao", chave: null, campo: "processo_id", valorAtual: atual?.processo_id ?? null, valorProposto: processo?.id ?? null },
      { alvo: "execucao", chave: null, campo: "processo_licitatorio", valorAtual: atual?.processo_licitatorio ?? null, valorProposto: novoTexto },
    ]);
    if (falha) return { sucesso: false, erro: falha };
    return { sucesso: true, aviso: "Vínculo com o processo enviado para aprovação do gestor." };
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
  if (processo) await avancarEtapaPorProcesso(emendas, emendaId);
  revalidar(emendaId);
  return { sucesso: true };
}

const esquemaCorrecaoMovimento = z.object({
  id: z.uuid(),
  emendaId: z.uuid(),
  numero: textoOpcional(40),
  data: data.nullable(),
  /** Novo valor do lançamento (ex.: o IPM mostra vários empenhos e a plataforma tinha um só). */
  valor: z.number().positive("Informe um valor maior que zero").max(1_000_000_000).optional(),
});

/** Completar nº de empenho / data de pagamento que vieram faltando (ex.:
 * importados da planilha). Só gestor (RLS de update). */
export async function corrigirMovimento(dados: z.input<typeof esquemaCorrecaoMovimento>): Promise<Resultado> {
  const a = esquemaCorrecaoMovimento.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await exigirAcesso();
  if (!ctx) return { sucesso: false, erro: "Sem acesso ao módulo." };

  const emendas = await criarClienteEmendas();
  if (!ehGestor(ctx.perfil)) {
    // Secretaria: só se o exercício permitir, só nas emendas que ela edita, e a correção espera aprovação.
    const { data: mov } = await emendas.from("movimentos_financeiros").select("id,numero,data,emenda_id,tipo,valor").eq("id", a.data.id).eq("emenda_id", a.data.emendaId).maybeSingle();
    const { data: em } = await emendas.from("v_emendas").select("ano,secretaria_id").eq("id", a.data.emendaId).maybeSingle();
    if (!mov || !em) return { sucesso: false, erro: "Lançamento não encontrado." };
    if (!podeEditarSecretaria(ctx, em.secretaria_id)) return { sucesso: false, erro: "Você não edita as emendas desta secretaria." };
    const { data: ex } = await emendas.from("exercicios").select("secretaria_edita_lancamentos").eq("ano", em.ano).maybeSingle();
    if (!ex?.secretaria_edita_lancamentos) return { sucesso: false, erro: "A correção de lançamentos pelas secretarias não está liberada nas configurações." };
    const valorMuda = a.data.valor !== undefined && Math.abs(a.data.valor - Number(mov.valor)) > 0.004;
    if ((mov.numero ?? null) === (a.data.numero ?? null) && (mov.data ?? null) === (a.data.data ?? null) && !valorMuda) return { sucesso: true };
    if (valorMuda && a.data.valor! > Number(mov.valor)) {
      const excesso = await conferirSaldo(emendas, a.data.emendaId, mov.tipo, a.data.valor! - Number(mov.valor));
      if (excesso) return { sucesso: false, erro: excesso };
    }
    const falha = await proporAlteracoes(a.data.emendaId, [
      {
        alvo: "movimentos",
        chave: a.data.id,
        campo: "correcao",
        valorAtual: { numero: mov.numero ?? null, data: mov.data ?? null, ...(valorMuda ? { valor: Number(mov.valor) } : {}) },
        valorProposto: { numero: a.data.numero ?? null, data: a.data.data ?? null, ...(valorMuda ? { valor: a.data.valor } : {}) },
      },
    ]);
    if (falha) return { sucesso: false, erro: falha };
    revalidar(a.data.emendaId);
    return { sucesso: true, aviso: "Correção enviada para aprovação do gestor." };
  }
  const { data: atualMov } = await emendas.from("movimentos_financeiros").select("tipo,valor").eq("id", a.data.id).eq("emenda_id", a.data.emendaId).maybeSingle();
  if (!atualMov) return { sucesso: false, erro: "Lançamento não encontrado." };
  const valorMudou = a.data.valor !== undefined && Math.abs(a.data.valor - Number(atualMov.valor)) > 0.004;
  if (valorMudou && a.data.valor! > Number(atualMov.valor)) {
    const excesso = await conferirSaldo(emendas, a.data.emendaId, atualMov.tipo, a.data.valor! - Number(atualMov.valor));
    if (excesso) return { sucesso: false, erro: excesso };
  }
  // `.select("id")` para saber se alguma linha foi mesmo alterada: sem isso, uma atualização
  // que a RLS filtra devolve "sucesso" sem gravar nada.
  const { data: gravadas, error } = await emendas
    .from("movimentos_financeiros")
    .update({ numero: a.data.numero, data: a.data.data, ...(valorMudou ? { valor: Math.round(a.data.valor! * 100) / 100 } : {}) })
    .eq("id", a.data.id)
    .eq("emenda_id", a.data.emendaId)
    .select("id");
  if (error) {
    console.error("[corrigirMovimento]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  if (!gravadas || gravadas.length === 0) return { sucesso: false, erro: "Nada foi gravado: o lançamento não foi encontrado ou você não tem permissão para alterá-lo." };
  if (valorMudou) await avancarEtapaPorLancamentos(emendas, a.data.emendaId);
  revalidar(a.data.emendaId);
  return { sucesso: true };
}

/** Diferença de até R$ 1,00 entre o valor da emenda e o que consta no IPM pode ser arredondada: o lançamento real NÃO muda
 * (empenhado e pago continuam os do IPM, e é o que o portal público mostra); grava-se um registro de arredondamento,
 * com o valor real na observação, que só faz a fase contar como completa. Pode ser desfeito a qualquer momento. */
export const LIMITE_ARREDONDAMENTO = 1;

export async function arredondarCentavos(emendaId: string): Promise<Resultado> {
  if (!z.uuid().safeParse(emendaId).success) return { sucesso: false, erro: "Emenda inválida." };
  const ctx = await exigirAcesso();
  if (!ctx || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só gestores arredondam centavos." };
  const emendas = await criarClienteEmendas();
  const [{ data: em }, { data: movs }] = await Promise.all([
    emendas.from("emendas").select("valor").eq("id", emendaId).maybeSingle(),
    emendas.from("movimentos_financeiros").select("tipo,valor").eq("emenda_id", emendaId),
  ]);
  if (!em) return { sucesso: false, erro: "Emenda não encontrada." };
  const valor = Number(em.valor);
  const t = totaisFinanceiros(movs ?? []);
  const hoje = new Date().toISOString().slice(0, 10);
  const novos: { tipo: "arredondamento_empenho" | "arredondamento_pagamento"; valor: number; observacao: string }[] = [];
  const faltaEmp = Math.round((valor - t.empenhado - t.arredEmpenho) * 100) / 100;
  if (t.empenhado > 0 && faltaEmp > 0.004 && faltaEmp <= LIMITE_ARREDONDAMENTO + 0.004)
    novos.push({ tipo: "arredondamento_empenho", valor: faltaEmp, observacao: `Arredondado por ${brl(faltaEmp)}. Valor real empenhado: ${brl(t.empenhado)} (valor da emenda: ${brl(valor)}).` });
  const empCobre = t.empenhado + t.arredEmpenho + faltaEmp * (novos.length ? 1 : 0);
  const faltaPago = Math.round((valor - t.pago - t.arredPago) * 100) / 100;
  if (t.pago > 0 && faltaPago > 0.004 && faltaPago <= LIMITE_ARREDONDAMENTO + 0.004 && empCobre + 0.005 >= valor)
    novos.push({ tipo: "arredondamento_pagamento", valor: faltaPago, observacao: `Arredondado por ${brl(faltaPago)}. Valor real pago: ${brl(t.pago)} (valor da emenda: ${brl(valor)}).` });
  if (novos.length === 0) return { sucesso: false, erro: `Não há diferença de até ${brl(LIMITE_ARREDONDAMENTO)} para arredondar nesta emenda (ou já está arredondada).` };
  // importar: sem aviso de lançamento
  const { error } = await emendas.from("movimentos_financeiros").insert(novos.map((n) => ({ emenda_id: emendaId, tipo: n.tipo, valor: n.valor, data: hoje, numero: null, observacao: n.observacao, usuario_id: ctx.usuario.id })));
  if (error) {
    console.error("[arredondarCentavos]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  await avancarEtapaPorLancamentos(emendas, emendaId);
  revalidar(emendaId);
  return { sucesso: true, aviso: `Arredondado por ${novos.map((n) => brl(n.valor)).join(" e ")}. O valor real continua registrado e o arredondamento pode ser desfeito.` };
}

/** Desfaz um arredondamento (sem justificativa: ele só afeta se a fase conta como completa; fica na auditoria). */
export async function desfazerArredondamento(dados: { id: string; emendaId: string }): Promise<Resultado> {
  if (!z.uuid().safeParse(dados.id).success || !z.uuid().safeParse(dados.emendaId).success) return { sucesso: false, erro: "Registro inválido." };
  const ctx = await exigirAcesso();
  if (!ctx || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só gestores desfazem arredondamentos." };
  const emendas = await criarClienteEmendas();
  const { data: apagados, error } = await emendas.from("movimentos_financeiros").delete().eq("id", dados.id).eq("emenda_id", dados.emendaId).in("tipo", ["arredondamento_empenho", "arredondamento_pagamento"]).select("id");
  if (error) return { sucesso: false, erro: traduzir(error) };
  if (!apagados?.length) return { sucesso: false, erro: "Arredondamento não encontrado." };
  revalidar(dados.emendaId);
  return { sucesso: true, aviso: "Arredondamento desfeito: a fase volta a mostrar a diferença real." };
}

/** Exclui um lançamento financeiro (empenho, liquidação, pagamento…) lançado por engano. Só gestor;
 * a exclusão fica na auditoria (quem, quando e o que tinha). */
export async function excluirMovimento(dados: { id: string; emendaId: string; justificativa: string }): Promise<Resultado> {
  if (!z.uuid().safeParse(dados.id).success || !z.uuid().safeParse(dados.emendaId).success) return { sucesso: false, erro: "Lançamento inválido." };
  const justificativa = (dados.justificativa ?? "").trim();
  if (justificativa.length < 10) return { sucesso: false, erro: "Escreva a justificativa da exclusão (mínimo de 10 caracteres)." };
  const ctx = await exigirAcesso();
  if (!ctx || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só gestores excluem lançamentos." };
  const emendas = await criarClienteEmendas();
  const { data: mov } = await emendas.from("movimentos_financeiros").select("*").eq("id", dados.id).eq("emenda_id", dados.emendaId).maybeSingle();
  const { data: em } = await emendas.from("emendas").select("numero,ano").eq("id", dados.emendaId).maybeSingle();
  if (!mov || !em) return { sucesso: false, erro: "Lançamento não encontrado." };
  const { error: erroJust } = await emendas.from("exclusoes_justificadas").insert({ tipo: "lancamento", emenda_id: dados.emendaId, emenda_numero: em.numero, ano: em.ano, detalhe: mov, justificativa, usuario_id: ctx.usuario.id });
  if (erroJust) {
    console.error("[excluirMovimento] justificativa", erroJust);
    return { sucesso: false, erro: "Não foi possível registrar a justificativa; nada foi excluído." };
  }
  const { data: apagadas, error } = await emendas.from("movimentos_financeiros").delete().eq("id", dados.id).eq("emenda_id", dados.emendaId).select("id");
  if (error) {
    console.error("[excluirMovimento]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  if (!apagadas?.length) return { sucesso: false, erro: "Nada foi excluído: o lançamento não foi encontrado ou você não tem permissão." };

  // A etapa da emenda é um cache do último andamento: sem isto a linha do tempo continuava "paga" depois de
  // excluir o único pagamento. Se não sobrou nenhum lançamento daquele tipo, o andamento da etapa correspondente
  // (lançado junto com ele) sai do histórico e a etapa volta ao que os lançamentos restantes sustentam.
  let aviso: string | undefined;
  const etapaDoTipo = etapaDoMovimento(mov.tipo);
  if (etapaDoTipo) {
    const [{ data: restantes }, { data: dadosEmenda }] = await Promise.all([
      emendas.from("movimentos_financeiros").select("tipo,valor").eq("emenda_id", dados.emendaId),
      emendas.from("emendas").select("valor,etapa").eq("id", dados.emendaId).maybeSingle(),
    ]);
    // A fase financeira só vale com o total lançado (empenho parcial não sustenta "empenhada"): considera
    // "de pé" só o tipo cujo total ainda cobre o disponível, não apenas o que tem algum lançamento.
    const t = totaisFinanceiros(restantes ?? []);
    const valorEmenda = Number(dadosEmenda?.valor ?? 0);
    const base = valorEmenda;
    const completos = new Set<string>();
    if (t.empenhado > 0 && t.empenhado + t.arredEmpenho + 0.005 >= valorEmenda) completos.add("empenho");
    if (t.liquidado > 0 && t.liquidado + 0.005 >= base) completos.add("liquidacao");
    if (t.pago > 0 && t.pago + t.arredPago + 0.005 >= base) completos.add("pagamento");
    if (!completos.has(mov.tipo)) {
      const { data: removidos } = await emendas.from("andamentos").delete().eq("emenda_id", dados.emendaId).eq("etapa", etapaDoTipo).select("id");
      const { data: atual } = await emendas.from("emendas").select("etapa").eq("id", dados.emendaId).maybeSingle();
      const nova = atual ? etapaAposExclusao(atual.etapa, completos) : null;
      if (nova) await emendas.from("emendas").update({ etapa: nova }).eq("id", dados.emendaId);
      if (removidos?.length || nova) aviso = `Lançamento excluído. A etapa da emenda foi atualizada${removidos?.length ? " e o andamento correspondente saiu do histórico" : ""}.`;
    }
  } else {
    // Anulação excluída: o empenhado pode ter voltado a cobrir o total.
    await avancarEtapaPorLancamentos(emendas, dados.emendaId);
  }
  revalidar(dados.emendaId);
  return aviso ? { sucesso: true, aviso } : { sucesso: true };
}

/** Desfaz um andamento registrado por engano (ex.: "Concluída" sem estar). Só gestor, com justificativa; a etapa da
 * emenda volta ao andamento anterior (o gatilho recalcula) e a exclusão fica registrada com quem fez e por quê. */
export async function excluirAndamento(dados: { id: string; emendaId: string; justificativa: string }): Promise<Resultado> {
  if (!z.uuid().safeParse(dados.id).success || !z.uuid().safeParse(dados.emendaId).success) return { sucesso: false, erro: "Andamento inválido." };
  const justificativa = (dados.justificativa ?? "").trim();
  if (justificativa.length < 10) return { sucesso: false, erro: "Escreva a justificativa (mínimo de 10 caracteres)." };
  const ctx = await exigirAcesso();
  if (!ctx || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só gestores desfazem andamentos." };
  const emendas = await criarClienteEmendas();
  const { data: and } = await emendas.from("andamentos").select("*").eq("id", dados.id).eq("emenda_id", dados.emendaId).maybeSingle();
  const { data: em } = await emendas.from("emendas").select("numero,ano").eq("id", dados.emendaId).maybeSingle();
  if (!and || !em) return { sucesso: false, erro: "Andamento não encontrado." };
  const { error: erroJust } = await emendas.from("exclusoes_justificadas").insert({ tipo: "andamento", emenda_id: dados.emendaId, emenda_numero: em.numero, ano: em.ano, detalhe: and, justificativa, usuario_id: ctx.usuario.id });
  if (erroJust) {
    console.error("[excluirAndamento] justificativa", erroJust);
    return { sucesso: false, erro: "Não foi possível registrar a justificativa; nada foi desfeito." };
  }
  const { data: apagados, error } = await emendas.from("andamentos").delete().eq("id", dados.id).eq("emenda_id", dados.emendaId).select("id");
  if (error) {
    console.error("[excluirAndamento]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  if (!apagados?.length) return { sucesso: false, erro: "Nada foi desfeito: o andamento não foi encontrado ou você não tem permissão." };
  revalidar(dados.emendaId);
  return { sucesso: true, aviso: "Andamento desfeito. A etapa da emenda voltou ao andamento anterior." };
}

/** Exclui a emenda inteira (lançamentos, fases, anexos, impedimentos…) — para cadastro feito por engano.
 * Só gestor; exige confirmar digitando o número. A auditoria guarda o registro apagado. */
export async function excluirEmenda(dados: { emendaId: string; numeroConfirmado: number; justificativa: string }): Promise<Resultado> {
  if (!z.uuid().safeParse(dados.emendaId).success) return { sucesso: false, erro: "Emenda inválida." };
  const justificativa = (dados.justificativa ?? "").trim();
  if (justificativa.length < 10) return { sucesso: false, erro: "Escreva a justificativa da exclusão (mínimo de 10 caracteres)." };
  const ctx = await exigirAcesso();
  if (!ctx || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só gestores excluem emendas." };
  const emendas = await criarClienteEmendas();
  const { data: emenda } = await emendas.from("emendas").select("id,numero,ano,objeto,valor,vereador_id").eq("id", dados.emendaId).maybeSingle();
  if (!emenda) return { sucesso: false, erro: "Emenda não encontrada." };
  if (emenda.numero !== dados.numeroConfirmado) return { sucesso: false, erro: "O número digitado não confere com o da emenda." };
  const { error: erroJust } = await emendas.from("exclusoes_justificadas").insert({ tipo: "emenda", emenda_id: emenda.id, emenda_numero: emenda.numero, ano: emenda.ano, detalhe: { objeto: emenda.objeto, valor: emenda.valor }, justificativa, usuario_id: ctx.usuario.id });
  if (erroJust) {
    console.error("[excluirEmenda] justificativa", erroJust);
    return { sucesso: false, erro: "Não foi possível registrar a justificativa; nada foi excluído." };
  }
  // Anexos no armazenamento (os registros caem junto com a emenda; os arquivos não).
  const { data: docs } = await emendas.from("documentos").select("caminho").eq("emenda_id", dados.emendaId);
  if (docs?.length) {
    const { error: erroArq } = await emendas.storage.from("emendas-documentos").remove(docs.map((d) => d.caminho));
    if (erroArq) console.error("[excluirEmenda] storage", erroArq);
  }
  const { data: apagadas, error } = await emendas.from("emendas").delete().eq("id", dados.emendaId).select("id");
  if (error) {
    console.error("[excluirEmenda]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  if (!apagadas?.length) return { sucesso: false, erro: "Nada foi excluído: você não tem permissão para excluir esta emenda." };
  revalidar();
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
  const { data: linhas, error } = await emendas
    .from("impedimentos")
    .update({ resolvido_em: hoje, resolucao: a.data.resolucao })
    .eq("id", a.data.id)
    .select("id");
  if (error) {
    console.error("[resolverImpedimento]", error);
    return { sucesso: false, erro: traduzir(error) };
  }
  if (!linhas?.length) return { sucesso: false, erro: "Nada foi gravado: o impedimento não foi encontrado ou você não tem permissão para alterá-lo." };
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
  objeto: z.string().trim().min(15, "Descreva o objeto com pelo menos 15 caracteres (o quê, para quem). Ex.: Repasse ao Hospital de Cataguases para custeio").max(300),
  descricao: z.string().trim().min(3, "Informe a descrição").max(4000),
  valor: z.number().positive("Informe um valor maior que zero"),
  beneficiarioId: z.uuid().nullable(),
  beneficiarioNovo: textoOpcional(200),
  beneficiarioTipo: z.enum(["entidade", "orgao_publico", "pessoa_fisica"]).optional(),
  beneficiarioDoc: z.string().trim().max(30).optional(),
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
  novo: string | null,
  tipo?: TipoBeneficiario,
  documento?: string
): Promise<{ id: string | null; erro?: string }> {
  if (!novo) return { id };
  const { data: existente } = await emendas.from("beneficiarios").select("id").ilike("nome", escaparLike(novo)).maybeSingle();
  if (existente) return { id: existente.id };
  const t: TipoBeneficiario = tipo ?? (/^secretaria/i.test(novo) ? "orgao_publico" : "entidade");
  const doc = validarDocumento(t, documento);
  if (!doc.ok) return { id: null, erro: doc.erro };
  const { data, error } = await emendas
    .from("beneficiarios")
    .insert({ nome: novo, tipo: t, cnpj: doc.cnpj, cpf: doc.cpf })
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
  const benef = await resolverBeneficiario(emendas, a.data.beneficiarioId, a.data.beneficiarioNovo, a.data.beneficiarioTipo, a.data.beneficiarioDoc);
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
  await completarDadosDaDescricao(emendas, resposta.data.id, a.data.descricao, benef.id);
  revalidar(resposta.data.id);
  return { sucesso: true, id: resposta.data.id };
}

/** O texto da emenda já traz o CNPJ do recebedor e o endereço: preenche o que está vazio (nunca sobrescreve). */
async function completarDadosDaDescricao(
  emendas: Awaited<ReturnType<typeof criarClienteEmendas>>,
  emendaId: string,
  descricao: string,
  beneficiarioId: string | null
) {
  try {
    const { cnpj, localidade } = extrairDaDescricao(descricao);
    if (cnpj && beneficiarioId) await emendas.from("beneficiarios").update({ cnpj }).eq("id", beneficiarioId).is("cnpj", null).is("cpf", null).neq("tipo", "pessoa_fisica");
    if (localidade) {
      const { data: x } = await emendas.from("execucao").select("localidade").eq("id", emendaId).maybeSingle();
      if (!x) await emendas.from("execucao").insert({ id: emendaId, localidade });
      else if (!x.localidade) await emendas.from("execucao").update({ localidade }).eq("id", emendaId);
    }
  } catch (e) {
    console.error("[completarDadosDaDescricao]", e);
  }
}

const esquemaRemanejamento = z.object({
  emendaId: z.uuid(),
  ato: textoOpcional(200),
  motivo: z.string().trim().min(5, "Informe o motivo do remanejamento").max(2000),
  novo: z.object({
    objeto: z.string().trim().min(15, "Descreva o objeto com pelo menos 15 caracteres").max(300).optional(),
    descricao: z.string().trim().min(3).max(4000).optional(),
    valor: z.number().positive().optional(),
    beneficiario_id: z.uuid().nullable().optional(),
    beneficiarioNovo: textoOpcional(200),
    beneficiarioTipo: z.enum(["entidade", "orgao_publico", "pessoa_fisica"]).optional(),
    beneficiarioDoc: z.string().trim().max(30).optional(),
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
  const { beneficiarioNovo, beneficiarioTipo, beneficiarioDoc, ...novo } = a.data.novo;
  if (beneficiarioNovo) {
    const benef = await resolverBeneficiario(emendas, null, beneficiarioNovo, beneficiarioTipo, beneficiarioDoc);
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
  const { data: linhas, error } = await emendas.from("emendas").update({ situacao: cancelada ? "cancelada" : "normal" }).eq("id", emendaId).select("id");
  if (!error && !linhas?.length) return { sucesso: false, erro: "Nada foi gravado: a emenda não foi encontrada ou você não tem permissão." };
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
    "relatorio_gestao",
    "anuencia_sus",
    "outro",
  ]),
  competencia: z.number().int().min(2000).max(2100).nullable().optional(),
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
    competencia: a.data.tipo === "relatorio_gestao" ? (a.data.competencia ?? null) : null,
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
