import "server-only";

import { cache } from "react";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { PARAMETROS_PADRAO } from "@/lib/frotas/regras";
import { temAcessoAoModulo } from "@/lib/sso/gerar-link";
import { lerComCacheModulo } from "@/lib/modulo/cache-dados";
import { lerTodasEmParalelo } from "@/lib/modulo/ler-todas";
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

const lerTodas = <T,>(buscar: Parameters<typeof lerTodasEmParalelo<T>>[0], onde: string) => lerTodasEmParalelo<T>(buscar, falhou, onde);

/** `numeric` pode chegar como texto, conforme a configuração da API: sempre número aqui. */
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export const listarSecretarias = cache(
  (): Promise<SecretariaFrotas[]> =>
    lerComCacheModulo("frotas", "secretarias", "", async () => {
      const frotas = await criarClienteFrotas();
      const { data, error } = await frotas.from("secretarias").select("*").order("nome");
      if (error) falhou("secretarias", error);
      return data ?? [];
    })
);

export const listarFornecedores = cache(
  (tipo?: TipoFornecedor): Promise<Fornecedor[]> =>
    lerComCacheModulo("frotas", "fornecedores", tipo ?? "todos", async () => {
      const frotas = await criarClienteFrotas();
      let consulta = frotas.from("fornecedores").select("*").order("nome");
      if (tipo) consulta = consulta.eq("tipo", tipo);
      const { data, error } = await consulta;
      if (error) falhou("fornecedores", error);
      return data ?? [];
    })
);

export const listarVeiculos = cache(
  (): Promise<Veiculo[]> =>
    lerComCacheModulo("frotas", "veiculos", "", async () => {
      const frotas = await criarClienteFrotas();
      const linhas = await lerTodas<Veiculo>(
        (de, ate, o) => frotas.from("veiculos").select("*", o).order("placa", { nullsFirst: false }).order("id").range(de, ate),
        "veiculos"
      );
      return linhas.map((v) => ({ ...v, valor_referencia: num(v.valor_referencia) }));
    })
);

export const listarNotas = cache(
  (): Promise<NotaCombustivel[]> =>
    lerComCacheModulo("frotas", "notas", "", async () => {
      const frotas = await criarClienteFrotas();
      const linhas = await lerTodas<NotaCombustivel>(
        (de, ate, o) => frotas.from("notas_combustivel").select("*", o).order("periodo_inicio", { ascending: false }).order("id").range(de, ate),
        "notas_combustivel"
      );
      return linhas.map((n) => ({ ...n, valor: Number(n.valor) }));
    })
);

export const listarManutencoes = cache(
  (): Promise<Manutencao[]> =>
    lerComCacheModulo("frotas", "manutencoes", "", async () => {
      const frotas = await criarClienteFrotas();
      const linhas = await lerTodas<Manutencao>(
        (de, ate, o) => frotas.from("manutencoes").select("*", o).order("orcamento_recebido_em", { ascending: false }).order("id").range(de, ate),
        "manutencoes"
      );
      return linhas.map((m) => ({
        ...m,
        orcamento_valor: Number(m.orcamento_valor),
        oc_valor: num(m.oc_valor),
        nf_valor: num(m.nf_valor),
      }));
    })
);

export const obterParametros = cache(
  (): Promise<ParametrosFrotas> =>
    lerComCacheModulo("frotas", "parametros", "", async () => {
      const frotas = await criarClienteFrotas();
      const { data, error } = await frotas.from("parametros").select("*").eq("id", 1).maybeSingle();
      if (error) falhou("parametros", error);
      return data ?? PARAMETROS_PADRAO;
    })
);

/**
 * Selo do menu ("orçamentos a analisar"): só a contagem, sem trazer as manutenções inteiras (o layout carregava a tabela toda
 * em toda página para mostrar um número).
 */
export const contarOrcamentosAAnalisar = cache(
  (): Promise<number> =>
    lerComCacheModulo("frotas", "orcamentos-a-analisar", "", async () => {
      const frotas = await criarClienteFrotas();
      const { count, error } = await frotas.from("manutencoes").select("id", { count: "exact", head: true }).eq("status_analise", "a_analisar");
      if (error) falhou("orcamentos-a-analisar", error);
      return count ?? 0;
    })
);

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
