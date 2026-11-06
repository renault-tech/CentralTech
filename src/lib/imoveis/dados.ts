import "server-only";

import { cache } from "react";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { PARAMETROS_PADRAO } from "@/lib/imoveis/regras";
import { temAcessoAoModulo } from "@/lib/sso/gerar-link";
import { criarClienteImoveis } from "@/lib/supabase/imoveis-cliente";
import type { UsuarioHub } from "@/types/database";
import type {
  Conta,
  Entrega,
  Imobiliaria,
  Imovel,
  ParametrosImoveis,
  PendenciaJustificada,
  PerfilEfetivoImoveis,
  SecretariaImoveis,
  Unidade,
} from "@/types/imoveis";

/**
 * Leituras do módulo Imóveis e Consumo — sempre com a sessão de quem está logado (`criarClienteImoveis`),
 * nunca service_role: o que cada pessoa vê é decidido pela RLS do schema `imoveis` (a secretaria só enxerga
 * os imóveis, unidades, contas e entregas da própria secretaria).
 */

export type ContextoImoveis =
  | { situacao: "sem_login" }
  | { situacao: "inativo" }
  | { situacao: "sem_acesso"; usuario: UsuarioHub }
  | { situacao: "sem_perfil"; usuario: UsuarioHub }
  | {
      situacao: "ok";
      usuario: UsuarioHub;
      perfil: PerfilEfetivoImoveis;
      gestor: boolean;
      /** Só no perfil "secretaria": a secretaria a que a pessoa pertence. */
      secretariaId: string | null;
    };

function falhou(onde: string, error: unknown): never {
  console.error(`[imoveis:${onde}]`, error);
  throw new Error("Não foi possível carregar os dados de Imóveis. Tente novamente.");
}

export const obterContextoImoveis = cache(async (): Promise<ContextoImoveis> => {
  const usuario = await obterUsuarioAtual();
  if (!usuario) return { situacao: "sem_login" };
  if (!usuario.ativo) return { situacao: "inativo" };
  const imoveis = await criarClienteImoveis();
  const [temAcesso, { data: perfil, error }, { data: secretariaId }] = await Promise.all([
    temAcessoAoModulo(usuario.id, usuario.admin_hub, "imoveis"),
    imoveis.rpc("meu_perfil"),
    imoveis.rpc("minha_secretaria"),
  ]);
  if (!temAcesso) return { situacao: "sem_acesso", usuario };
  if (error) falhou("meu_perfil", error);
  if (!perfil) return { situacao: "sem_perfil", usuario };
  return { situacao: "ok", usuario, perfil, gestor: perfil === "admin" || perfil === "gestor", secretariaId: secretariaId ?? null };
});

const TAMANHO_PAGINA = 1000; // limite de linhas por resposta da API (Max rows)

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

export const listarSecretarias = cache(async (): Promise<SecretariaImoveis[]> => {
  const imoveis = await criarClienteImoveis();
  const { data, error } = await imoveis.from("secretarias").select("*").order("nome");
  if (error) falhou("secretarias", error);
  return data ?? [];
});

export const listarImobiliarias = cache(async (): Promise<Imobiliaria[]> => {
  const imoveis = await criarClienteImoveis();
  const { data, error } = await imoveis.from("imobiliarias").select("*").order("nome");
  if (error) falhou("imobiliarias", error);
  return data ?? [];
});

export const listarImoveis = cache(async (): Promise<Imovel[]> => {
  const imoveis = await criarClienteImoveis();
  const linhas = await lerTodas<Imovel>((de, ate) => imoveis.from("imoveis").select("*").order("nome").order("id").range(de, ate), "imoveis");
  return linhas.map((i) => ({ ...i, valor_aluguel: Number(i.valor_aluguel) }));
});

export const listarUnidades = cache(async (): Promise<Unidade[]> => {
  const imoveis = await criarClienteImoveis();
  return lerTodas<Unidade>((de, ate) => imoveis.from("unidades").select("*").order("numero").order("id").range(de, ate), "unidades");
});

export const listarContas = cache(async (): Promise<Conta[]> => {
  const imoveis = await criarClienteImoveis();
  const linhas = await lerTodas<Conta>(
    (de, ate) => imoveis.from("contas").select("*").order("referencia", { ascending: false }).order("id").range(de, ate),
    "contas"
  );
  return linhas.map((c) => ({ ...c, valor: Number(c.valor), consumo: num(c.consumo) }));
});

export const listarEntregas = cache(async (): Promise<Entrega[]> => {
  const imoveis = await criarClienteImoveis();
  return lerTodas<Entrega>((de, ate) => imoveis.from("entregas").select("*").order("id").range(de, ate), "entregas");
});

export const listarJustificadas = cache(async (): Promise<PendenciaJustificada[]> => {
  const imoveis = await criarClienteImoveis();
  const { data, error } = await imoveis.from("pendencias_justificadas").select("*");
  if (error) falhou("pendencias_justificadas", error);
  return data ?? [];
});

export const obterParametros = cache(async (): Promise<ParametrosImoveis> => {
  const imoveis = await criarClienteImoveis();
  const { data, error } = await imoveis.from("parametros").select("*").eq("id", 1).maybeSingle();
  if (error) falhou("parametros", error);
  if (!data) return PARAMETROS_PADRAO;
  return { ...data, pct_acima: Number(data.pct_acima), pct_abaixo: Number(data.pct_abaixo), pct_valor: Number(data.pct_valor) };
});

/** Histórico de alterações de um registro (só gestor lê a auditoria). */
export async function listarAuditoria(tabela: string, registroId: string) {
  const imoveis = await criarClienteImoveis();
  const { data, error } = await imoveis
    .from("auditoria")
    .select("id,acao,usuario_id,em,antes,depois")
    .eq("tabela", tabela)
    .eq("registro_id", registroId)
    .order("em", { ascending: false })
    .limit(50);
  if (error) falhou("auditoria", error);
  return data ?? [];
}
