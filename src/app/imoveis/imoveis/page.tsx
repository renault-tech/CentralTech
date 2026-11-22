import { AreaImoveis } from "@/components/imoveis/areas-trabalho";
import { montarLinhasImoveis } from "@/lib/imoveis/area-trabalho";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { obterContextoImoveis } from "@/lib/imoveis/dados";

export const metadata = { title: "Imóveis · Imóveis e Consumo" };

export default async function ListaImoveis() {
  const [t, ctx] = await Promise.all([carregarTudo(), obterContextoImoveis()]);
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const linhas = montarLinhasImoveis({ hoje: t.hoje, imoveis: t.imoveis, unidades: t.unidades, contas: t.contas, entregas: t.entregas, secretarias: t.secretarias, par: t.par, imobiliarias: t.imobiliarias, pendencias: t.pendencias });
  return <AreaImoveis linhas={linhas} gestor={gestor} />;
}
