import { FormularioParametros } from "@/components/frotas/formularios-config";
import { Cartao } from "@/components/frotas/ui";
import { obterParametros } from "@/lib/frotas/dados";

export const metadata = { title: "Limites dos alertas · Frotas" };

export default async function PaginaLimites() {
  const params = await obterParametros();
  return (
    <Cartao titulo="Limites dos alertas">
      <FormularioParametros params={params} />
    </Cartao>
  );
}
