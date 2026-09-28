"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import {
  encontrarOuCriarConta,
  gerarLinkPrimeiroAcesso,
  aprovarCompras,
  aprovarRequerimentos,
  aprovarNumera,
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
  modulos: z.array(z.enum(["compras", "numera", "requerimentos"])),
  ativo: z.boolean(),
  decisoes: z
    .object({
      compras: z.object({ perfil: z.string(), setorId: z.string().nullable() }).optional(),
      requerimentos: z.object({ perfil: z.string(), secretariaId: z.string().nullable() }).optional(),
      numera: z.object({ role: z.string(), documentos: z.array(z.string()) }).optional(),
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

  const linkCompartilhado = conta.criadaAgora
    ? await gerarLinkPrimeiroAcesso(adminCompartilhado, email)
    : undefined;

  const pessoa = { nome, email };
  const resultados: Partial<Record<Modulo, ResultadoModulo>> = {};

  if (decisoes?.compras) {
    resultados.compras = await aprovarCompras(conta.id, pessoa, decisoes.compras, linkCompartilhado, ativo);
  }
  if (decisoes?.requerimentos) {
    resultados.requerimentos = await aprovarRequerimentos(pessoa, decisoes.requerimentos, linkCompartilhado, ativo);
  }
  if (decisoes?.numera) {
    resultados.numera = await aprovarNumera(pessoa, decisoes.numera, ativo);
  }

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
