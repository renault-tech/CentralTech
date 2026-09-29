import "server-only";

/**
 * Roda `trabalho` mas só resolve depois de completar `minimoMs` desde
 * `inicio`, faça o que fizer dentro dele. Usado pelos endpoints públicos do
 * Numera (recuperação de senha, resolução de login por username) para não
 * vazar por tempo de resposta se uma conta existe — sem isto, o caminho
 * "existe" sempre demora mais que "não existe" (chamada extra de rede),
 * dando pra distinguir os dois só medindo quanto tempo a resposta leva.
 */
export async function completarNoTempoMinimo<T>(
  inicio: number,
  trabalho: Promise<T>,
  minimoMs: number
): Promise<T> {
  const [resultado] = await Promise.all([
    trabalho,
    new Promise((resolve) => setTimeout(resolve, Math.max(0, minimoMs - (Date.now() - inicio)))),
  ]);
  return resultado;
}

/** Trava por chave (e-mail ou username): best-effort (em memória, por
 * instância — reseta em cold start e não é compartilhado entre instâncias
 * do Vercel), mas já eleva o custo de varrer uma lista de candidatos. Não
 * pretende ser rate limit de produção robusto — se abuso real aparecer, o
 * próximo passo é um serviço dedicado (Upstash/Vercel KV), não mais Map em
 * memória. */
export function criarLimitadorPorChave(janelaMs: number) {
  const ultimaTentativa = new Map<string, number>();
  return function podeTentar(chave: string): boolean {
    const normalizada = chave.toLowerCase();
    const agora = Date.now();
    const ultima = ultimaTentativa.get(normalizada);
    if (ultima && agora - ultima < janelaMs) return false;
    ultimaTentativa.set(normalizada, agora);
    return true;
  };
}
