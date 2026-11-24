import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { unstable_cache, updateTag } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Cache curto das leituras de Frotas e Imóveis, entre requisições (mesmo desenho do `lerComCache` de Emendas).
 *
 * Cada tela refazia do zero as mesmas leituras (tabelas inteiras, até 3 páginas por tabela), e o layout ainda carregava
 * tudo de novo só para o selo do menu. Agora a primeira pessoa paga e as trocas de tela seguintes, por até 60 s, leem do cache.
 *
 * Segurança: o cache é POR PESSOA (o id entra na chave) e a leitura que o preenche roda com o token DA PRÓPRIA pessoa
 * (`clienteFixoModulo`), então a RLS continua decidindo o que entra nele — a secretaria só guarda o que enxerga. O token fica só
 * no fechamento da função: não entra na chave nem no valor. Toda gravação do módulo expira a tag (`invalidarDadosModulo`), então
 * quem grava vê a mudança na hora; só uma mudança feita por fora do app (SQL direto) leva até 60 s para aparecer.
 */
export type ModuloEmCache = "frotas" | "imoveis";

export const clienteFixoModulo = new AsyncLocalStorage<{ token: string }>();

const SEGUNDOS = 60;
export const tagDoModulo = (modulo: ModuloEmCache) => `${modulo}-dados`;

/** Quem está pedindo (uma leitura por requisição, não uma por consulta). */
const credenciais = cache(async (): Promise<{ userId?: string; token?: string }> => {
  try {
    const hub = await criarClienteServidor();
    const [{ data: claims }, { data: sessao }] = await Promise.all([hub.auth.getClaims(), hub.auth.getSession()]);
    return { userId: claims?.claims?.sub, token: sessao.session?.access_token };
  } catch {
    return {}; // sem contexto de requisição legível: segue sem cache
  }
});

/** Executa `ler` com cache por pessoa. Sem sessão legível, lê direto (sem cache). */
export async function lerComCacheModulo<T>(modulo: ModuloEmCache, nome: string, escopo: string, ler: () => Promise<T>): Promise<T> {
  const { userId, token } = await credenciais();
  if (!userId || !token) return ler();
  const cacheada = unstable_cache(() => clienteFixoModulo.run({ token }, ler), [`${modulo}-dados`, nome, escopo, userId], {
    revalidate: SEGUNDOS,
    tags: [tagDoModulo(modulo)],
  });
  try {
    return await cacheada();
  } catch (e) {
    // o cache é só uma aceleração: se falhar (limite de tamanho, token vencido…), lê direto como antes
    console.error("[cache-dados]", modulo, "falha na leitura em cache, lendo direto:", nome, e instanceof Error ? e.message : e);
    return ler();
  }
}

/** Expira o cache do módulo: chamar em toda gravação (só em Server Action). */
export function invalidarDadosModulo(modulo: ModuloEmCache) {
  updateTag(tagDoModulo(modulo));
}
