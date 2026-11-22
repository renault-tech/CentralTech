import "server-only";

import { COLUNAS_RELATORIO, lerOcultas } from "@/lib/frotas/colunas";
import type { IdRelatorio } from "@/lib/frotas/relatorios";
import { criarClienteFrotas } from "@/lib/supabase/frotas-cliente";

/** Colunas que a pessoa escondeu na exportação, por relatório (guardado por usuário no banco). */
export async function lerColunasOcultasDoUsuario(): Promise<Partial<Record<IdRelatorio, string[]>>> {
  try {
    const frotas = await criarClienteFrotas();
    // `getClaims` confere o token localmente (o middleware já validou a sessão com o servidor de Auth): uma ida à rede a menos por página.
    const { data: claims } = await frotas.auth.getClaims();
    const usuarioId = claims?.claims?.sub;
    if (!usuarioId) return {};
    const { data } = await frotas.from("preferencias_exportacao").select("ocultas").eq("usuario_id", usuarioId).maybeSingle();
    if (!data) return {};
    // só o que ainda existe no catálogo (coluna renomeada deixa de valer)
    const limpo: Partial<Record<IdRelatorio, string[]>> = {};
    for (const [r, nomes] of Object.entries(lerOcultas(JSON.stringify(data.ocultas)))) {
      const validas = COLUNAS_RELATORIO[r as IdRelatorio];
      if (validas && Array.isArray(nomes)) limpo[r as IdRelatorio] = nomes.filter((n) => validas.includes(n));
    }
    return limpo;
  } catch {
    return {};
  }
}
