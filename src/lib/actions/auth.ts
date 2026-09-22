"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { criarClienteServidor } from "@/lib/supabase/server";
import {
  esquemaLogin,
  esquemaNovaSenha,
  esquemaRecuperacao,
  esquemaMudarSenhaLogado,
} from "@/lib/validacao/auth";

export type EstadoLogin = {
  erro?: string;
};

export type EstadoRecuperacao = {
  erro?: string;
  enviado?: boolean;
};

export type EstadoNovaSenha = {
  erro?: string;
};

export type EstadoMudarSenhaLogado = {
  erro?: string;
  sucesso?: boolean;
};

/** Origem (protocolo + host) da requisição atual, para montar links de retorno. */
async function origemDaRequisicao(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Impede open redirect: só aceita caminhos internos de um único segmento raiz. */
function destinoSeguro(valor: FormDataEntryValue | null): string {
  if (typeof valor === "string" && valor.startsWith("/") && !valor.startsWith("//")) {
    return valor;
  }
  return "/dashboard";
}

export async function entrar(
  _estadoAnterior: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const analise = esquemaLogin.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await criarClienteServidor();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: analise.data.email,
    password: analise.data.senha,
  });

  if (error || !data.user) {
    console.error("[entrar] erro do Supabase Auth:", error);
    return { erro: "E-mail ou senha incorretos." };
  }

  const { data: usuario, error: erroUsuario } = await supabase
    .from("usuarios")
    .select("ativo")
    .eq("id", data.user.id)
    .single();

  if (erroUsuario || !usuario) {
    await supabase.auth.signOut();
    return {
      erro: "Usuário autenticado, mas sem cadastro na plataforma. Contate o administrador.",
    };
  }

  if (!usuario.ativo) {
    await supabase.auth.signOut();
    return { erro: "Usuário desativado. Contate o administrador." };
  }

  redirect(destinoSeguro(formData.get("proximo")));
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Envia o e-mail de recuperação de senha (Supabase Auth). Responde sempre
 * com sucesso genérico, sem revelar se o e-mail existe.
 */
export async function solicitarRecuperacao(
  _estadoAnterior: EstadoRecuperacao,
  formData: FormData
): Promise<EstadoRecuperacao> {
  const analise = esquemaRecuperacao.safeParse({ email: formData.get("email") });

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await criarClienteServidor();
  const origem = await origemDaRequisicao();

  const { error } = await supabase.auth.resetPasswordForEmail(analise.data.email, {
    redirectTo: `${origem}/auth/confirm?next=/redefinir-senha`,
  });

  if (error) {
    console.error("[solicitarRecuperacao] erro:", error);
  }

  return { enviado: true };
}

/**
 * Define a nova senha do usuário. Só funciona com uma sessão de recuperação
 * ativa (criada por /auth/confirm ao abrir o link do e-mail).
 */
export async function redefinirSenha(
  _estadoAnterior: EstadoNovaSenha,
  formData: FormData
): Promise<EstadoNovaSenha> {
  const analise = esquemaNovaSenha.safeParse({
    senha: formData.get("senha"),
    confirmar: formData.get("confirmar"),
  });

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await criarClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      erro: "Sua sessão de recuperação expirou. Solicite um novo link de recuperação.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: analise.data.senha });

  if (error) {
    console.error("[redefinirSenha] erro:", error);
    return { erro: "Não foi possível redefinir a senha. Tente novamente." };
  }

  await supabase.auth.signOut();
  redirect("/login?motivo=senha_redefinida");
}

/**
 * Muda a senha do usuário logado. Requer a senha atual para validação.
 */
export async function mudarSenhaLogado(
  _estadoAnterior: EstadoMudarSenhaLogado,
  formData: FormData
): Promise<EstadoMudarSenhaLogado> {
  const analise = esquemaMudarSenhaLogado.safeParse({
    senhaAtual: formData.get("senhaAtual"),
    senhaNova: formData.get("senhaNova"),
    confirmar: formData.get("confirmar"),
  });

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await criarClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { erro: "Sua sessão expirou. Faça login novamente." };
  }

  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: analise.data.senhaAtual,
  });

  if (erroLogin) {
    return { erro: "Senha atual incorreta." };
  }

  const { error } = await supabase.auth.updateUser({
    password: analise.data.senhaNova,
  });

  if (error) {
    console.error("[mudarSenhaLogado] erro:", error);
    return { erro: "Não foi possível alterar a senha. Tente novamente." };
  }

  return { sucesso: true };
}
