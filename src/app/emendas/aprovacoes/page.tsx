import { ListaAprovacoes } from "@/components/emendas/lista-aprovacoes";
import { listarPropostas, obterContextoEmendas } from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

export default async function PaginaAprovacoes() {
  const ctx = await obterContextoEmendas();
  const gestor = ctx.situacao === "ok" && ehGestor(ctx.perfil);
  const [pendentes, decididas] = await Promise.all([listarPropostas("pendente"), listarPropostas("decididas")]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-cataguases-marinho">{gestor ? "Aprovações" : "Minhas propostas"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {gestor
            ? "Alterações em dado já preenchido (importações e edições das secretarias) só valem depois da sua aprovação."
            : "Alterações que você fez em dado já preenchido esperam a aprovação do gestor."}
        </p>
      </div>
      <ListaAprovacoes pendentes={pendentes} decididas={decididas} gestor={gestor} />
    </div>
  );
}
