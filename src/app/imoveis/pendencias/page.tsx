import { AreaPendencias } from "@/components/imoveis/areas-trabalho";
import { montarLinhasPendencias } from "@/lib/imoveis/area-trabalho";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { obterContextoImoveis } from "@/lib/imoveis/dados";

export const metadata = { title: "Pendências · Imóveis e Consumo" };

export default async function PendenciasImoveis() {
  const [t, ctx] = await Promise.all([carregarTudo(), obterContextoImoveis()]);
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const linhas = montarLinhasPendencias({ imoveis: t.imoveis, secretarias: t.secretarias, todas: t.todas, justificadas: t.justificadas });
  return <AreaPendencias linhas={linhas} gestor={gestor} />;
}
