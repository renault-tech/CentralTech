import { Suspense } from "react";

import { ListaConformidade, type LinhaConformidade, type ResumoItem } from "@/components/emendas/lista-conformidade";
import { Vazio } from "@/components/emendas/ui";
import { calcularEmendasDoExercicio } from "@/lib/emendas/calculos";
import { listarEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { tipoDaEmenda } from "@/lib/emendas/fases";
import { medir } from "@/lib/emendas/tempo";

export const dynamic = "force-dynamic";

/** Conformidade das emendas com a IN TCE-MG 05/2025: o que já está divulgável e o que falta, item a item. */
export default async function PaginaConformidade({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const { exercicio } = await medir("conformidade:exercicio", () => resolverExercicio(ano));
  if (!exercicio) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;
  const emendas = await medir("conformidade:emendas", () => listarEmendas(exercicio.ano));
  const calculos = await medir("conformidade:calculos", () => calcularEmendasDoExercicio(emendas, exercicio));

  const resumo = new Map<string, ResumoItem>();
  const linhas: LinhaConformidade[] = [];
  for (const e of emendas) {
    if (e.situacao === "cancelada") continue;
    const itens = calculos.get(e.id)?.conformidade ?? [];
    const faltas: string[] = [];
    for (const i of itens) {
      const r = resumo.get(i.codigo) ?? { codigo: i.codigo, nome: i.nome, exigencia: i.exigencia, aplicaveis: 0, atendem: 0 };
      if (i.aplica) {
        r.aplicaveis++;
        if (i.ok) r.atendem++;
        else faltas.push(i.codigo);
      }
      resumo.set(i.codigo, r);
    }
    linhas.push({
      id: e.id,
      numero: e.numero,
      objeto: e.objeto,
      secretaria: e.secretaria_nome,
      tipo: tipoDaEmenda(e),
      executada: e.empenhado > 0 || e.pago > 0,
      faltas,
    });
  }
  const pendenciasRelatorio = [...calculos.values()].reduce((t, c) => t + c.pendencias.filter((p) => p.regra.startsWith("relatorio_gestao") && !p.justificativa).length, 0);
  const contas = [...calculos.values()].reduce((t, c) => t + c.pendencias.filter((p) => (p.regra === "conta_repetida" || p.regra === "conta_banco_nao_oficial") && !p.justificativa).length, 0);

  return (
    <Suspense>
      <ListaConformidade ano={exercicio.ano} resumo={[...resumo.values()]} linhas={linhas} relatoriosPendentes={pendenciasRelatorio} contasIrregulares={contas} />
    </Suspense>
  );
}
