"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin, criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteNumeraAdmin } from "@/lib/supabase/numera-admin";
import { enviarEmailPrimeiroAcesso } from "@/lib/email/primeiro-acesso";
import {
  encontrarOuCriarConta,
  linkPrimeiroAcessoDaConta,
  enviarLinkNoEmailEAnotar,
  aprovarCompras,
  aprovarRequerimentos,
  aprovarNumera,
  aprovarEmendas,
  aprovarFrotas,
  aprovarImoveis,
  type DecisaoAprovacao,
  type ResultadoModulo,
} from "@/lib/actions/provisionamento-modulos";
import type { Modulo } from "@/types/database";

function traduzirErro(mensagem: string | undefined): string {
  if (!mensagem) return "Não foi possível concluir a ação. Tente novamente.";
  const conhecida = mensagem.match(/(?:^|: )([A-ZÁÉÍÓÚÂÊÔÃÕÇJS][^\n]*)/);
  return conhecida?.[1] ?? "Não foi possível concluir a ação. Tente novamente.";
}

const esquemaAcesso = z.object({
  usuarioId: z.uuid().optional(),
  email: z.email("Informe um e-mail válido"),
  nome: z.string().trim().min(2, "Informe o nome"),
  adminHub: z.boolean(),
  modulos: z.array(z.enum(["compras", "numera", "requerimentos", "emendas", "frotas", "imoveis"])),
  ativo: z.boolean(),
  decisoes: z
    .object({
      compras: z.object({ perfil: z.string(), setorId: z.string().nullable() }).optional(),
      requerimentos: z.object({ perfil: z.string(), secretariaId: z.string().nullable() }).optional(),
      numera: z.object({ role: z.string(), documentos: z.array(z.string()) }).optional(),
      emendas: z
        .object({
          perfil: z.enum(["gestor", "admin_secretaria", "operador", "consulta"]),
          secretariaId: z.string().nullable(),
          verOutras: z.boolean(),
        })
        .optional(),
      frotas: z.object({ perfil: z.enum(["gestor", "consulta"]) }).optional(),
      imoveis: z
        .object({ perfil: z.enum(["gestor", "consulta", "secretaria"]), secretariaId: z.string().nullable() })
        .optional(),
    })
    .default({}),
});

export type ResultadoAcesso =
  | { sucesso: true; resultados: Partial<Record<Modulo, ResultadoModulo>> }
  | { sucesso: false; erro: string };

/**
 * Concede/atualiza acesso a partir de Configurações → Usuários e acessos.
 *
 * Até esta correção, esta action só chamava `hub.definir_acesso` — que
 * apenas grava o "cartão" em `hub.acessos_modulo` e exige que `auth.users`
 * já tenha o e-mail. Isso fazia esta tela (a única pensada para o admin dar
 * acesso diretamente, sem a pessoa passar por `/solicitar-acesso`) falhar
 * com "Nenhuma conta encontrada... precisa já ter login em algum módulo"
 * bem quando era usada para o próprio PRIMEIRO acesso de alguém — e mesmo
 * quando a conta já existia, marcar um módulo aqui nunca criou o cadastro
 * de verdade dentro dele (Compras/Requerimentos/Numera cada um com sua
 * própria tabela de usuários), só o indicador visual no Hub.
 *
 * Agora `decisoes` (mesmo formato usado na aprovação de solicitações) traz
 * perfil/setor/secretaria/role para cada módulo que precisa ser
 * (re)provisionado de verdade — a mesma conta compartilhada é criada se
 * ainda não existir, cada módulo presente em `decisoes` é aprovado pela
 * própria RPC daquele app, e só depois o bookkeeping do Hub é gravado.
 */
export async function definirAcesso(dados: {
  usuarioId?: string;
  email: string;
  nome: string;
  adminHub: boolean;
  modulos: Modulo[];
  ativo: boolean;
  decisoes?: DecisaoAprovacao;
}): Promise<ResultadoAcesso> {
  const analise = esquemaAcesso.safeParse(dados);
  if (!analise.success) {
    return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const usuario = await obterUsuarioAtual();
  if (!usuario?.admin_hub) {
    return { sucesso: false, erro: "Sem permissão para conceder acesso." };
  }

  const { usuarioId, email, nome, adminHub, modulos, ativo, decisoes } = analise.data;

  // Quando já se sabe o id (editando alguém que já aparece na tabela do
  // Hub, e-mail travado no formulário), pula a resolução via Admin API —
  // evita um createUser fadado a falhar seguido de paginar listUsers só
  // para redescobrir um id que o chamador já tinha.
  const adminCompartilhado = criarClienteAdmin();
  const conta = usuarioId
    ? { id: usuarioId, criadaAgora: false }
    : await encontrarOuCriarConta(adminCompartilhado, email, nome);
  if (!conta) {
    return {
      sucesso: false,
      erro: "Não foi possível criar ou localizar a conta compartilhada (Compras/Requerimentos/Hub).",
    };
  }

  // Conta removida antes (login bloqueado): reativar aqui devolve o login.
  if (ativo && usuarioId) {
    await adminCompartilhado.auth.admin.updateUserById(usuarioId, { ban_duration: "none" });
  }

  const linkCompartilhado = conta.criadaAgora ? await linkPrimeiroAcessoDaConta(conta.id) : undefined;

  const pessoa = { nome, email };
  const resultados: Partial<Record<Modulo, ResultadoModulo>> = {};

  if (decisoes?.compras) {
    resultados.compras = await aprovarCompras(conta.id, pessoa, decisoes.compras, linkCompartilhado, ativo);
  }
  if (decisoes?.requerimentos) {
    resultados.requerimentos = await aprovarRequerimentos(pessoa, decisoes.requerimentos, linkCompartilhado, ativo);
  }
  if (decisoes?.numera) {
    resultados.numera = await aprovarNumera(pessoa, decisoes.numera, ativo, linkCompartilhado);
  }
  if (decisoes?.emendas) {
    resultados.emendas = await aprovarEmendas(conta.id, decisoes.emendas, linkCompartilhado, ativo);
  }
  if (decisoes?.frotas) {
    resultados.frotas = await aprovarFrotas(conta.id, decisoes.frotas, linkCompartilhado);
  }
  if (decisoes?.imoveis) {
    resultados.imoveis = await aprovarImoveis(conta.id, decisoes.imoveis, linkCompartilhado);
  }

  await enviarLinkNoEmailEAnotar(pessoa, linkCompartilhado, modulos, resultados);

  const hub = await criarClienteServidor();

  // O bookkeeping (`hub.definir_acesso`) grava o conjunto de módulos que
  // devem aparecer como "liberados" no Hub: os que o admin manteve marcados
  // e NÃO precisavam de nova decisão (já providos antes), mais os que
  // acabaram de ser (re)provisionados com sucesso agora — nunca um módulo
  // cuja provisão real falhou, para o cartão do Hub não mentir sobre acesso
  // que a pessoa não tem de fato.
  const modulosComFalha = new Set(
    (Object.keys(resultados) as Modulo[]).filter((m) => !resultados[m]?.sucesso)
  );
  const modulosParaGravar = modulos.filter((m) => !modulosComFalha.has(m));

  const { error } = await hub.rpc("definir_acesso", {
    p_email: email,
    p_nome: nome,
    p_admin_hub: adminHub,
    p_modulos: modulosParaGravar,
    p_ativo: ativo,
  });

  if (error) {
    console.error("[definirAcesso] erro na RPC hub.definir_acesso:", error);
    return { sucesso: false, erro: traduzirErro(error.message) };
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/usuarios");
  return { sucesso: true, resultados };
}

/**
 * Gera (ou devolve o que já está pendente) o link de primeiro acesso de quem
 * ainda não entrou. Recusa contas que já acessaram: um link de definir senha
 * para uma conta em uso seria, na prática, a chave dela.
 */
export async function obterLinkPrimeiroAcesso(
  usuarioId: string
): Promise<{ sucesso: true; link: string } | { sucesso: false; erro: string }> {
  const usuario = await obterUsuarioAtual();
  if (!usuario?.admin_hub) return { sucesso: false, erro: "Sem permissão." };

  const { data: conta } = await criarClienteAdminBruto().auth.admin.getUserById(usuarioId);
  if (!conta.user) return { sucesso: false, erro: "Conta não encontrada." };
  if (conta.user.last_sign_in_at) {
    return {
      sucesso: false,
      erro: "Esta pessoa já acessou. Se esqueceu a senha, ela mesma pede em “Esqueci minha senha”.",
    };
  }

  const link = await linkPrimeiroAcessoDaConta(usuarioId);
  if (!link) return { sucesso: false, erro: "Não foi possível gerar o link agora. Tente de novo." };
  revalidatePath("/configuracoes/usuarios");
  return { sucesso: true, link };
}

/** Reenvia (ou envia pela primeira vez) o link de primeiro acesso por e-mail.
 * Mesma regra de `obterLinkPrimeiroAcesso`: só para quem ainda não acessou. */
export async function enviarLinkPrimeiroAcessoPorEmail(
  usuarioId: string
): Promise<{ sucesso: true; link: string; email: string } | { sucesso: false; erro: string }> {
  const atual = await obterUsuarioAtual();
  if (!atual?.admin_hub) return { sucesso: false, erro: "Sem permissão." };

  const admin = criarClienteAdminBruto();
  const { data: conta } = await admin.auth.admin.getUserById(usuarioId);
  if (!conta.user?.email) return { sucesso: false, erro: "Conta não encontrada." };
  if (conta.user.last_sign_in_at) {
    return { sucesso: false, erro: "Esta pessoa já acessou. Ela mesma pode usar “Esqueci minha senha”." };
  }

  const [{ data: perfil }, { data: acessos }] = await Promise.all([
    admin.schema("hub").from("usuarios").select("nome").eq("id", usuarioId).maybeSingle(),
    admin.schema("hub").from("acessos_modulo").select("modulo").eq("usuario_id", usuarioId),
  ]);

  const link = await linkPrimeiroAcessoDaConta(usuarioId);
  if (!link) return { sucesso: false, erro: "Não foi possível gerar o link agora. Tente de novo." };

  const enviado = await enviarEmailPrimeiroAcesso({
    nome: (perfil?.nome as string | undefined) ?? conta.user.email,
    email: conta.user.email,
    link,
    modulos: (acessos ?? []).map((a) => a.modulo as Modulo),
  });
  revalidatePath("/configuracoes/usuarios");
  if (!enviado) {
    return { sucesso: false, erro: "Não foi possível enviar o e-mail agora. Copie o link e envie à pessoa." };
  }
  return { sucesso: true, link, email: conta.user.email };
}

/**
 * "Remover usuário": tira o acesso a TODOS os módulos e bloqueia o login, mantendo o histórico
 * (processos, logs, documentos) — apagar a conta quebraria a auditoria. Reversível: marcar Ativo e
 * os módulos de novo em `definirAcesso` desbloqueia o login.
 *  1) `hub.definir_acesso` (módulos = [], inativo): zera os cartões e desativa Compras/Requerimentos;
 *  2) Numera (projeto separado): `approved = false` na conta de mesmo e-mail;
 *  3) conta compartilhada: login bloqueado (ban) — cobre Emendas, Frotas, Imóveis e o próprio Hub.
 */
export async function removerUsuario(dados: {
  usuarioId: string;
  email: string;
}): Promise<{ sucesso: true; avisos: string[] } | { sucesso: false; erro: string }> {
  const analise = z.object({ usuarioId: z.uuid(), email: z.email() }).safeParse(dados);
  if (!analise.success) return { sucesso: false, erro: "Dados inválidos" };

  const atual = await obterUsuarioAtual();
  if (!atual?.admin_hub) return { sucesso: false, erro: "Sem permissão para remover usuários." };
  if (atual.id === analise.data.usuarioId) {
    return { sucesso: false, erro: "Você não pode remover o seu próprio acesso." };
  }

  const { usuarioId, email } = analise.data;
  const avisos: string[] = [];

  const { data: alvo } = await criarClienteAdmin().from("usuarios").select("nome").eq("id", usuarioId).maybeSingle();

  const hub = await criarClienteServidor();
  const { error } = await hub.rpc("definir_acesso", {
    p_email: email,
    p_nome: alvo?.nome ?? email,
    p_admin_hub: false,
    p_modulos: [],
    p_ativo: false,
  });
  if (error) {
    console.error("[removerUsuario] hub.definir_acesso:", error);
    return { sucesso: false, erro: traduzirErro(error.message) };
  }

  try {
    const numera = criarClienteNumeraAdmin();
    const { error: erroNumera } = await numera.from("users").update({ approved: false }).ilike("email", email);
    if (erroNumera) avisos.push("Numera: não foi possível desativar a conta.");
  } catch {
    avisos.push("Numera: chave de administrador não configurada; a conta de lá continua ativa.");
  }

  const { error: erroBan } = await criarClienteAdminBruto().auth.admin.updateUserById(usuarioId, {
    ban_duration: "876000h",
  });
  if (erroBan) avisos.push("Login da conta compartilhada não foi bloqueado.");

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/usuarios");
  return { sucesso: true, avisos };
}
