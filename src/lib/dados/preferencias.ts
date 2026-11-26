import "server-only";
import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";

export type PreferenciasServidor = { tema: "auto" | "claro" | "escuro"; estilo: "apple" | "classico"; boasVindasVistas: boolean; avisosVistos: string[] } | null;

/** Preferências de aparência da pessoa logada (RLS: só a própria linha). Falha = null (vale o navegador). */
export const lerPreferencias = cache(async (): Promise<PreferenciasServidor> => {
  try {
    const supabase = await criarClienteServidor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("preferencias_usuario").select("tema, estilo, boas_vindas_design_em, avisos_vistos").maybeSingle();
    return data ? { tema: data.tema, estilo: data.estilo, boasVindasVistas: !!data.boas_vindas_design_em, avisosVistos: data.avisos_vistos ?? [] } : null;
  } catch {
    return null;
  }
});
