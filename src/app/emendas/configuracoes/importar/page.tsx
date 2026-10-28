import { redirect } from "next/navigation";

import { ImportadorJson } from "@/components/emendas/config/importador-json";
import { Importador } from "@/components/emendas/config/importador";
import { listarExercicios, obterContextoEmendas } from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

export default async function PaginaImportar() {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok" || !ehGestor(ctx.perfil)) redirect("/emendas/configuracoes");
  const exercicios = await listarExercicios();
  return (
    <div className="flex flex-col gap-5">
      <ImportadorJson />
      <Importador anos={exercicios.map((e) => e.ano)} />
    </div>
  );
}
