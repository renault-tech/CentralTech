import { revalidatePath, updateTag } from "next/cache";

import { TAG_DADOS } from "@/lib/emendas/dados-tag";

/** Expira o cache curto das leituras: chamar em toda gravação do módulo (só em Server Action). */
export function invalidarDadosEmendas() {
  updateTag(TAG_DADOS);
}

/** `revalidatePath` que também expira o cache de dados — assim nenhuma gravação esquece de limpá-lo. */
export function revalidarCaminho(caminho: string, tipo?: "page" | "layout") {
  invalidarDadosEmendas();
  revalidatePath(caminho, tipo);
}
