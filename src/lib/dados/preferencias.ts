import "server-only";
import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";

export type PreferenciasServidor = { tema: "auto" | "claro" | "escuro"; estilo: "apple" | "classico" } | null;

/** Preferências de aparência da pessoa logada (RLS: só a própria linha). Falha = null (vale o navegador). */
export const lerPreferencias = cache(async (): Promise<PreferenciasServidor> => {
  try {
    const supabase = await criarClienteServidor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("preferencias_usuario").select("tema, estilo").maybeSingle();
    return data ? { tema: data.tema, estilo: data.estilo } : null;
  } catch {
    return null;
  }
});
