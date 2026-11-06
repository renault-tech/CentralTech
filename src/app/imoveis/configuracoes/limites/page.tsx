import { FormularioLimites } from "@/components/imoveis/formularios-config";
import { Cartao } from "@/components/imoveis/ui";
import { obterParametros } from "@/lib/imoveis/dados";

export const metadata = { title: "Limites dos alertas · Imóveis e Consumo" };

export default async function PaginaLimites() {
  const parametros = await obterParametros();
  return (
    <Cartao titulo="Limites dos alertas" apoio="Valem para todo o módulo (painel, pendências e avisos no sino)">
      <FormularioLimites parametros={parametros} />
    </Cartao>
  );
}
