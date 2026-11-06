import { redirect } from "next/navigation";

import { FormularioImovel } from "@/components/imoveis/formulario-imovel";
import { Cartao, TituloPagina } from "@/components/imoveis/ui";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { obterContextoImoveis } from "@/lib/imoveis/dados";

export const metadata = { title: "Novo imóvel · Imóveis e Consumo" };

export default async function NovoImovel() {
  const ctx = await obterContextoImoveis();
  if (ctx.situacao !== "ok" || !ctx.gestor) redirect("/imoveis/imoveis");
  const { secretarias, imobiliarias } = await carregarTudo();
  return (
    <>
      <TituloPagina titulo="Novo imóvel" subtitulo="Cadastre o imóvel e o contrato. As matrículas de água e luz entram na próxima tela." />
      <Cartao>
        <FormularioImovel imovel={null} secretarias={secretarias} imobiliarias={imobiliarias} voltarPara="/imoveis/imoveis" />
      </Cartao>
    </>
  );
}
