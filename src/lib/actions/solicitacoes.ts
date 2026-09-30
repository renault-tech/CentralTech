"use server";

import { revalidatePath } from "next/cache";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { origemDaRequisicao } from "@/lib/actions/auth";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { MODULOS } from "@/lib/modulos-info";
import {
  encontrarOuCriarConta,
  gerarLinkPrimeiroAcesso,
  aprovarCompras,
  aprovarRequerimentos,
  aprovarNumera,
  sincronizarBookkeepingHub,
  type DecisaoCompras,
  type DecisaoRequerimentos,
  type DecisaoNumera,
  type DecisaoAprovacao,
  type ResultadoModulo,
} from "@/lib/actions/provisionamento-modulos";
import type { Modulo } from "@/types/database";

export type {
  DecisaoCompras,
  DecisaoRequerimentos,
  DecisaoNumera,
  DecisaoAprovacao,
  ResultadoModulo,
};

export type ResultadoAprovacao =
  | { sucesso: true; resultados: Partial<Record<Modulo, ResultadoModulo>> }
  | { sucesso: false; erro: string };

export type ResultadoRecusa = { sucesso: true } | { sucesso: false; erro: string };

/**
 * Aprova uma solicitação de acesso, módulo a módulo. Falha num módulo não
 * desfaz os outros — cada um tem seu próprio resultado, com o link de
 * primeiro acesso (`generateLink`, sem depender de e-mail) quando a conta
 * correspondente acabou de ser criada.
 */
export async function aprovarSolicitacao(
  solicitacaoId: string,
  decisoes: DecisaoAprovacao
): Promise<ResultadoAprovacao> {
  const usuario = await obterUsuarioAtual();
  if (!usuario?.admin_hub) {
    return { sucesso: false, erro: "Sem permissão para aprovar solicitações." };
  }

  const hub = await criarClienteServidor();
  const { data: solicitacao, error: erroSolicitacao } = await hub
    .from("solicitacoes_acesso")
    .select("*")
    // Aceita retentativa sobre uma solicitação já "aprovada" (ex.: um
    // módulo falhou na primeira vez, tudo idempotente — reprocessar o
    // que já deu certo não tem efeito colateral) — só uma "recusada" de
    // propósito não pode ser reaberta por aqui.
    .in("status", ["pendente", "aprovada"])
    .eq("id", solicitacaoId)
    .single();

  if (erroSolicitacao || !solicitacao) {
    return { sucesso: false, erro: "Solicitação não encontrada ou recusada." };
  }

  if (!decisoes.compras && !decisoes.requerimentos && !decisoes.numera) {
    return { sucesso: false, erro: "Escolha ao menos um módulo para aprovar." };
  }

  const resultados: Partial<Record<Modulo, ResultadoModulo>> = {};

  // Conta compartilhada (Compras/Requerimentos/Hub são o MESMO projeto
  // Supabase) — resolvida SEMPRE, mesmo quando só Numera é aprovado,
  // porque é ela quem identifica a pessoa no Hub ("Usuários e acessos").
  // Importante: isto roda uma única vez, e o bookkeeping do Hub (abaixo)
  // só acontece DEPOIS de processar os 3 módulos — uma versão anterior
  // fazia o bookkeeping logo após Compras/Requerimentos e só voltava a
  // gravar Numera se ele fosse o ÚNICO módulo da solicitação, perdendo o
  // registro de Numera sempre que ele vinha combinado com outro módulo
  // (a conta era criada certinho lá, só o "cartão" no Hub não aparecia).
  const adminCompartilhado = criarClienteAdmin();
  const conta = await encontrarOuCriarConta(adminCompartilhado, solicitacao.email, solicitacao.nome);
  if (!conta) {
    return {
      sucesso: false,
      erro: "Não foi possível criar ou localizar a conta compartilhada (Compras/Requerimentos/Hub).",
    };
  }

  const linkCompartilhado = conta.criadaAgora
    ? await gerarLinkPrimeiroAcesso(
        adminCompartilhado,
        solicitacao.email,
        `${await origemDaRequisicao()}/redefinir-senha`
      )
    : undefined;

  const pessoa = {
    nome: solicitacao.nome,
    email: solicitacao.email,
    secretariaSugerida: solicitacao.secretaria_sugerida,
  };

  if (decisoes.compras) {
    resultados.compras = await aprovarCompras(conta.id, pessoa, decisoes.compras, linkCompartilhado);
  }
  if (decisoes.requerimentos) {
    resultados.requerimentos = await aprovarRequerimentos(pessoa, decisoes.requerimentos, linkCompartilhado);
  }
  if (decisoes.numera) {
    resultados.numera = await aprovarNumera(pessoa, decisoes.numera);
  }

  await sincronizarBookkeepingHub(hub, conta.id, pessoa, resultados);

  // Resumo por módulo persistido em `observacao_decisao` — sem isso, uma
  // falha parcial (ex.: Numera sem a chave configurada) desaparecia da
  // lista de pendentes junto com a solicitação inteira, sem deixar
  // nenhum rastro do que ainda precisa de nova tentativa. Cobre também o
  // módulo que o admin deixou de propósito fora da decisão (checkbox
  // "incluir" desmarcado no formulário) — sem isso o resumo silenciava
  // que aquele módulo pedido ainda não foi decidido, e reabrir a
  // solicitação depois (aba "Decididas") era o único jeito de descobrir.
  const resumo = solicitacao.modulos_solicitados
    .map((m: Modulo) => {
      const r = resultados[m];
      if (!r) return `${MODULOS[m].nomeCurto}: não incluído nesta decisão`;
      return `${MODULOS[m].nomeCurto}: ${r.sucesso ? "ok" : `falhou (${r.mensagem ?? "erro"})`}`;
    })
    .join(" · ");

  await hub
    .from("solicitacoes_acesso")
    .update({
      status: "aprovada",
      decidido_por: usuario.id,
      decidido_em: new Date().toISOString(),
      observacao_decisao: resumo,
    })
    .eq("id", solicitacaoId);

  revalidatePath("/configuracoes");
  return { sucesso: true, resultados };
}

export async function recusarSolicitacao(
  solicitacaoId: string,
  observacao: string
): Promise<ResultadoRecusa> {
  // A RPC já se protege sozinha (`hub.eh_admin_hub()`), mas as demais
  // actions administrativas deste arquivo checam aqui também — defesa em
  // profundidade e consistência de padrão (achado de auditoria).
  const usuario = await obterUsuarioAtual();
  if (!usuario?.admin_hub) {
    return { sucesso: false, erro: "Sem permissão para recusar solicitações." };
  }

  const hub = await criarClienteServidor();
  const { error } = await hub.rpc("rejeitar_solicitacao", {
    p_id: solicitacaoId,
    p_observacao: observacao || null,
  });

  if (error) {
    console.error("[recusarSolicitacao] falha:", error);
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/configuracoes");
  return { sucesso: true };
}
