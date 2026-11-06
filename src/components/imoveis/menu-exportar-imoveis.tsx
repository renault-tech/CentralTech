import { MenuExportar, type OpcaoExportar } from "@/components/modulo/menu-exportar";
import type { IdRelatorioImoveis } from "@/lib/imoveis/relatorios";

const FORMATOS = [
  { f: "xlsx", rotulo: "Excel", detalhe: "Planilha (.xlsx)" },
  { f: "pdf", rotulo: "PDF", detalhe: "Para imprimir ou arquivar" },
  { f: "csv", rotulo: "CSV", detalhe: "Abre no Excel, separado por ponto e vírgula" },
] as const;

/** Menu "Exportar" do módulo: um item por formato para cada relatório pedido. */
export function MenuExportarImoveis({ relatorios }: { relatorios: { r: IdRelatorioImoveis; rotulo: string }[] }) {
  const opcoes: OpcaoExportar[] = relatorios.flatMap(({ r, rotulo }) =>
    FORMATOS.map((x) => ({ rotulo: `${rotulo} · ${x.rotulo}`, detalhe: x.detalhe, relatorio: r, href: `/imoveis/exportar?r=${r}&formato=${x.f}` }))
  );
  return <MenuExportar opcoes={opcoes} />;
}
