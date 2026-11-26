"use client";

import * as React from "react";

import { useColunasImoveis } from "@/components/imoveis/colunas-exportacao";
import { DialogoColunas } from "@/components/modulo/dialogo-colunas";
import { MenuExportar, type OpcaoExportar } from "@/components/modulo/menu-exportar";
import { COLUNAS_RELATORIO_IMOVEIS, ROTULO_RELATORIO_IMOVEIS } from "@/lib/imoveis/colunas";
import type { IdRelatorioImoveis } from "@/lib/imoveis/relatorios";

const FORMATOS = [
  { f: "xlsx", rotulo: "Excel", detalhe: "Planilha (.xlsx)" },
  { f: "pdf", rotulo: "PDF", detalhe: "Para imprimir ou arquivar" },
  { f: "csv", rotulo: "CSV", detalhe: "Abre no Excel, separado por ponto e vírgula" },
] as const;

/** Menu "Exportar" do módulo: um item por formato para cada relatório, mais "Escolher colunas…". */
export function MenuExportarImoveis({ relatorios }: { relatorios: { r: IdRelatorioImoveis; rotulo: string }[] }) {
  const { ocultas, guardar } = useColunasImoveis();
  const [aberto, setAberto] = React.useState(false);

  const opcoes: OpcaoExportar[] = relatorios.flatMap(({ r, rotulo }) =>
    FORMATOS.map((x) => {
      const sem = ocultas[r]?.length ? `&sem=${encodeURIComponent(ocultas[r]!.join("|"))}` : "";
      return { rotulo: `${rotulo} · ${x.rotulo}`, detalhe: x.detalhe, relatorio: r, href: `/imoveis/exportar?r=${r}&formato=${x.f}${sem}` };
    })
  );
  const todas: OpcaoExportar[] = [...opcoes, { rotulo: "Escolher colunas…", detalhe: "Define o que aparece nos arquivos", aoClicar: () => setAberto(true) }];

  function alterar(r: string, proximas: string[]) {
    const novo = { ...ocultas, [r]: proximas };
    if (proximas.length === 0) delete novo[r as IdRelatorioImoveis];
    guardar(novo);
  }

  return (
    <>
      <MenuExportar opcoes={todas} />
      {aberto && (
        <DialogoColunas
          relatorios={relatorios.map(({ r }) => ({ id: r, rotulo: ROTULO_RELATORIO_IMOVEIS[r], colunas: COLUNAS_RELATORIO_IMOVEIS[r] }))}
          ocultas={ocultas}
          alterar={alterar}
          limparTudo={() => guardar({})}
          fechar={() => setAberto(false)}
        />
      )}
    </>
  );
}
