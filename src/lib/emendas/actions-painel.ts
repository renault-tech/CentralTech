"use server";

import { carregarDetalheCompleto, type DetalheCompleto } from "@/lib/emendas/detalhe-completo";
import { resumoDaLinha, type ResumoLinha } from "@/lib/emendas/resumo";

export type PacoteDetalhe = Omit<DetalheCompleto, "calculo" | "exercicio" | "catalogo" | "tipo"> & {
  fases: DetalheCompleto["calculo"]["fases"];
  pendencias: DetalheCompleto["calculo"]["pendencias"];
  conformidade: DetalheCompleto["calculo"]["conformidade"];
  podeCorrigirLancamento: boolean;
  /** O mesmo resumo que a lista usa, já recalculado com o que foi gravado. */
  resumo: ResumoLinha;
};

/**
 * Dados completos de UMA emenda para o painel ao lado da lista (abas Fases, Documentação, Financeiro…): os mesmos da
 * página inteira, lidos sob a RLS de quem pede. Só leitura; as gravações seguem pelas ações de sempre.
 */
export async function carregarPacoteDetalhe(id: string): Promise<{ ok: true; pacote: PacoteDetalhe } | { ok: false; erro: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, erro: "Emenda inválida." };
  try {
    const r = await carregarDetalheCompleto(id);
    if (r.situacao === "sem_acesso") return { ok: false, erro: "Você não tem acesso ao módulo Emendas." };
    if (r.situacao === "nao_encontrada") return { ok: false, erro: "Emenda não encontrada." };
    const { calculo, exercicio, catalogo: _catalogo, tipo: _tipo, ...resto } = r;
    void _catalogo;
    void _tipo;
    const { situacao: _situacao, ...dados } = resto as typeof resto & { situacao?: string };
    void _situacao;
    return {
      ok: true,
      pacote: {
        ...dados,
        fases: calculo.fases,
        pendencias: calculo.pendencias,
        conformidade: calculo.conformidade,
        resumo: resumoDaLinha(calculo),
        podeCorrigirLancamento: r.podeEditar && !!exercicio?.secretaria_edita_lancamentos,
      },
    };
  } catch (e) {
    console.error("[painel emenda]", e);
    return { ok: false, erro: "Não foi possível carregar os detalhes agora." };
  }
}
