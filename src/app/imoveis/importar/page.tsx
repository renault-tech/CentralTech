import { redirect } from "next/navigation";

import { ImportadorContasPdf } from "@/components/imoveis/importador-contas-pdf";
import { ImportadorPlanilhaContas } from "@/components/imoveis/importador-planilha-contas";
import { TituloPagina } from "@/components/imoveis/ui";
import { obterContextoImoveis } from "@/lib/imoveis/dados";

export const metadata = { title: "Importar contas · Imóveis e Consumo" };

export default async function ImportarContas() {
  const ctx = await obterContextoImoveis();
  if (ctx.situacao !== "ok" || !ctx.gestor) redirect("/imoveis");
  return (
    <>
      <TituloPagina titulo="Importar contas" subtitulo="Planilha de controle (Excel) ou faturas em PDF: o sistema propõe, você confere e confirma." />
      <section aria-labelledby="h-planilha" className="mb-8">
        <h2 id="h-planilha" className="mb-3 text-lg font-semibold text-cataguases-marinho">Planilha de controle (Excel)</h2>
        <ImportadorPlanilhaContas />
      </section>
      <section aria-labelledby="h-pdf">
        <h2 id="h-pdf" className="mb-3 text-lg font-semibold text-cataguases-marinho">Faturas em PDF</h2>
        <ImportadorContasPdf />
      </section>
    </>
  );
}
