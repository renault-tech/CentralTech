"use server";

import { z } from "zod";

import { criarClienteServidor } from "@/lib/supabase/server";

const esquema = z.object({
  tema: z.enum(["auto", "claro", "escuro"]).nullable(),
  estilo: z.enum(["apple", "classico"]).nullable(),
});

/** Grava a aparência da pessoa no banco (nulo = manter o valor atual). Nunca lança: é só conveniência. */
export async function salvarPreferencias(entrada: z.infer<typeof esquema>): Promise<void> {
  const r = esquema.safeParse(entrada);
  if (!r.success) return;
  try {
    const supabase = await criarClienteServidor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("salvar_preferencias", { p_tema: r.data.tema, p_estilo: r.data.estilo, p_detalhe: null });
  } catch {
    /* sem rede ou sem sessão: a escolha segue valendo neste navegador */
  }
}
