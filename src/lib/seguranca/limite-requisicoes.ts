import "server-only";

import { headers } from "next/headers";

import { criarClienteAdminBruto } from "@/lib/supabase/admin";

/**
 * Limite de tentativas por IP e rota, guardado no banco (`hub.limites_requisicao`) —
 * vale entre todas as instâncias serverless, ao contrário de um Map em memória. Janela
 * fixa; contagem aproximada (leitura + gravação, não atômica), suficiente contra
 * força bruta e varredura. Se o banco falhar, NÃO bloqueia (falha aberta): proteção
 * extra não pode derrubar o login.
 */

export function ipDe(h: Headers): string {
  const encadeado = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encadeado || h.get("x-real-ip") || "desconhecido";
}

export async function ipDoCliente(): Promise<string> {
  return ipDe(await headers());
}

/** Registra uma tentativa e diz se passou do limite na janela atual. */
export async function excedeuLimite(rota: string, ip: string, limite: number, janelaSeg: number): Promise<boolean> {
  try {
    const db = criarClienteAdminBruto().schema("hub");
    const janela = Math.floor(Date.now() / 1000 / janelaSeg);
    const chave = `${rota}|${ip}`.slice(0, 200);
    const { data } = await db.from("limites_requisicao").select("contagem").eq("chave", chave).eq("janela", janela).maybeSingle();
    const contagem = (data?.contagem ?? 0) + 1;
    await db.from("limites_requisicao").upsert({ chave, janela, contagem });
    // Limpeza oportunista das janelas antigas (1 em cada 50 chamadas).
    if (Math.random() < 0.02) {
      await db.from("limites_requisicao").delete().lt("janela", janela - Math.ceil(3600 / janelaSeg));
    }
    return contagem > limite;
  } catch (e) {
    console.error("[limite-requisicoes]", e);
    return false;
  }
}
