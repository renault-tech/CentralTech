import "server-only";

/**
 * Mede quanto tempo uma etapa de carregamento leva e registra no log do servidor
 * ("[tempo] lista:emendas 412ms") quando passa de 300 ms. Serve para achar, nos logs da
 * Vercel, qual etapa deixa uma tela lenta — sem custo quando tudo está rápido.
 */
export async function medir<T>(rotulo: string, fn: () => Promise<T>): Promise<T> {
  const inicio = Date.now();
  try {
    return await fn();
  } finally {
    const ms = Date.now() - inicio;
    if (ms > 300) console.info(`[tempo] ${rotulo} ${ms}ms`);
  }
}
