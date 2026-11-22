import Link from "next/link";
import { redirect } from "next/navigation";

import { ImportadorVeiculos } from "@/components/frotas/importador-veiculos";
import { Cartao, TituloPagina } from "@/components/frotas/ui";
import { obterContextoFrotas } from "@/lib/frotas/dados";

export const metadata = { title: "Importar veículos · Frotas" };

export default async function PaginaImportarVeiculos() {
  const ctx = await obterContextoFrotas();
  if (ctx.situacao !== "ok" || !ctx.gestor) redirect("/frotas/veiculos");
  return (
    <>
      <TituloPagina
        titulo="Importar a planilha de veículos"
        subtitulo={<Link href="/frotas/veiculos" className="font-semibold text-[color:var(--modulo-tinta)] underline">← Voltar aos veículos</Link>}
      />
      <Cartao>
        <ImportadorVeiculos />
      </Cartao>
    </>
  );
}
