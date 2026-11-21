import "server-only";

import { buscarProcessoPorId, resumoDoProcesso, type ProcessoCompras } from "@/lib/emendas/compras";
import {
  listarBeneficiarios,
  listarFasesCatalogo,
  listarPareceres,
  listarUnidades,
  listarVereadores,
  obterCatalogoEtapas,
  obterContextoEmendas,
  obterDetalheEmenda,
  podeEditarSecretaria,
  resolverExercicio,
  type DetalheEmenda,
} from "@/lib/emendas/dados";
import { tipoDaEmenda } from "@/lib/emendas/fases";
import { calcularEmendas, type CalculoEmenda } from "@/lib/emendas/resumo";
import { ehGestor, type CatalogoEtapas } from "@/lib/emendas/regras";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Beneficiario, Exercicio, TipoExecucao, UnidadeOrcamentaria } from "@/types/emendas";

export type LinhaAuditoria = { id: number; tabela: string; acao: string; em: string; usuario_id: string | null; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null };
export type ExclusaoJustificada = { em: string; usuario_id: string; justificativa: string; tipo: string };

/** Tudo o que a emenda aberta mostra (página inteira e painel ao lado da lista): lido sob a RLS de quem pede. */
export type DetalheCompleto = {
  detalhe: DetalheEmenda;
  catalogo: CatalogoEtapas;
  beneficiarios: Beneficiario[];
  unidades: UnidadeOrcamentaria[];
  auditoria: LinhaAuditoria[];
  exclusoes: ExclusaoJustificada[];
  nomesUsuarios: Record<string, string>;
  calculo: CalculoEmenda;
  processoCompras: ProcessoCompras | null;
  exercicio: Exercicio | null;
  podeEditar: boolean;
  gestor: boolean;
  tipo: TipoExecucao;
};

export type ResultadoDetalheCompleto = { situacao: "sem_acesso" } | { situacao: "nao_encontrada" } | ({ situacao: "ok" } & DetalheCompleto);

export async function carregarDetalheCompleto(id: string): Promise<ResultadoDetalheCompleto> {
  // O contexto (sessão, perfil) e as leituras que não dependem dele andam juntos: antes o detalhe só começava
  // a buscar depois de o perfil voltar.
  const promessaCtx = obterContextoEmendas();
  const promessaBase = Promise.all([obterDetalheEmenda(id), obterCatalogoEtapas(), listarBeneficiarios(), listarUnidades(), listarFasesCatalogo(), listarVereadores()]);
  promessaBase.catch(() => {}); // se o contexto mandar sair, o erro desta rodada não pode virar rejeição solta
  const ctx = await promessaCtx;
  if (ctx.situacao !== "ok") return { situacao: "sem_acesso" };

  // A auditoria e as exclusões só são lidas por gestor.
  const gestor = ehGestor(ctx.perfil);
  const [[detalhe, catalogo, beneficiarios, unidades, fasesCatalogo, vereadores], auditoria, exclusoes] = await Promise.all([
    promessaBase,
    gestor
      ? criarClienteEmendas().then((c) =>
          // Tudo o que mexeu nesta emenda: o cadastro (registro_id = emenda) e os registros filhos
          // (lançamentos, andamentos, impedimentos, anexos, remanejamentos), que guardam a emenda no JSON.
          c
            .from("auditoria")
            .select("*")
            .or(`registro_id.eq.${id},antes->>emenda_id.eq.${id},depois->>emenda_id.eq.${id}`)
            .order("em", { ascending: false })
            .limit(300)
        )
      : Promise.resolve({ data: [] }),
    gestor
      ? criarClienteEmendas().then((c) => c.from("exclusoes_justificadas").select("em,usuario_id,justificativa,tipo").eq("emenda_id", id).order("em", { ascending: false }))
      : Promise.resolve({ data: [] }),
  ]);
  if (!detalhe) return { situacao: "nao_encontrada" };
  const { emenda, movimentos, execucao } = detalhe;
  const tipo = tipoDaEmenda(emenda);
  const [processoCompras, { exercicio }, pareceres] = await Promise.all([
    execucao?.processo_id ? buscarProcessoPorId(execucao.processo_id).catch(() => null) : Promise.resolve(null),
    resolverExercicio(String(emenda.ano)),
    listarPareceres(emenda.ano),
  ]);
  const calculo = calcularEmendas({
    emendas: [emenda],
    fasesCatalogo,
    manuais: detalhe.fasesManuais,
    movimentos,
    compras: processoCompras && execucao?.processo_id ? new Map([[execucao.processo_id, resumoDoProcesso(processoCompras)]]) : undefined,
    execucoes: execucao ? [execucao] : [],
    exercicio,
    pareceres,
    justificadas: detalhe.justificadas,
    catalogo,
    documentos: detalhe.documentos.map((d) => ({ emenda_id: d.emenda_id, tipo: d.tipo, competencia: d.competencia ?? null })),
    partidos: new Map(vereadores.map((v) => [v.id, v.partido])),
    hoje: new Date().toISOString().slice(0, 10),
  }).get(emenda.id)!;

  const registros = (auditoria.data ?? []) as LinhaAuditoria[];
  const listaExclusoes = (exclusoes.data ?? []) as ExclusaoJustificada[];
  const idsUsuarios = Array.from(new Set([...registros.map((a) => a.usuario_id), ...listaExclusoes.map((e) => e.usuario_id)].filter((x): x is string => !!x)));
  const nomesUsuarios: Record<string, string> = {};
  if (idsUsuarios.length) {
    const hub = await criarClienteServidor();
    const { data } = await hub.from("usuarios").select("id,nome").in("id", idsUsuarios);
    for (const u of data ?? []) nomesUsuarios[u.id] = u.nome;
  }

  return {
    situacao: "ok",
    detalhe,
    catalogo,
    beneficiarios,
    unidades,
    auditoria: registros,
    exclusoes: listaExclusoes,
    nomesUsuarios,
    calculo,
    processoCompras,
    exercicio,
    podeEditar: podeEditarSecretaria(ctx, emenda.secretaria_id),
    gestor,
    tipo,
  };
}
