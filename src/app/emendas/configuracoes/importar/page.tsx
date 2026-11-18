import { redirect } from "next/navigation";

import { ImportadorAjustes } from "@/components/emendas/config/importador-ajustes";
import { ImportadorJson } from "@/components/emendas/config/importador-json";
import { Importador } from "@/components/emendas/config/importador";
import { obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

export default async function PaginaImportar({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok" || !ehGestor(ctx.perfil)) redirect("/emendas/configuracoes");
  const { ano } = await searchParams;
  const { exercicio, exercicios } = await resolverExercicio(ano);
  // O exercício escolhido no seletor vem primeiro (é o padrão dos dois importadores).
  const anos = [...exercicios.map((e) => e.ano)].sort((a, b) => (a === exercicio?.ano ? -1 : b === exercicio?.ano ? 1 : b - a));
  return (
    <div className="flex flex-col gap-5">
      <ImportadorJson />
      <Importador anos={anos} />
      <ImportadorAjustes anos={anos} />
    </div>
  );
}
