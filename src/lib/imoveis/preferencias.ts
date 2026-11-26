import "server-only";

import { COLUNAS_RELATORIO_IMOVEIS } from "@/lib/imoveis/colunas";
import type { IdRelatorioImoveis } from "@/lib/imoveis/relatorios";
import { criarClienteImoveis } from "@/lib/supabase/imoveis-cliente";

/** Colunas que a pessoa escondeu na exportação, por relatório (guardado por usuário no banco). */
export async function lerColunasOcultasImoveis(): Promise<Partial<Record<IdRelatorioImoveis, string[]>>> {
  try {
    const imoveis = await criarClienteImoveis();
    const { data: claims } = await imoveis.auth.getClaims();
    const usuarioId = claims?.claims?.sub;
    if (!usuarioId) return {};
    const { data } = await imoveis.from("preferencias_exportacao").select("ocultas").eq("usuario_id", usuarioId).maybeSingle();
    const bruto = data?.ocultas;
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
    const limpo: Partial<Record<IdRelatorioImoveis, string[]>> = {};
    for (const [r, nomes] of Object.entries(bruto as Record<string, unknown>)) {
      const validas = COLUNAS_RELATORIO_IMOVEIS[r as IdRelatorioImoveis];
      if (validas && Array.isArray(nomes)) limpo[r as IdRelatorioImoveis] = nomes.filter((n): n is string => typeof n === "string" && validas.includes(n));
    }
    return limpo;
  } catch {
    return {};
  }
}
