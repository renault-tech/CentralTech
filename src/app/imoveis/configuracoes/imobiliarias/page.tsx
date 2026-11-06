import { EditorImobiliarias } from "@/components/imoveis/formularios-config";
import { Cartao } from "@/components/imoveis/ui";
import { listarImobiliarias } from "@/lib/imoveis/dados";

export const metadata = { title: "Imobiliárias · Imóveis e Consumo" };

export default async function PaginaImobiliarias() {
  return (
    <Cartao titulo="Imobiliárias">
      <EditorImobiliarias imobiliarias={await listarImobiliarias()} />
    </Cartao>
  );
}
