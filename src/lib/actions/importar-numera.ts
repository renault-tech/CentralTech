"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { criarClienteAdmin } from "@/lib/supabase/admin";

const esquemaSelecionados = z.array(
  z.object({
    email: z.email(),
    nome: z.string().trim().min(1),
  })
);

export type LinhaImportacao = {
  email: string;
  resultado: "criado" | "ja_tinha_acesso" | "erro";
  detalhe?: string;
};

/**
 * Procura o e-mail em `auth.users` deste projeto sem depender de um filtro
 * de e-mail na Admin API (nem toda versão do supabase-js expõe um) —
 * pagina `listUsers` até achar ou esgotar (limite baixo: a base atual tem
 * poucas dezenas de contas nos dois projetos somados).
 */
async function encontrarAuthIdPorEmail(
  admin: ReturnType<typeof criarClienteAdmin>,
  email: string
): Promise<string | null> {
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

/**
 * Cria (ou reaproveita) a conta de cada usuário selecionado do Numera e
 * concede o módulo `numera` no Hub — admin_hub only. Quem já existe em
 * `hub.usuarios` (por já ter conta também no Compras, por exemplo) só
 * ganha o módulo extra, sem criar uma segunda conta de Auth.
 */
export async function importarUsuariosNumera(
  selecionados: z.infer<typeof esquemaSelecionados>
): Promise<{ sucesso: true; linhas: LinhaImportacao[] } | { sucesso: false; erro: string }> {
  const usuario = await obterUsuarioAtual();
  if (!usuario?.admin_hub) {
    return { sucesso: false, erro: "Sem permissão para importar usuários." };
  }

  const analise = esquemaSelecionados.safeParse(selecionados);
  if (!analise.success || analise.data.length === 0) {
    return { sucesso: false, erro: "Selecione ao menos um usuário." };
  }

  const admin = criarClienteAdmin();
  const linhas: LinhaImportacao[] = [];

  for (const { email, nome } of analise.data) {
    try {
      const { data: existente } = await admin
        .from("usuarios")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      let authId = existente?.id ?? null;

      if (!authId) {
        const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
          email,
          password: crypto.randomUUID(),
          email_confirm: true,
        });

        if (erroCriar) {
          authId = await encontrarAuthIdPorEmail(admin, email);
          if (!authId) {
            linhas.push({ email, resultado: "erro", detalhe: erroCriar.message });
            continue;
          }
        } else {
          authId = criado.user.id;
        }
      }

      const { error: erroUsuarios } = await admin
        .from("usuarios")
        .upsert({ id: authId, nome, email, ativo: true }, { onConflict: "id" });

      if (erroUsuarios) {
        // Só desfaz a conta do Auth se foi criada agora mesmo (nunca
        // remove uma conta que já existia antes desta importação).
        if (!existente) {
          await admin.auth.admin.deleteUser(authId);
        }
        linhas.push({ email, resultado: "erro", detalhe: erroUsuarios.message });
        continue;
      }

      const { error: erroAcesso } = await admin
        .from("acessos_modulo")
        .upsert({ usuario_id: authId, modulo: "numera" }, { onConflict: "usuario_id,modulo" });

      if (erroAcesso) {
        linhas.push({ email, resultado: "erro", detalhe: erroAcesso.message });
        continue;
      }

      linhas.push({ email, resultado: existente ? "ja_tinha_acesso" : "criado" });
    } catch (e) {
      linhas.push({ email, resultado: "erro", detalhe: e instanceof Error ? e.message : "Falha inesperada." });
    }
  }

  revalidatePath("/configuracoes");
  return { sucesso: true, linhas };
}
