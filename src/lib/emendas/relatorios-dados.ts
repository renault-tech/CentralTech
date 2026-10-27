import "server-only";

import { listarEmendas, listarExecucoes } from "@/lib/emendas/dados";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";
import {
  relatorioImpedimentos,
  relatorioParcerias,
  relatorioPorBeneficiario,
  relatorioPorSecretaria,
  relatorioPorVereador,
  type Tabela,
} from "@/lib/emendas/relatorios";

export const RELATORIOS = ["vereador", "secretaria", "beneficiario", "parcerias", "impedimentos"] as const;
export type Relatorio = (typeof RELATORIOS)[number];

/** Monta um relatório sob a RLS de quem pede (cada pessoa só relata o que vê). */
export async function montarRelatorio(r: Relatorio, ano: number): Promise<Tabela> {
  const emendas = await listarEmendas(ano);
  if (r === "vereador") return relatorioPorVereador(emendas);
  if (r === "secretaria") return relatorioPorSecretaria(emendas);
  if (r === "beneficiario") return relatorioPorBeneficiario(emendas);
  if (r === "parcerias") return relatorioParcerias(emendas, await listarExecucoes(emendas.map((e) => e.id)));
  const db = await criarClienteEmendas();
  const { data } = await db.from("impedimentos").select("*").is("resolvido_em", null);
  return relatorioImpedimentos(emendas, data ?? []);
}
