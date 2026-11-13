import "server-only";

import { totaisFinanceiros } from "@/lib/emendas/fases";
import { brl, etapaAposExclusao } from "@/lib/emendas/regras";
import type { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";

type Cliente = Awaited<ReturnType<typeof criarClienteEmendas>>;

/**
 * Depois de um lançamento: se o total empenhado (ou liquidado, ou pago) já cobre o que havia
 * disponível, a etapa da emenda sobe para a etapa correspondente — pelo `registrar_andamento`,
 * que mantém histórico e avisos. Lançamento parcial não muda a etapa. Só avança, nunca recua.
 */
export async function avancarEtapaPorLancamentos(emendas: Cliente, emendaId: string): Promise<void> {
  try {
    const [{ data: em }, { data: movs }] = await Promise.all([
      emendas.from("emendas").select("valor,etapa,situacao").eq("id", emendaId).maybeSingle(),
      emendas.from("movimentos_financeiros").select("tipo,valor").eq("emenda_id", emendaId),
    ]);
    if (!em || em.situacao !== "normal") return;
    const t = totaisFinanceiros(movs ?? []);
    const valor = Number(em.valor);
    const base = t.empenhado; // liquidar e pagar fecham a fase quando cobrem o que foi empenhado
    let tipo: "empenho" | "liquidacao" | "pagamento" | null = null;
    let texto = "";
    if (t.empenhado > 0 && t.empenhado + t.arredEmpenho + 0.005 >= valor) {
      tipo = "empenho";
      texto = `Empenho total lançado (${brl(t.empenhado)})`;
    }
    if (t.liquidado > 0 && t.empenhado > 0 && t.liquidado + 0.005 >= base) {
      tipo = "liquidacao";
      texto = `Liquidação total lançada (${brl(t.liquidado)})`;
    }
    if (t.pago > 0 && t.empenhado > 0 && t.pago + t.arredPago + 0.005 >= base) {
      tipo = "pagamento";
      texto = `Pagamento total lançado (${brl(t.pago)})`;
    }
    if (!tipo) return;
    const nova = etapaAposExclusao(em.etapa, [tipo]);
    if (!nova) return;
    const { error } = await emendas.rpc("registrar_andamento", {
      p_emenda: emendaId,
      p_etapa: nova,
      p_data: new Date().toISOString().slice(0, 10),
      p_documento: null,
      p_observacao: texto,
      p_valor: null,
    });
    if (error) console.error("[avancarEtapaPorLancamentos]", error);
  } catch (e) {
    console.error("[avancarEtapaPorLancamentos]", e);
  }
}

/** Ao ligar o processo do Compras a uma emenda de execução direta, a emenda passa a "Processo de compra". */
export async function avancarEtapaPorProcesso(emendas: Cliente, emendaId: string): Promise<void> {
  try {
    const { data: em } = await emendas.from("v_emendas").select("etapa,situacao,tipo_execucao,modalidade").eq("id", emendaId).maybeSingle();
    if (!em || em.situacao !== "normal") return;
    const direta = (em.tipo_execucao ?? (em.modalidade === "direta" ? "direta" : "")) === "direta";
    if (!direta || !["indicada", "analise"].includes(em.etapa)) return;
    const { error } = await emendas.rpc("registrar_andamento", {
      p_emenda: emendaId,
      p_etapa: "processo_compra",
      p_data: new Date().toISOString().slice(0, 10),
      p_documento: null,
      p_observacao: "Processo do Compras vinculado",
      p_valor: null,
    });
    if (error) console.error("[avancarEtapaPorProcesso]", error);
  } catch (e) {
    console.error("[avancarEtapaPorProcesso]", e);
  }
}
