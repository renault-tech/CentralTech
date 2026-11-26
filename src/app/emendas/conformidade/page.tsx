import { Suspense } from "react";

import { ListaConformidade } from "@/components/emendas/lista-conformidade";
import { Vazio } from "@/components/emendas/ui";
import { carregarConformidade } from "@/lib/emendas/conformidade-dados";

export const dynamic = "force-dynamic";

/** Conformidade das emendas com a IN TCE-MG 05/2025: o que já está divulgável e o que falta, item a item. */
export default async function PaginaConformidade({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const dados = await carregarConformidade(ano);
  if (!dados) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;
  return (
    <Suspense>
      <ListaConformidade ano={dados.exercicio.ano} resumo={dados.resumo} linhas={dados.linhas} relatoriosPendentes={dados.pendenciasRelatorio} contasIrregulares={dados.contas} />
    </Suspense>
  );
}
