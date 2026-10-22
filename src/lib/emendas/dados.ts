import "server-only";

import { cache } from "react";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";
import { temAcessoAoModulo } from "@/lib/sso/gerar-link";
import { CATALOGO_PADRAO, type CatalogoEtapas, type InfoEtapa } from "@/lib/emendas/regras";
import type {
  Andamento,
  Beneficiario,
  DocumentoEmenda,
  EmendaResumo,
  ExecucaoEmenda,
  Exercicio,
  Impedimento,
  MovimentoFinanceiro,
  PerfilEfetivo,
  Remanejamento,
  Secretaria,
  UnidadeOrcamentaria,
  Vereador,
} from "@/types/emendas";
import type { UsuarioHub } from "@/types/database";

/**
 * Leituras do módulo Emendas — sempre com a sessão de quem está logado
 * (`criarClienteEmendas`), nunca com service_role: o que cada pessoa vê é
 * decidido pela RLS do schema `emendas` (permissão por secretaria).
 */

export type ContextoEmendas =
  | { situacao: "sem_login" }
  | { situacao: "inativo" }
  | { situacao: "sem_acesso"; usuario: UsuarioHub }
  | { situacao: "sem_perfil"; usuario: UsuarioHub }
  | {
      situacao: "ok";
      usuario: UsuarioHub;
      perfil: PerfilEfetivo;
      /** Ids das secretarias que a pessoa pode EDITAR ("todas" p/ gestor/admin). */
      editaveis: "todas" | string[];
    };

function falhou(onde: string, error: unknown): never {
  console.error(`[emendas:${onde}]`, error);
  throw new Error("Não foi possível carregar os dados de Emendas. Tente novamente.");
}

export const obterContextoEmendas = cache(async (): Promise<ContextoEmendas> => {
  const usuario = await obterUsuarioAtual();
  if (!usuario) return { situacao: "sem_login" };
  if (!usuario.ativo) return { situacao: "inativo" };
  if (!(await temAcessoAoModulo(usuario.id, usuario.admin_hub, "emendas"))) {
    return { situacao: "sem_acesso", usuario };
  }

  const emendas = await criarClienteEmendas();
  const { data: perfil, error } = await emendas.rpc("meu_perfil");
  if (error) falhou("meu_perfil", error);
  if (!perfil) return { situacao: "sem_perfil", usuario };

  if (perfil === "admin" || perfil === "gestor") {
    return { situacao: "ok", usuario, perfil, editaveis: "todas" };
  }
  const { data: permissoes, error: erroPerm } = await emendas
    .from("permissoes")
    .select("secretaria_id")
    .eq("usuario_id", usuario.id)
    .eq("pode_editar", true);
  if (erroPerm) falhou("permissoes", erroPerm);
  const editaveis = perfil === "consulta" ? [] : (permissoes ?? []).map((p) => p.secretaria_id);
  return { situacao: "ok", usuario, perfil, editaveis };
});

export function podeEditarSecretaria(ctx: Extract<ContextoEmendas, { situacao: "ok" }>, secretariaId: string) {
  return ctx.editaveis === "todas" || ctx.editaveis.includes(secretariaId);
}

export const listarExercicios = cache(async (): Promise<Exercicio[]> => {
  const emendas = await criarClienteEmendas();
  const { data, error } = await emendas.from("exercicios").select("*").order("ano", { ascending: false });
  if (error) falhou("exercicios", error);
  return data ?? [];
});

/** Exercício pedido na URL, senão o mais recente aberto, senão o mais recente. */
export async function resolverExercicio(anoParam?: string | null): Promise<{ exercicio: Exercicio | null; exercicios: Exercicio[] }> {
  const exercicios = await listarExercicios();
  const pedido = Number(anoParam);
  const exercicio =
    exercicios.find((e) => e.ano === pedido) ?? exercicios.find((e) => e.situacao === "aberto") ?? exercicios[0] ?? null;
  return { exercicio, exercicios };
}

export const listarEmendas = cache(async (ano: number): Promise<EmendaResumo[]> => {
  const emendas = await criarClienteEmendas();
  const { data, error } = await emendas.from("v_emendas").select("*").eq("ano", ano).order("numero");
  if (error) falhou("v_emendas", error);
  return (data ?? []).map((r) => ({
    ...r,
    valor: Number(r.valor),
    empenhado: Number(r.empenhado),
    liquidado: Number(r.liquidado),
    pago: Number(r.pago),
    impedimentos_abertos: Number(r.impedimentos_abertos),
  }));
});

export type MovimentoResumo = Pick<MovimentoFinanceiro, "emenda_id" | "tipo" | "numero" | "data" | "valor">;

/** Movimentos financeiros das emendas visíveis (RLS) — alimentam a curva de
 * pagamentos e os alertas (empenho repetido, pago sem data…). */
export const listarMovimentos = cache(async (idsEmendas: string[]): Promise<MovimentoResumo[]> => {
  if (idsEmendas.length === 0) return [];
  const emendas = await criarClienteEmendas();
  const saida: MovimentoResumo[] = [];
  // Lotes de 150 ids: evita estourar o tamanho da URL do PostgREST.
  for (let i = 0; i < idsEmendas.length; i += 150) {
    const { data, error } = await emendas
      .from("movimentos_financeiros")
      .select("emenda_id,tipo,numero,data,valor")
      .in("emenda_id", idsEmendas.slice(i, i + 150));
    if (error) falhou("movimentos", error);
    saida.push(...(data ?? []).map((m) => ({ ...m, valor: Number(m.valor) })));
  }
  return saida;
});

/** Parceria/execução das emendas (exportação). Mesmo cuidado de lotes de `listarMovimentos`. */
export async function listarExecucoes(idsEmendas: string[]): Promise<ExecucaoEmenda[]> {
  const emendas = await criarClienteEmendas();
  const saida: ExecucaoEmenda[] = [];
  for (let i = 0; i < idsEmendas.length; i += 150) {
    const { data, error } = await emendas.from("execucao").select("*").in("id", idsEmendas.slice(i, i + 150));
    if (error) falhou("execucao", error);
    saida.push(...(data ?? []));
  }
  return saida;
}

export const listarVereadores = cache(async (): Promise<Vereador[]> => {
  const emendas = await criarClienteEmendas();
  const { data, error } = await emendas.from("vereadores").select("*").order("numero");
  if (error) falhou("vereadores", error);
  return data ?? [];
});

export const listarSecretarias = cache(async (): Promise<Secretaria[]> => {
  const emendas = await criarClienteEmendas();
  const { data, error } = await emendas.from("secretarias").select("*").order("nome");
  if (error) falhou("secretarias", error);
  return data ?? [];
});

export const listarUnidades = cache(async (): Promise<UnidadeOrcamentaria[]> => {
  const emendas = await criarClienteEmendas();
  const { data, error } = await emendas.from("unidades_orcamentarias").select("*").order("codigo");
  if (error) falhou("unidades", error);
  return data ?? [];
});

export const listarBeneficiarios = cache(async (): Promise<Beneficiario[]> => {
  const emendas = await criarClienteEmendas();
  const { data, error } = await emendas.from("beneficiarios").select("*").order("nome");
  if (error) falhou("beneficiarios", error);
  return data ?? [];
});

export type DetalheEmenda = {
  emenda: EmendaResumo;
  andamentos: Andamento[];
  movimentos: MovimentoFinanceiro[];
  impedimentos: Impedimento[];
  remanejamentos: Remanejamento[];
  documentos: DocumentoEmenda[];
  execucao: ExecucaoEmenda | null;
};

export async function obterDetalheEmenda(id: string): Promise<DetalheEmenda | null> {
  const emendas = await criarClienteEmendas();
  const { data: emenda, error } = await emendas.from("v_emendas").select("*").eq("id", id).maybeSingle();
  if (error) falhou("detalhe", error);
  if (!emenda) return null;

  const [andamentos, movimentos, impedimentos, remanejamentos, documentos, execucao] = await Promise.all([
    emendas.from("andamentos").select("*").eq("emenda_id", id).order("data", { ascending: false }).order("criado_em", { ascending: false }),
    emendas.from("movimentos_financeiros").select("*").eq("emenda_id", id).order("criado_em"),
    emendas.from("impedimentos").select("*").eq("emenda_id", id).order("criado_em", { ascending: false }),
    emendas.from("remanejamentos").select("*").eq("emenda_id", id).order("criado_em", { ascending: false }),
    emendas.from("documentos").select("*").eq("emenda_id", id).order("criado_em", { ascending: false }),
    emendas.from("execucao").select("*").eq("id", id).maybeSingle(),
  ]);
  for (const r of [andamentos, movimentos, impedimentos, remanejamentos, documentos, execucao]) {
    if (r.error) falhou("detalhe-filhos", r.error);
  }

  return {
    emenda: {
      ...emenda,
      valor: Number(emenda.valor),
      empenhado: Number(emenda.empenhado),
      liquidado: Number(emenda.liquidado),
      pago: Number(emenda.pago),
      impedimentos_abertos: Number(emenda.impedimentos_abertos),
    },
    andamentos: andamentos.data ?? [],
    movimentos: (movimentos.data ?? []).map((m) => ({ ...m, valor: Number(m.valor) })),
    impedimentos: impedimentos.data ?? [],
    remanejamentos: remanejamentos.data ?? [],
    documentos: documentos.data ?? [],
    execucao: execucao.data ?? null,
  };
}

/**
 * Fases e fluxos (Configurações → Fases). Se as tabelas não responderem, cai no
 * catálogo padrão — as telas seguem funcionando com as fases de origem.
 */
export const obterCatalogoEtapas = cache(async (): Promise<CatalogoEtapas> => {
  const emendas = await criarClienteEmendas();
  const [{ data: etapas, error: erroEtapas }, { data: fluxo, error: erroFluxo }] = await Promise.all([
    emendas.from("etapas").select("*"),
    emendas.from("fluxo_etapas").select("*").order("ordem"),
  ]);
  if (erroEtapas || erroFluxo || !etapas?.length || !fluxo?.length) {
    console.error("[obterCatalogoEtapas] usando o catálogo padrão:", erroEtapas ?? erroFluxo);
    return CATALOGO_PADRAO;
  }
  const mapa: Record<string, InfoEtapa> = {};
  for (const e of etapas) mapa[e.chave] = { chave: e.chave, nome: e.nome, cor: e.cor, grupo: e.grupo, fixa: e.fixa };
  const fluxos: CatalogoEtapas["fluxos"] = { repasse: [], direta: [] };
  for (const f of fluxo) if (mapa[f.chave]) fluxos[f.modalidade].push({ chave: f.chave, ativa: f.ativa });
  return { etapas: mapa, fluxos };
});

/** Quantas emendas estão hoje em cada fase e quantos andamentos já a usaram,
 * por modalidade — a tela de Fases usa para decidir entre desativar e excluir. */
export type UsoEtapa = { emendas: number; andamentos: number };

export async function usoDasEtapas(): Promise<Record<"repasse" | "direta", Record<string, UsoEtapa>>> {
  const emendas = await criarClienteEmendas();
  const [{ data: lista, error: e1 }, { data: andamentos, error: e2 }] = await Promise.all([
    emendas.from("emendas").select("id, modalidade, etapa"),
    emendas.from("andamentos").select("emenda_id, etapa"),
  ]);
  if (e1) falhou("emendas", e1);
  if (e2) falhou("andamentos", e2);
  const uso: Record<"repasse" | "direta", Record<string, UsoEtapa>> = { repasse: {}, direta: {} };
  const modalidadeDe = new Map((lista ?? []).map((e) => [e.id, e.modalidade]));
  const ref = (m: "repasse" | "direta", c: string) => (uso[m][c] ??= { emendas: 0, andamentos: 0 });
  for (const e of lista ?? []) ref(e.modalidade, e.etapa).emendas += 1;
  for (const a of andamentos ?? []) {
    const m = modalidadeDe.get(a.emenda_id);
    if (m) ref(m, a.etapa).andamentos += 1;
  }
  return uso;
}
