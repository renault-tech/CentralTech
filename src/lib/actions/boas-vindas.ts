"use server";

import { criarClienteServidor } from "@/lib/supabase/server";

/** Marca, na conta da pessoa, que ela já viu a tela de boas-vindas ao novo design. Nunca lança: é só conveniência. */
export async function marcarBoasVindasDesign(): Promise<void> {
  try {
    const supabase = await criarClienteServidor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("marcar_boas_vindas_design");
  } catch {
    /* sem rede ou sem sessão: o navegador guarda a cópia */
  }
}

/** Marca, na conta da pessoa, que ela já viu um aviso de novidade (chave do aviso). Nunca lança: é só conveniência. */
export async function marcarAvisoVisto(chave: string): Promise<void> {
  try {
    const supabase = await criarClienteServidor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("marcar_aviso_visto", { p_chave: chave });
  } catch {
    /* sem rede ou sem sessão: o navegador guarda a cópia */
  }
}
