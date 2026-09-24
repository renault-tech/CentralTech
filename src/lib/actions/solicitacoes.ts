"use server";

import { revalidatePath } from "next/cache";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin, criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteCompras } from "@/lib/supabase/compras-cliente";
import { criarClienteRequerimentos } from "@/lib/supabase/requerimentos-cliente";
import { criarClienteNumeraAdmin } from "@/lib/supabase/numera-admin";
import type { Modulo, SolicitacaoAcesso } from "@/types/database";

export type DecisaoCompras = { perfil: string; setorId: string | null };
export type DecisaoRequerimentos = { perfil: string; secretariaId: string | null };
export type DecisaoNumera = { role: string; documentos: string[] };

export type DecisaoAprovacao = {
  compras?: DecisaoCompras;
  requerimentos?: DecisaoRequerimentos;
  numera?: DecisaoNumera;
};

export type ResultadoModulo = { sucesso: boolean; mensagem?: string; linkPrimeiroAcesso?: string };

export type ResultadoAprovacao =
  | { sucesso: true; resultados: Partial<Record<Modulo, ResultadoModulo>> }
  | { sucesso: false; erro: string };

export type ResultadoRecusa = { sucesso: true } | { sucesso: false; erro: string };

type ClienteComAuthAdmin = {
  auth: {
    admin: {
      createUser: (args: {
        email: string;
        password: string;
        email_confirm: boolean;
        user_metadata?: Record<string, unknown>;
      }) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
      listUsers: (args: {
        page: number;
        perPage: number;
      }) => Promise<{
        data: { users: { id: string; email?: string | null }[] } | null;
        error: { message: string } | null;
      }>;
      generateLink: (args: {
        type: "invite" | "recovery";
        email: string;
      }) => Promise<{
        data: { properties?: { action_link?: string } | null } | null;
        error: { message: string } | null;
      }>;
    };
  };
};

/** Paginação manual (a mesma técnica do importador do Numera) — nenhum dos
 * dois projetos deste ecossistema tem contas suficientes para justificar
 * uma busca por e-mail mais sofisticada. */
async function encontrarAuthIdPorEmail(admin: ClienteComAuthAdmin, email: string): Promise<string | null> {
  const alvo = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const achado = data.users.find((u) => u.email?.toLowerCase() === alvo);
    if (achado) return achado.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Cria a conta no Auth se ainda não existir (mesmo padrão do importador do
 * Numera): tenta criar, e se já existir, localiza pelo e-mail. */
async function encontrarOuCriarConta(
  admin: ClienteComAuthAdmin,
  email: string,
  nome: string
): Promise<{ id: string; criadaAgora: boolean } | null> {
  const { data: criado, error } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { nome },
  });
  if (!error && criado.user) {
    return { id: criado.user.id, criadaAgora: true };
  }
  const id = await encontrarAuthIdPorEmail(admin, email);
  if (!id) return null;
  return { id, criadaAgora: false };
}

async function gerarLinkPrimeiroAcesso(admin: ClienteComAuthAdmin, email: string): Promise<string | undefined> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email });
  if (error) {
    console.error("[gerarLinkPrimeiroAcesso] falhou:", error);
    return undefined;
  }
  return data?.properties?.action_link;
}

async function aprovarCompras(
  authId: string,
  solicitacao: SolicitacaoAcesso,
  decisao: DecisaoCompras,
  linkPrimeiroAcesso: string | undefined
): Promise<ResultadoModulo> {
  const compras = await criarClienteCompras();
  const adminBruto = criarClienteAdminBruto();

  const { data: existente } = await adminBruto
    .schema("public")
    .from("usuarios")
    .select("id")
    .eq("id", authId)
    .maybeSingle();

  const { error } = existente
    ? await compras.rpc("admin_atualizar_usuario", {
        p_usuario_id: authId,
        p_nome: solicitacao.nome,
        p_perfil: decisao.perfil,
        p_setor_id: decisao.setorId,
        p_ativo: true,
      })
    : await compras.rpc("admin_criar_usuario", {
        p_id: authId,
        p_nome: solicitacao.nome,
        p_email: solicitacao.email,
        p_perfil: decisao.perfil,
        p_setor_id: decisao.setorId,
      });

  if (error) {
    console.error("[aprovarCompras] falha:", error);
    return { sucesso: false, mensagem: error.message };
  }
  return { sucesso: true, linkPrimeiroAcesso };
}

async function aprovarRequerimentos(
  solicitacao: SolicitacaoAcesso,
  decisao: DecisaoRequerimentos,
  linkPrimeiroAcesso: string | undefined
): Promise<ResultadoModulo> {
  const requerimentos = await criarClienteRequerimentos();
  const { error } = await requerimentos.rpc("definir_acesso", {
    p_email: solicitacao.email,
    p_nome: solicitacao.nome,
    p_perfil: decisao.perfil,
    p_secretaria_id: decisao.secretariaId,
    p_ativo: true,
  });

  if (error) {
    console.error("[aprovarRequerimentos] falha:", error);
    return { sucesso: false, mensagem: error.message };
  }
  return { sucesso: true, linkPrimeiroAcesso };
}

async function aprovarNumera(
  solicitacao: SolicitacaoAcesso,
  decisao: DecisaoNumera
): Promise<ResultadoModulo> {
  let numeraAdmin;
  try {
    numeraAdmin = criarClienteNumeraAdmin();
  } catch {
    return {
      sucesso: false,
      mensagem:
        "NUMERA_SUPABASE_SERVICE_ROLE_KEY não configurada nesta implantação — cole a chave nas variáveis de ambiente (ver changelog) antes de aprovar o módulo Numera.",
    };
  }

  const { data: existente } = await numeraAdmin
    .from("users")
    .select("id")
    .ilike("email", solicitacao.email)
    .maybeSingle();

  let userId = existente?.id as string | undefined;
  let criadaAgora = false;

  if (!userId) {
    const conta = await encontrarOuCriarConta(numeraAdmin, solicitacao.email, solicitacao.nome);
    if (!conta) {
      return { sucesso: false, mensagem: "Não foi possível criar a conta no projeto do Numera." };
    }
    userId = conta.id;
    criadaAgora = conta.criadaAgora;
  }

  const payload: Record<string, unknown> = {
    id: userId,
    email: solicitacao.email,
    name: solicitacao.nome,
    role: decisao.role,
    allowed_documents: decisao.documentos,
    approved: true,
  };
  if (!existente) {
    const usuarioBase = solicitacao.email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, "") || "usuario";
    payload.username = `${usuarioBase}.${userId.slice(0, 6)}`;
    payload.password = crypto.randomUUID();
  }
  if (solicitacao.secretaria_sugerida) {
    payload.secretaria = solicitacao.secretaria_sugerida;
  }

  const { error: erroUpsert } = await numeraAdmin.from("users").upsert(payload, { onConflict: "id" });
  if (erroUpsert) {
    console.error("[aprovarNumera] falha ao gravar users:", erroUpsert);
    return { sucesso: false, mensagem: erroUpsert.message };
  }

  const linkPrimeiroAcesso = criadaAgora
    ? await gerarLinkPrimeiroAcesso(numeraAdmin, solicitacao.email)
    : undefined;

  return { sucesso: true, linkPrimeiroAcesso };
}

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
    .eq("id", solicitacaoId)
    .eq("status", "pendente")
    .single();

  if (erroSolicitacao || !solicitacao) {
    return { sucesso: false, erro: "Solicitação não encontrada ou já decidida." };
  }

  if (!decisoes.compras && !decisoes.requerimentos && !decisoes.numera) {
    return { sucesso: false, erro: "Escolha ao menos um módulo para aprovar." };
  }

  const resultados: Partial<Record<Modulo, ResultadoModulo>> = {};

  // Conta compartilhada (Compras/Requerimentos/Hub são o MESMO projeto
  // Supabase) — precisa existir sempre, inclusive quando só Numera é
  // aprovado, porque é ela quem identifica a pessoa no Hub.
  if (decisoes.compras || decisoes.requerimentos) {
    const adminCompartilhado = criarClienteAdmin();
    const conta = await encontrarOuCriarConta(adminCompartilhado, solicitacao.email, solicitacao.nome);
    if (!conta) {
      return {
        sucesso: false,
        erro: "Não foi possível criar ou localizar a conta compartilhada (Compras/Requerimentos/Hub).",
      };
    }

    const linkCompartilhado = conta.criadaAgora
      ? await gerarLinkPrimeiroAcesso(adminCompartilhado, solicitacao.email)
      : undefined;

    if (decisoes.compras) {
      resultados.compras = await aprovarCompras(conta.id, solicitacao, decisoes.compras, linkCompartilhado);
    }
    if (decisoes.requerimentos) {
      resultados.requerimentos = await aprovarRequerimentos(solicitacao, decisoes.requerimentos, linkCompartilhado);
    }

    await atualizarBookkeepingHub(hub, conta.id, solicitacao, resultados);
  }

  if (decisoes.numera) {
    resultados.numera = await aprovarNumera(solicitacao, decisoes.numera);
    if (resultados.numera.sucesso) {
      // Numera não compartilha auth.users com o Hub — mas se a pessoa
      // também ganhou um módulo do grupo compartilhado nesta mesma
      // aprovação, o bookkeeping acima já cobriu 'numera' via
      // `resultados`; se Numera foi o ÚNICO módulo aprovado, ainda assim
      // registramos o "cartão" no Hub usando a conta compartilhada — que,
      // neste caso, precisa ser criada só para servir de identidade do
      // Hub (sem ela a pessoa não aparece em "Usuários e acessos").
      if (!decisoes.compras && !decisoes.requerimentos) {
        const adminCompartilhado = criarClienteAdmin();
        const conta = await encontrarOuCriarConta(adminCompartilhado, solicitacao.email, solicitacao.nome);
        if (conta) {
          await atualizarBookkeepingHub(hub, conta.id, solicitacao, resultados);
        }
      }
    }
  }

  await hub
    .from("solicitacoes_acesso")
    .update({ status: "aprovada", decidido_por: usuario.id, decidido_em: new Date().toISOString() })
    .eq("id", solicitacaoId);

  revalidatePath("/configuracoes");
  return { sucesso: true, resultados };
}

/** Soma os módulos aprovados nesta chamada aos que a pessoa já tinha, e
 * grava via `hub.definir_acesso` — nunca revoga aqui (revogar é uma ação à
 * parte, no formulário de "Usuários e acessos"). */
async function atualizarBookkeepingHub(
  hub: Awaited<ReturnType<typeof criarClienteServidor>>,
  authId: string,
  solicitacao: SolicitacaoAcesso,
  resultados: Partial<Record<Modulo, ResultadoModulo>>
): Promise<void> {
  const modulosAprovados = (Object.keys(resultados) as Modulo[]).filter((m) => resultados[m]?.sucesso);
  if (modulosAprovados.length === 0) return;

  const [{ data: existentes }, { data: hubUsuario }] = await Promise.all([
    hub.from("acessos_modulo").select("modulo").eq("usuario_id", authId),
    hub.from("usuarios").select("admin_hub").eq("id", authId).maybeSingle(),
  ]);

  const conjunto = new Set<Modulo>([...(existentes ?? []).map((a) => a.modulo), ...modulosAprovados]);

  const { error } = await hub.rpc("definir_acesso", {
    p_email: solicitacao.email,
    p_nome: solicitacao.nome,
    p_admin_hub: hubUsuario?.admin_hub ?? false,
    p_modulos: Array.from(conjunto),
    p_ativo: true,
  });
  if (error) {
    console.error("[atualizarBookkeepingHub] hub.definir_acesso falhou:", error);
  }
}

export async function recusarSolicitacao(
  solicitacaoId: string,
  observacao: string
): Promise<ResultadoRecusa> {
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
