import { redirect } from "next/navigation";

import { ImportadorContasPdf } from "@/components/imoveis/importador-contas-pdf";
import { TituloPagina } from "@/components/imoveis/ui";
import { obterContextoImoveis } from "@/lib/imoveis/dados";

export const metadata = { title: "Importar contas · Imóveis e Consumo" };

export default async function ImportarContas() {
  const ctx = await obterContextoImoveis();
  if (ctx.situacao !== "ok" || !ctx.gestor) redirect("/imoveis");
  return (
    <>
      <TituloPagina titulo="Importar contas em PDF" subtitulo="Faturas de água e luz: o sistema propõe os valores, você confere e confirma." />
      <ImportadorContasPdf />
    </>
  );
}
