"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { listarFasesCatalogo, listarItensChecklist, obterContextoEmendas } from "@/lib/emendas/dados";
import { gerarPropostas, lerJsonV1, type PropostaNova } from "@/lib/emendas/importacao/json-v1";
import { ehGestor } from "@/lib/emendas/regras";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";
import type { Resultado } from "@/lib/emendas/actions";
import type { ChecklistEmenda, ExecucaoEmenda, FaseEmenda } from "@/types/emendas";

/**
 * Propostas de alteração: importações e edições de secretaria em dado já preenchido
 * esperam a aprovação do gestor. Quem decide é sempre o gestor/admin do Hub; a RLS de
 * `propostas` só deixa o gestor alterar o status.
 */

type Cliente = Awaited<ReturnType<typeof criarClienteEmendas>>;
type Linha = {
  id: string;
  emenda_id: string;
  alvo: "execucao" | "emenda_fases" | "emenda_checklist" | "movimentos";
  chave: string | null;
  campo: string | null;
  valor_atual: unknown;
  valor_proposto: unknown;
};

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function exigirGestor() {
  const ctx = await obterContextoEmendas();
  return ctx.situacao === "ok" && ehGestor(ctx.perfil) ? ctx : null;
}

/** Valor que o banco tem hoje para o alvo da proposta (para detectar conflito). */
async function valorAtualDe(emendas: Cliente, p: Linha): Promise<unknown> {
  if (p.alvo === "execucao" && p.campo) {
    const { data } = await emendas.from("execucao").select("*").eq("id", p.emenda_id).maybeSingle();
    return (data as Record<string, unknown> | null)?.[p.campo] ?? null;
  }
  if (p.alvo === "emenda_fases" && p.chave) {
    const { data } = await emendas.from("emenda_fases").select("*").eq("emenda_id", p.emenda_id).eq("chave", p.chave).maybeSingle();
    return data ? { situacao: data.situacao, data: data.data, documento: data.documento, observacao: data.observacao } : null;
  }
  if (p.alvo === "emenda_checklist" && p.chave) {
    const { data } = await emendas.from("emenda_checklist").select("estado").eq("emenda_id", p.emenda_id).eq("item_chave", p.chave).maybeSingle();
    return { estado: data?.estado ?? "pendente" };
  }
  return null;
}

async function aplicar(emendas: Cliente, p: Linha, usuarioId: string): Promise<string | null> {
  const agora = new Date().toISOString();
  if (p.alvo === "execucao" && p.campo) {
    const { error } = await emendas.from("execucao").upsert({ id: p.emenda_id, [p.campo]: p.valor_proposto, atualizado_em: agora, atualizado_por: usuarioId } as Partial<ExecucaoEmenda> & { id: string });
    return error ? error.message : null;
  }
  if (p.alvo === "emenda_fases" && p.chave) {
    const v = p.valor_proposto as Pick<FaseEmenda, "situacao" | "data" | "documento" | "observacao">;
    const { error } = await emendas.from("emenda_fases").upsert({
      emenda_id: p.emenda_id, chave: p.chave, situacao: v.situacao, data: v.data, documento: v.documento, observacao: v.observacao,
      origem: "aprovacao", atualizado_por: usuarioId, atualizado_em: agora,
    });
    return error ? error.message : null;
  }
  if (p.alvo === "emenda_checklist" && p.chave) {
    const v = p.valor_proposto as Pick<ChecklistEmenda, "estado">;
    const conferido = v.estado === "conferido";
    const { error } = await emendas.from("emenda_checklist").upsert({
      emenda_id: p.emenda_id, item_chave: p.chave, estado: v.estado,
      conferido_por: conferido ? usuarioId : null, conferido_em: conferido ? agora : null,
    });
    return error ? error.message : null;
  }
  return "Tipo de proposta não suportado.";
}

const esquemaDecisao = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
  aprovar: z.boolean(),
  motivo: z.string().trim().max(500).optional(),
});

export async function decidirPropostas(dados: z.input<typeof esquemaDecisao>): Promise<Resultado & { aprovadas?: number; conflitos?: number; falhas?: number }> {
  const a = esquemaDecisao.safeParse(dados);
  if (!a.success) return { sucesso: false, erro: a.error.issues[0]?.message ?? "Dados inválidos" };
  const ctx = await exigirGestor();
  if (!ctx) return { sucesso: false, erro: "Só gestores decidem propostas." };

  const emendas = await criarClienteEmendas();
  const { data, error } = await emendas.from("propostas").select("*").in("id", a.data.ids).eq("status", "pendente");
  if (error) return { sucesso: false, erro: "Não foi possível carregar as propostas." };

  let aprovadas = 0;
  let conflitos = 0;
  let falhas = 0;
  for (const p of (data ?? []) as unknown as Linha[]) {
    let status: "aprovada" | "rejeitada" | "conflito" = a.data.aprovar ? "aprovada" : "rejeitada";
    if (a.data.aprovar) {
      const atual = await valorAtualDe(emendas, p);
      if (!igual(atual, p.valor_atual)) status = "conflito";
      else {
        const falha = await aplicar(emendas, p, ctx.usuario.id);
        if (falha) {
          console.error("[decidirPropostas]", falha);
          falhas += 1;
          continue;
        }
      }
    }
    const { error: erroStatus } = await emendas
      .from("propostas")
      .update({ status, decidido_por: ctx.usuario.id, decidido_em: new Date().toISOString(), motivo: a.data.motivo || null })
      .eq("id", p.id);
    if (erroStatus) falhas += 1;
    else if (status === "aprovada") aprovadas += 1;
    else if (status === "conflito") conflitos += 1;
  }
  revalidatePath("/emendas", "layout");
  return { sucesso: true, aprovadas, conflitos, falhas };
}

/** Lote de propostas vindas da edição de uma secretaria em dado já preenchido. */
export async function proporAlteracoes(emendaId: string, propostas: Omit<PropostaNova, "numero" | "rotulo">[]): Promise<string | null> {
  if (propostas.length === 0) return null;
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return "Sem acesso ao módulo.";
  const emendas = await criarClienteEmendas();
  const { error } = await emendas.from("propostas").insert(
    propostas.map((p) => ({
      emenda_id: emendaId, alvo: p.alvo, chave: p.chave, campo: p.campo, valor_atual: p.valorAtual as never,
      valor_proposto: p.valorProposto as never, origem: "secretaria" as const, autor: ctx.usuario.id,
    }))
  );
  if (error) {
    console.error("[proporAlteracoes]", error);
    return "Não foi possível enviar a proposta de alteração.";
  }
  return null;
}

// ------------------------------------------------------------ importação

export type ResumoImportacao =
  | { sucesso: true; propostas: number; emendasAfetadas: number; emendasIgnoradas: number[]; semMudanca: number }
  | { sucesso: false; erro: string };

const LIMITE_ARQUIVO = 5 * 1024 * 1024;

export async function importarJsonV1(formData: FormData): Promise<ResumoImportacao> {
  const ctx = await exigirGestor();
  if (!ctx) return { sucesso: false, erro: "Só gestores importam arquivos." };
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { sucesso: false, erro: "Escolha o arquivo .json exportado do controle." };
  if (arquivo.size > LIMITE_ARQUIVO) return { sucesso: false, erro: "Arquivo grande demais (máximo 5 MB)." };

  const texto = await arquivo.text();
  const lido = lerJsonV1(texto);
  if (!lido.arquivo) return { sucesso: false, erro: lido.erro ?? "Arquivo inválido." };
  const { ano, emendas: itens } = lido.arquivo;

  const emendas = await criarClienteEmendas();
  const sha256 = createHash("sha256").update(texto).digest("hex");
  const { data: jaFoi } = await emendas.from("importacoes").select("criado_em").eq("sha256", sha256).maybeSingle();
  if (jaFoi) return { sucesso: false, erro: "Este mesmo arquivo já foi importado antes." };

  const { data: existentes, error } = await emendas.from("v_emendas").select("id,numero,tipo_execucao,modalidade").eq("ano", ano).in("numero", itens.map((e) => e.numero));
  if (error) return { sucesso: false, erro: "Não foi possível ler as emendas do exercício." };
  const porNumero = new Map((existentes ?? []).map((e) => [e.numero, e]));
  const ids = (existentes ?? []).map((e) => e.id);
  if (ids.length === 0) return { sucesso: false, erro: `Nenhuma emenda de ${ano} do arquivo existe no sistema.` };

  const [catalogo, itensChecklist, exec, fases, check] = await Promise.all([
    listarFasesCatalogo(),
    listarItensChecklist(),
    emendas.from("execucao").select("*").in("id", ids),
    emendas.from("emenda_fases").select("*").in("emenda_id", ids),
    emendas.from("emenda_checklist").select("*").in("emenda_id", ids),
  ]);
  if (exec.error || fases.error || check.error) return { sucesso: false, erro: "Não foi possível ler os dados atuais." };
  const execPor = new Map((exec.data ?? []).map((x: ExecucaoEmenda) => [x.id, x]));
  const fasesPor = new Map<string, Map<string, FaseEmenda>>();
  for (const f of fases.data ?? []) (fasesPor.get(f.emenda_id) ?? fasesPor.set(f.emenda_id, new Map()).get(f.emenda_id)!).set(f.chave, f);
  const checkPor = new Map<string, Map<string, ChecklistEmenda>>();
  for (const c of check.data ?? []) (checkPor.get(c.emenda_id) ?? checkPor.set(c.emenda_id, new Map()).get(c.emenda_id)!).set(c.item_chave, c);

  const novas: { emendaId: string; p: PropostaNova }[] = [];
  const ignoradas: number[] = [];
  let semMudanca = 0;
  for (const item of itens) {
    const e = porNumero.get(item.numero);
    if (!e) {
      ignoradas.push(item.numero);
      continue;
    }
    const tipo = e.tipo_execucao ?? (e.modalidade === "direta" ? "direta" : "osc");
    const geradas = gerarPropostas(item, {
      execucao: execPor.get(e.id) ?? null,
      fases: fasesPor.get(e.id) ?? new Map(),
      checklist: checkPor.get(e.id) ?? new Map(),
      catalogo: catalogo.filter((f) => f.tipo === tipo),
      itensChecklist: new Set(itensChecklist.filter((i) => i.tipo === tipo && i.ativo).map((i) => i.chave)),
    });
    if (geradas.length === 0) semMudanca += 1;
    for (const p of geradas) novas.push({ emendaId: e.id, p });
  }

  const { data: imp, error: erroImp } = await emendas
    .from("importacoes")
    .insert({ formato: "centraltech.emendas.execucao/v1", arquivo_nome: arquivo.name.slice(0, 200), sha256, criado_por: ctx.usuario.id, resumo: { ano, propostas: novas.length, ignoradas } })
    .select("id")
    .single();
  if (erroImp || !imp) return { sucesso: false, erro: "Não foi possível registrar a importação." };

  for (let i = 0; i < novas.length; i += 200) {
    const { error: erroProp } = await emendas.from("propostas").insert(
      novas.slice(i, i + 200).map(({ emendaId, p }) => ({
        importacao_id: imp.id, emenda_id: emendaId, alvo: p.alvo, chave: p.chave, campo: p.campo,
        valor_atual: p.valorAtual as never, valor_proposto: p.valorProposto as never, origem: "importacao" as const, autor: ctx.usuario.id,
      }))
    );
    if (erroProp) {
      console.error("[importarJsonV1]", erroProp);
      return { sucesso: false, erro: "Falha ao gravar as propostas. Reenvie o arquivo." };
    }
  }
  revalidatePath("/emendas", "layout");
  return { sucesso: true, propostas: novas.length, emendasAfetadas: new Set(novas.map((n) => n.emendaId)).size, emendasIgnoradas: ignoradas, semMudanca };
}
