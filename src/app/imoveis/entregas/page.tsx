import { AreaEntregas } from "@/components/imoveis/areas-trabalho";
import { montarLinhasEntregas } from "@/lib/imoveis/area-trabalho";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { obterContextoImoveis } from "@/lib/imoveis/dados";

export const metadata = { title: "Entregas · Imóveis e Consumo" };

export default async function EntregasImoveis() {
  const [t, ctx] = await Promise.all([carregarTudo(), obterContextoImoveis()]);
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const linhas = montarLinhasEntregas({ hoje: t.hoje, imoveis: t.imoveis, unidades: t.unidades, contas: t.contas, entregas: t.entregas, secretarias: t.secretarias, par: t.par, pendencias: t.pendencias });
  return <AreaEntregas linhas={linhas} gestor={gestor} />;
}
