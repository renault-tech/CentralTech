import { ListaEnvios } from "@/components/emendas/lista-envios";
import { listarEnviosPendentes } from "@/lib/emendas/dados-envios";
import { ListaAprovacoes } from "@/components/emendas/lista-aprovacoes";
import { listarPropostas, obterContextoEmendas } from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

export default async function PaginaAprovacoes() {
  const ctx = await obterContextoEmendas();
  const gestor = ctx.situacao === "ok" && ehGestor(ctx.perfil);
  const [pendentes, decididas, envios] = await Promise.all([listarPropostas("pendente"), listarPropostas("decididas"), listarEnviosPendentes()]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-cataguases-marinho">{gestor ? "Aprovações" : "Minhas propostas"}</h1>
      </div>
      <ListaEnvios envios={envios} gestor={gestor} />
      <ListaAprovacoes pendentes={pendentes} decididas={decididas} gestor={gestor} />
    </div>
  );
}
