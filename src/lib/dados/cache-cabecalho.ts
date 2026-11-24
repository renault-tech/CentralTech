import "server-only";

import { cache } from "react";
import { unstable_cache, updateTag } from "next/cache";

import { clienteFixoHub } from "@/lib/supabase/cliente-fixo-hub";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Cache curto do que o cabeçalho lê em TODA tela (preferências, selos de pendência e de feedback). Cada navegação
 * refazia 3 a 5 consultas só para isso (~6 mil por dia no projeto, medido nos logs do Supabase).
 *
 * Segurança: igual ao cache de Emendas — chave POR PESSOA e leitura com o token da própria pessoa, então a RLS decide o que
 * entra. Quem grava (aprovar pedido, mudar status de feedback, salvar preferência) expira a tag e vê a mudança na hora; uma
 * mudança feita por OUTRA pessoa leva até `segundos` para aparecer no selo.
 */
export const TAG_CABECALHO = "hub-cabecalho";

const credenciais = cache(async (): Promise<{ userId?: string; token?: string }> => {
  try {
    const hub = await criarClienteServidor();
    const [{ data: claims }, { data: sessao }] = await Promise.all([hub.auth.getClaims(), hub.auth.getSession()]);
    return { userId: claims?.claims?.sub, token: sessao.session?.access_token };
  } catch {
    return {};
  }
});

export async function lerComCacheHub<T>(nome: string, segundos: number, ler: () => Promise<T>): Promise<T> {
  const { userId, token } = await credenciais();
  if (!userId || !token) return ler();
  const cacheada = unstable_cache(() => clienteFixoHub.run({ token }, ler), ["hub-cabecalho", nome, userId], {
    revalidate: segundos,
    tags: [TAG_CABECALHO],
  });
  try {
    return await cacheada();
  } catch (e) {
    console.error("[cache-cabecalho] falha na leitura em cache, lendo direto:", nome, e instanceof Error ? e.message : e);
    return ler();
  }
}

/** Expira o cache do cabeçalho: chamar em Server Action que muda pedidos, feedback ou preferências. */
export function invalidarCabecalho() {
  updateTag(TAG_CABECALHO);
}
