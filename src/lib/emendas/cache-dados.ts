import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { unstable_cache } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/server";
import { TAG_DADOS } from "@/lib/emendas/dados-tag";

/**
 * Cache curto das leituras pesadas das telas de consulta do módulo (lista, painel, pendências, conformidade, panorama…).
 * Cada aba refazia do zero as mesmas 6–10 consultas (0,6 a 1,5 s cada, medido nos logs da Vercel); agora a primeira
 * pessoa paga e as próximas trocas de aba, por até 60 s, leem do cache.
 *
 * Segurança: o cache é POR PESSOA (o id entra na chave) e a leitura que o preenche roda com o token DA PRÓPRIA pessoa,
 * então a RLS continua decidindo o que entra nele — ninguém recebe linhas que a RLS não liberaria. O token fica só no
 * fechamento da função: não entra na chave nem no valor guardado. Toda gravação do módulo expira a tag
 * (`invalidarDadosEmendas`), então quem grava vê a mudança na hora; só uma mudança feita por fora do app (SQL direto)
 * leva até 60 s para aparecer.
 */
export const clienteFixo = new AsyncLocalStorage<{ token: string }>();

const SEGUNDOS = 60;

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

/** Executa `ler` com cache por pessoa+exercício. Sem sessão legível, lê direto (sem cache). */
export async function lerComCache<T>(nome: string, escopo: string, ler: () => Promise<T>): Promise<T> {
  const { userId, token } = await credenciais();
  if (!userId || !token) return ler();
  const cacheada = unstable_cache(() => clienteFixo.run({ token }, ler), ["emendas-dados", nome, escopo, userId], {
    revalidate: SEGUNDOS,
    tags: [TAG_DADOS],
  });
  try {
    return await cacheada();
  } catch (e) {
    // o cache é só uma aceleração: se falhar (limite de tamanho, token vencido…), lê direto como antes
    console.error("[cache-dados] falha na leitura em cache, lendo direto:", nome, e instanceof Error ? e.message : e);
    return ler();
  }
}
