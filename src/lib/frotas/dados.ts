import "server-only";

import { cache } from "react";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { PARAMETROS_PADRAO } from "@/lib/frotas/regras";
import { temAcessoAoModulo } from "@/lib/sso/gerar-link";
import { criarClienteFrotas } from "@/lib/supabase/frotas-cliente";
import type { UsuarioHub } from "@/types/database";
import type {
  Fornecedor,
  Manutencao,
  NotaCombustivel,
  ParametrosFrotas,
  PerfilEfetivoFrotas,
  SecretariaFrotas,
  TipoFornecedor,
  Veiculo,
} from "@/types/frotas";

/**
 * Leituras do módulo Frotas — sempre com a sessão de quem está logado
 * (`criarClienteFrotas`), nunca com service_role: o que cada pessoa vê é
 * decidido pela RLS do schema `frotas`.
 */

export type ContextoFrotas =
  | { situacao: "sem_login" }
  | { situacao: "inativo" }
  | { situacao: "sem_acesso"; usuario: UsuarioHub }
  | { situacao: "sem_perfil"; usuario: UsuarioHub }
  | { situacao: "ok"; usuario: UsuarioHub; perfil: PerfilEfetivoFrotas; gestor: boolean };

function falhou(onde: string, error: unknown): never {
  console.error(`[frotas:${onde}]`, error);
  throw new Error("Não foi possível carregar os dados de Frotas. Tente novamente.");
}

export const obterContextoFrotas = cache(async (): Promise<ContextoFrotas> => {
  const usuario = await obterUsuarioAtual();
  if (!usuario) return { situacao: "sem_login" };
  if (!usuario.ativo) return { situacao: "inativo" };
  const frotas = await criarClienteFrotas();
  const [temAcesso, { data: perfil, error }] = await Promise.all([
    temAcessoAoModulo(usuario.id, usuario.admin_hub, "frotas"),
    frotas.rpc("meu_perfil"),
  ]);
  if (!temAcesso) return { situacao: "sem_acesso", usuario };
  if (error) falhou("meu_perfil", error);
  if (!perfil) return { situacao: "sem_perfil", usuario };
  return { situacao: "ok", usuario, perfil, gestor: perfil === "admin" || perfil === "gestor" };
});

const TAMANHO_PAGINA = 1000; // limite de linhas por resposta da API (Max rows)

/** Lê a tabela inteira em páginas de 1000 linhas. */
async function lerTodas<T>(buscar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>, onde: string): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await buscar(de, de + TAMANHO_PAGINA - 1);
    if (error) falhou(onde, error);
    const pagina = data ?? [];
    tudo.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return tudo;
  }
}

/** `numeric` pode chegar como texto, conforme a configuração da API: sempre número aqui. */
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export const listarSecretarias = cache(async (): Promise<SecretariaFrotas[]> => {
  const frotas = await criarClienteFrotas();
  const { data, error } = await frotas.from("secretarias").select("*").order("nome");
  if (error) falhou("secretarias", error);
  return data ?? [];
});

export const listarFornecedores = cache(async (tipo?: TipoFornecedor): Promise<Fornecedor[]> => {
  const frotas = await criarClienteFrotas();
  let consulta = frotas.from("fornecedores").select("*").order("nome");
  if (tipo) consulta = consulta.eq("tipo", tipo);
  const { data, error } = await consulta;
  if (error) falhou("fornecedores", error);
  return data ?? [];
});

export const listarVeiculos = cache(async (): Promise<Veiculo[]> => {
  const frotas = await criarClienteFrotas();
  const linhas = await lerTodas<Veiculo>(
    (de, ate) => frotas.from("veiculos").select("*").order("placa", { nullsFirst: false }).order("id").range(de, ate),
    "veiculos"
  );
  return linhas.map((v) => ({ ...v, valor_referencia: num(v.valor_referencia) }));
});

export const listarNotas = cache(async (): Promise<NotaCombustivel[]> => {
  const frotas = await criarClienteFrotas();
  const linhas = await lerTodas<NotaCombustivel>(
    (de, ate) => frotas.from("notas_combustivel").select("*").order("periodo_inicio", { ascending: false }).order("id").range(de, ate),
    "notas_combustivel"
  );
  return linhas.map((n) => ({ ...n, valor: Number(n.valor) }));
});

export const listarManutencoes = cache(async (): Promise<Manutencao[]> => {
  const frotas = await criarClienteFrotas();
  const linhas = await lerTodas<Manutencao>(
    (de, ate) => frotas.from("manutencoes").select("*").order("orcamento_recebido_em", { ascending: false }).order("id").range(de, ate),
    "manutencoes"
  );
  return linhas.map((m) => ({
    ...m,
    orcamento_valor: Number(m.orcamento_valor),
    oc_valor: num(m.oc_valor),
    nf_valor: num(m.nf_valor),
  }));
});

export const obterParametros = cache(async (): Promise<ParametrosFrotas> => {
  const frotas = await criarClienteFrotas();
  const { data, error } = await frotas.from("parametros").select("*").eq("id", 1).maybeSingle();
  if (error) falhou("parametros", error);
  return data ?? PARAMETROS_PADRAO;
});

/** Histórico de alterações de um registro (só gestor lê a auditoria). */
export async function listarAuditoria(tabela: string, registroId: string) {
  const frotas = await criarClienteFrotas();
  const { data, error } = await frotas
    .from("auditoria")
    .select("id,acao,usuario_id,em,antes,depois")
    .eq("tabela", tabela)
    .eq("registro_id", registroId)
    .order("em", { ascending: false })
    .limit(50);
  if (error) falhou("auditoria", error);
  return data ?? [];
}
