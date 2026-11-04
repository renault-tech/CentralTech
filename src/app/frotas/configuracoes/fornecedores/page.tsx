import { ListaFornecedores } from "@/components/frotas/formularios-config";
import { Cartao } from "@/components/frotas/ui";
import { listarFornecedores } from "@/lib/frotas/dados";

export const metadata = { title: "Fornecedores · Frotas" };

export default async function PaginaFornecedores() {
  const fornecedores = await listarFornecedores();
  const por = (tipo: "posto" | "oficina" | "locadora") => fornecedores.filter((f) => f.tipo === tipo);
  return (
    <Cartao titulo="Postos, oficinas e locadoras">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <ListaFornecedores tipo="posto" fornecedores={por("posto")} />
        <ListaFornecedores tipo="oficina" fornecedores={por("oficina")} />
        <ListaFornecedores tipo="locadora" fornecedores={por("locadora")} />
      </div>
    </Cartao>
  );
}
