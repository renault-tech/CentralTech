import type { OpcaoExportar } from "@/components/emendas/menu-exportar";
import type { IdRelatorio } from "@/lib/frotas/relatorios";
import { montarUrl } from "@/lib/frotas/url";

export type FormatoExportacao = "xlsx" | "pdf" | "csv";

const ROTULO_FORMATO: Record<FormatoExportacao, { rotulo: string; detalhe: string }> = {
  xlsx: { rotulo: "Excel", detalhe: "Planilha (.xlsx)" },
  pdf: { rotulo: "PDF", detalhe: "Para imprimir ou arquivar" },
  csv: { rotulo: "CSV", detalhe: "Abre no Excel, separado por ponto e vírgula" },
};

/** Opções do menu "Exportar": um item por relatório e formato. Os filtros da tela vão junto, para exportar a lista como está na tela. */
export function opcoesExportar(
  itens: { r: IdRelatorio | "completo"; rotulo: string; formatos: FormatoExportacao[] }[],
  filtros: Record<string, string | undefined | null | false> = {}
): OpcaoExportar[] {
  return itens.flatMap((i) =>
    i.formatos.map((formato) => ({
      rotulo: `${i.rotulo} · ${ROTULO_FORMATO[formato].rotulo}`,
      detalhe: ROTULO_FORMATO[formato].detalhe,
      href: montarUrl("/frotas/exportar", { ...(i.r === "completo" ? {} : filtros), r: i.r, formato }),
    }))
  );
}
