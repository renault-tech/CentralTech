import { calcularEmendasDoExercicio } from "@/lib/emendas/calculos";
import type { LinhaConformidade, ResumoItem } from "@/lib/emendas/conformidade-lista";
import { listarEmendasEmCache, resolverExercicio } from "@/lib/emendas/dados";
import { tipoDaEmenda } from "@/lib/emendas/fases";
import { medir } from "@/lib/emendas/tempo";

/** Dados da tela de Conformidade (e dos arquivos exportados dela): resumo por item e uma linha por emenda não cancelada. */
export async function carregarConformidade(ano?: string | null) {
  const { exercicio } = await medir("conformidade:exercicio", () => resolverExercicio(ano ?? undefined));
  if (!exercicio) return null;
  const emendas = await medir("conformidade:emendas", () => listarEmendasEmCache(exercicio.ano));
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
    linhas.push({ id: e.id, numero: e.numero, objeto: e.objeto, secretaria: e.secretaria_nome, tipo: tipoDaEmenda(e), executada: e.empenhado > 0 || e.pago > 0, faltas });
  }
  const pendenciasRelatorio = [...calculos.values()].reduce((t, c) => t + c.pendencias.filter((p) => p.regra.startsWith("relatorio_gestao") && !p.justificativa).length, 0);
  const contas = [...calculos.values()].reduce((t, c) => t + c.pendencias.filter((p) => (p.regra === "conta_repetida" || p.regra === "conta_banco_nao_oficial") && !p.justificativa).length, 0);
  return { exercicio, resumo: [...resumo.values()], linhas, pendenciasRelatorio, contas };
}
