import "server-only";
import { cache } from "react";

import { lerComCacheHub } from "@/lib/dados/cache-cabecalho";
import { criarClienteServidor } from "@/lib/supabase/server";

export type PreferenciasServidor = { tema: "auto" | "claro" | "escuro"; estilo: "apple" | "classico"; boasVindasVistas: boolean } | null;

/** Preferências de aparência da pessoa logada (RLS: só a própria linha). Falha = null (vale o navegador). */
export const lerPreferencias = cache(async (): Promise<PreferenciasServidor> =>
  lerComCacheHub("preferencias", 300, async () => {
  try {
    const supabase = await criarClienteServidor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("preferencias_usuario").select("tema, estilo, boas_vindas_design_em").maybeSingle();
    return data ? { tema: data.tema, estilo: data.estilo, boasVindasVistas: !!data.boas_vindas_design_em } : null;
  } catch {
    return null;
  }
  })
);
