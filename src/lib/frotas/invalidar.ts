import { revalidatePath } from "next/cache";

import { invalidarDadosModulo } from "@/lib/modulo/cache-dados";

/** `revalidatePath` que também expira o cache curto das leituras do módulo — nenhuma gravação esquece de limpá-lo. */
export function revalidarCaminho(caminho: string, tipo?: "page" | "layout") {
  invalidarDadosModulo("frotas");
  revalidatePath(caminho, tipo);
}
