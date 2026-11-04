import { ListaSecretarias } from "@/components/frotas/formularios-config";
import { Cartao } from "@/components/frotas/ui";
import { listarSecretarias } from "@/lib/frotas/dados";

export const metadata = { title: "Secretarias · Frotas" };

export default async function PaginaSecretarias() {
  const secretarias = await listarSecretarias();
  return (
    <Cartao titulo="Secretarias">
      <ListaSecretarias secretarias={secretarias} />
    </Cartao>
  );
}
