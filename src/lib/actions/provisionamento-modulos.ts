/**
 * Provisionamento de conta compartilhada + perfil por módulo — extraído de
 * `solicitacoes.ts` para ser reaproveitado também pela concessão direta de
 * acesso em Configurações → Usuários e acessos (`configuracoes.ts`).
 *
 * Antes desta extração, "Conceder acesso" em Configurações só gravava o
 * cartão em `hub.acessos_modulo` (via `hub.definir_acesso`) — nunca criava a
 * conta de autenticação nem o cadastro dentro do módulo (Compras/
 * Requerimentos/Numera), então marcar um módulo ali dava a impressão de
 * acesso concedido sem conceder nada de fato. `hub.definir_acesso` e
 * `requerimentos.definir_acesso` também exigem que `auth.users` já tenha o
 * e-mail — por isso o erro "A pessoa precisa já ter login em algum módulo da
 * plataforma" aparecia mesmo sendo essa a TELA pensada para dar o primeiro
 * acesso. As funções `aprovar*` abaixo resolvem os dois problemas juntas:
 * criam a conta quando não existe e chamam a RPC de cada módulo de verdade.
 * Reaproveitadas pelos dois fluxos (aprovação de solicitação e concessão
 * direta) — só o bookkeeping do Hub em si (`sincronizarBookkeepingHub`, no
 * fim deste arquivo) é específico da aprovação de solicitação, porque a
 * concessão direta precisa de uma semântica diferente (ver comentário lá).
 */

import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteCompras } from "@/lib/supabase/compras-cliente";
import { criarClienteRequerimentos } from "@/lib/supabase/requerimentos-cliente";
import { criarClienteNumeraAdmin } from "@/lib/supabase/numera-admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Modulo } from "@/types/database";

export type DecisaoCompras = { perfil: string; setorId: string | null };
export type DecisaoRequerimentos = { perfil: string; secretariaId: string | null };
export type DecisaoNumera = { role: string; documentos: string[] };

export type DecisaoAprovacao = {
  compras?: DecisaoCompras;
  requerimentos?: DecisaoRequerimentos;
  numera?: DecisaoNumera;
};

export type ResultadoModulo = { sucesso: boolean; mensagem?: string; linkPrimeiroAcesso?: string };

export type PessoaAlvo = { nome: string; email: string; secretariaSugerida?: string | null };

export type ClienteComAuthAdmin = {
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
export async function encontrarAuthIdPorEmail(admin: ClienteComAuthAdmin, email: string): Promise<string | null> {
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
export async function encontrarOuCriarConta(
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

export async function gerarLinkPrimeiroAcesso(admin: ClienteComAuthAdmin, email: string): Promise<string | undefined> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email });
  if (error) {
    console.error("[gerarLinkPrimeiroAcesso] falhou:", error);
    return undefined;
  }
  return data?.properties?.action_link;
}

export async function aprovarCompras(
  authId: string,
  pessoa: PessoaAlvo,
  decisao: DecisaoCompras,
  linkPrimeiroAcesso: string | undefined,
  ativo: boolean = true
): Promise<ResultadoModulo> {
  const compras = await criarClienteCompras();
  const adminBruto = criarClienteAdminBruto();

  const { data: existente } = await adminBruto
    .schema("public")
    .from("usuarios")
    .select("id")
    .eq("id", authId)
    .maybeSingle();

  // admin_criar_usuario não tem parâmetro p_ativo (conta nova sempre nasce
  // ativa, por definição da própria RPC) — `ativo` só se aplica ao
  // atualizar uma conta existente.
  const { error } = existente
    ? await compras.rpc("admin_atualizar_usuario", {
        p_usuario_id: authId,
        p_nome: pessoa.nome,
        p_perfil: decisao.perfil,
        p_setor_id: decisao.setorId,
        p_ativo: ativo,
      })
    : await compras.rpc("admin_criar_usuario", {
        p_id: authId,
        p_nome: pessoa.nome,
        p_email: pessoa.email,
        p_perfil: decisao.perfil,
        p_setor_id: decisao.setorId,
      });

  if (error) {
    console.error("[aprovarCompras] falha:", error);
    return { sucesso: false, mensagem: error.message };
  }
  return { sucesso: true, linkPrimeiroAcesso };
}

export async function aprovarRequerimentos(
  pessoa: PessoaAlvo,
  decisao: DecisaoRequerimentos,
  linkPrimeiroAcesso: string | undefined,
  ativo: boolean = true
): Promise<ResultadoModulo> {
  const requerimentos = await criarClienteRequerimentos();
  const { error } = await requerimentos.rpc("definir_acesso", {
    p_email: pessoa.email,
    p_nome: pessoa.nome,
    p_perfil: decisao.perfil,
    p_secretaria_id: decisao.secretariaId,
    p_ativo: ativo,
  });

  if (error) {
    console.error("[aprovarRequerimentos] falha:", error);
    return { sucesso: false, mensagem: error.message };
  }
  return { sucesso: true, linkPrimeiroAcesso };
}

export async function aprovarNumera(
  pessoa: PessoaAlvo,
  decisao: DecisaoNumera,
  ativo: boolean = true
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
    .ilike("email", pessoa.email)
    .maybeSingle();

  let userId = existente?.id as string | undefined;
  let criadaAgora = false;

  if (!userId) {
    // Achado real (caso da Leandra Delgado, 29/09/2026): o Numera tem
    // usuários migrados de antes do cadastro unificado cujo e-mail lá é
    // DIFERENTE do e-mail cadastrado no Hub (ex.: conta antiga sem e-mail
    // próprio, resolvida na migração com um e-mail pessoal informado à
    // parte). Sem checar por nome também, a busca por e-mail exato não
    // encontra ninguém e cria uma conta NOVA duplicada — foi exatamente
    // isso que aconteceu, precisou de limpeza manual no banco depois.
    // Nome igual (trim + case-insensitive) com e-mail diferente é sinal
    // forte demais pra decidir sozinho (risco de juntar duas pessoas
    // diferentes homônimas) — para, e deixa o admin resolver olhando os
    // dois cadastros antes de tentar de novo.
    const { data: porNome } = await numeraAdmin
      .from("users")
      .select("id, email, username")
      .ilike("name", pessoa.nome.trim());
    if (porNome && porNome.length > 0) {
      const emails = porNome.map((u) => u.email || u.username).join(", ");
      return {
        sucesso: false,
        mensagem: `Já existe conta no Numera com o mesmo nome, mas e-mail diferente (${emails}) — provável cadastro antigo. Confirme com a pessoa qual é a conta certa antes de aprovar (evita duplicar).`,
      };
    }

    const conta = await encontrarOuCriarConta(numeraAdmin, pessoa.email, pessoa.nome);
    if (!conta) {
      return { sucesso: false, mensagem: "Não foi possível criar a conta no projeto do Numera." };
    }
    userId = conta.id;
    criadaAgora = conta.criadaAgora;
  }

  const payload: Record<string, unknown> = {
    id: userId,
    email: pessoa.email,
    name: pessoa.nome,
    role: decisao.role,
    allowed_documents: decisao.documentos,
    approved: ativo,
  };
  if (!existente) {
    const usuarioBase = pessoa.email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, "") || "usuario";
    payload.username = `${usuarioBase}.${userId.slice(0, 6)}`;
    payload.password = crypto.randomUUID();
  }
  if (pessoa.secretariaSugerida) {
    payload.secretaria = pessoa.secretariaSugerida;
  }

  const { error: erroUpsert } = await numeraAdmin.from("users").upsert(payload, { onConflict: "id" });
  if (erroUpsert) {
    console.error("[aprovarNumera] falha ao gravar users:", erroUpsert);
    return { sucesso: false, mensagem: erroUpsert.message };
  }

  const linkPrimeiroAcesso = criadaAgora
    ? await gerarLinkPrimeiroAcesso(numeraAdmin, pessoa.email)
    : undefined;

  return { sucesso: true, linkPrimeiroAcesso };
}

/** Soma os módulos aprovados nesta chamada aos que a pessoa já tinha, e
 * grava via `hub.definir_acesso` — nunca revoga aqui (revogar é uma ação à
 * parte). Usada só por `aprovarSolicitacao`: uma solicitação nunca pede pra
 * TIRAR um módulo, só somar, então "união com o que já existia" é a
 * semântica certa aqui. A concessão direta em Configurações
 * (`definirAcesso`) precisa do comportamento oposto — o conjunto final é
 * exatamente o que o admin marcou no formulário, inclusive podendo
 * DESMARCAR um módulo — por isso ela grava o bookkeeping com sua própria
 * chamada a `hub.definir_acesso`, sem passar por esta função. */
export async function sincronizarBookkeepingHub(
  hub: Awaited<ReturnType<typeof criarClienteServidor>>,
  authId: string,
  pessoa: PessoaAlvo,
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
    p_email: pessoa.email,
    p_nome: pessoa.nome,
    p_admin_hub: hubUsuario?.admin_hub ?? false,
    p_modulos: Array.from(conjunto),
    p_ativo: true,
  });
  if (error) {
    console.error("[sincronizarBookkeepingHub] hub.definir_acesso falhou:", error);
  }
}
