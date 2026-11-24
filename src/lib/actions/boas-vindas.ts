"use server";

import { invalidarCabecalho } from "@/lib/dados/cache-cabecalho";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Marca, na conta da pessoa, que ela já viu a tela de boas-vindas ao novo design. Nunca lança: é só conveniência. */
export async function marcarBoasVindasDesign(): Promise<void> {
  try {
    const supabase = await criarClienteServidor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("marcar_boas_vindas_design");
    invalidarCabecalho();
  } catch {
    /* sem rede ou sem sessão: o navegador guarda a cópia */
  }
}
