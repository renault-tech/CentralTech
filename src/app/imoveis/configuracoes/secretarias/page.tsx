import { EditorSecretarias } from "@/components/imoveis/formularios-config";
import { Cartao } from "@/components/imoveis/ui";
import { listarSecretarias } from "@/lib/imoveis/dados";

export const metadata = { title: "Secretarias · Imóveis e Consumo" };

export default async function PaginaSecretarias() {
  return (
    <Cartao titulo="Secretarias">
      <EditorSecretarias secretarias={await listarSecretarias()} />
    </Cartao>
  );
}
