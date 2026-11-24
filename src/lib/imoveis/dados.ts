import "server-only";

import { cache } from "react";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { PARAMETROS_PADRAO } from "@/lib/imoveis/regras";
import { temAcessoAoModulo } from "@/lib/sso/gerar-link";
import { lerComCacheModulo } from "@/lib/modulo/cache-dados";
import { lerTodasEmParalelo } from "@/lib/modulo/ler-todas";
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

const lerTodas = <T,>(buscar: Parameters<typeof lerTodasEmParalelo<T>>[0], onde: string) => lerTodasEmParalelo<T>(buscar, falhou, onde);

/** `numeric` pode chegar como texto, conforme a configuração da API: sempre número aqui. */
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export const listarSecretarias = cache(
  (): Promise<SecretariaImoveis[]> =>
    lerComCacheModulo("imoveis", "secretarias", "", async () => {
      const imoveis = await criarClienteImoveis();
      const { data, error } = await imoveis.from("secretarias").select("*").order("nome");
      if (error) falhou("secretarias", error);
      return data ?? [];
    })
);

export const listarImobiliarias = cache(
  (): Promise<Imobiliaria[]> =>
    lerComCacheModulo("imoveis", "imobiliarias", "", async () => {
      const imoveis = await criarClienteImoveis();
      const { data, error } = await imoveis.from("imobiliarias").select("*").order("nome");
      if (error) falhou("imobiliarias", error);
      return data ?? [];
    })
);

export const listarImoveis = cache(
  (): Promise<Imovel[]> =>
    lerComCacheModulo("imoveis", "imoveis", "", async () => {
      const imoveis = await criarClienteImoveis();
      const linhas = await lerTodas<Imovel>((de, ate, o) => imoveis.from("imoveis").select("*", o).order("nome").order("id").range(de, ate), "imoveis");
      return linhas.map((i) => ({ ...i, valor_aluguel: Number(i.valor_aluguel) }));
    })
);

export const listarUnidades = cache(
  (): Promise<Unidade[]> =>
    lerComCacheModulo("imoveis", "unidades", "", async () => {
      const imoveis = await criarClienteImoveis();
      return lerTodas<Unidade>((de, ate, o) => imoveis.from("unidades").select("*", o).order("numero").order("id").range(de, ate), "unidades");
    })
);

export const listarContas = cache(
  (): Promise<Conta[]> =>
    lerComCacheModulo("imoveis", "contas", "", async () => {
      const imoveis = await criarClienteImoveis();
      const linhas = await lerTodas<Conta>(
        (de, ate, o) => imoveis.from("contas").select("*", o).order("referencia", { ascending: false }).order("id").range(de, ate),
        "contas"
      );
      return linhas.map((c) => ({ ...c, valor: Number(c.valor), consumo: num(c.consumo) }));
    })
);

export const listarEntregas = cache(
  (): Promise<Entrega[]> =>
    lerComCacheModulo("imoveis", "entregas", "", async () => {
      const imoveis = await criarClienteImoveis();
      return lerTodas<Entrega>((de, ate, o) => imoveis.from("entregas").select("*", o).order("id").range(de, ate), "entregas");
    })
);

export const listarJustificadas = cache(
  (): Promise<PendenciaJustificada[]> =>
    lerComCacheModulo("imoveis", "justificadas", "", async () => {
      const imoveis = await criarClienteImoveis();
      const { data, error } = await imoveis.from("pendencias_justificadas").select("*");
      if (error) falhou("pendencias_justificadas", error);
      return data ?? [];
    })
);

export const obterParametros = cache(
  (): Promise<ParametrosImoveis> =>
    lerComCacheModulo("imoveis", "parametros", "", async () => {
      const imoveis = await criarClienteImoveis();
      const { data, error } = await imoveis.from("parametros").select("*").eq("id", 1).maybeSingle();
      if (error) falhou("parametros", error);
      if (!data) return PARAMETROS_PADRAO;
      return { ...data, pct_acima: Number(data.pct_acima), pct_abaixo: Number(data.pct_abaixo), pct_valor: Number(data.pct_valor) };
    })
);

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
